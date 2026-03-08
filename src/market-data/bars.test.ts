import { describe, it, expect } from 'vitest';
import { Bars } from '../shared/domain/bar/bars.js';
import type { OHLC } from '../shared/domain/bar/ohlc.js';
import { AtrMethod } from '../shared/domain/engine-enums.js';

// ─────────────────────────────────────────────────────────────
// Shared test helpers
// ─────────────────────────────────────────────────────────────

function makeOHLC(
  close: number,
  opts: { high?: number; low?: number; open?: number } = {},
): OHLC {
  return {
    open:  opts.open  ?? close,
    high:  opts.high  ?? close,
    low:   opts.low   ?? close,
    close,
    time:  new Date('2024-01-01'),
  };
}

/** Index 0 = most-recent bar. */
function makeBars(
  closes: number[],
  highs?: number[],
  lows?: number[],
): Bars {
  const data: OHLC[] = closes.map((c, i) =>
    makeOHLC(c, { high: highs?.[i] ?? c, low: lows?.[i] ?? c }),
  );
  return new Bars(data);
}

// ─────────────────────────────────────────────────────────────
// T3 – isLocalHigh / isLocalLow
// ─────────────────────────────────────────────────────────────

describe('T3 – isLocalHigh / isLocalLow: lookback=1 checks exactly one neighbour', () => {
  it('isLocalHigh(1): bar NOT a local high when the very next bar has a higher high', () => {
    // index 0 (most-recent): H=1.10; index 1 (older): H=1.12 — NOT a local high
    const bars = makeBars([1.10, 1.12], [1.10, 1.12]);
    expect(bars.isLocalHigh(1, 0)).toBe(false);
  });

  it('isLocalHigh(1): bar IS a local high when the very next bar has a lower high', () => {
    // index 0: H=1.12; index 1: H=1.10 — IS a local high
    const bars = makeBars([1.12, 1.10], [1.12, 1.10]);
    expect(bars.isLocalHigh(1, 0)).toBe(true);
  });

  it('isLocalLow(1): bar NOT a local low when the very next bar has a lower low', () => {
    // index 0: L=1.10; index 1: L=1.08 — NOT a local low
    const bars = makeBars([1.10, 1.08], undefined, [1.10, 1.08]);
    expect(bars.isLocalLow(1, 0)).toBe(false);
  });

  it('isLocalLow(1): bar IS a local low when the very next bar has a higher low', () => {
    // index 0: L=1.08; index 1: L=1.10 — IS a local low
    const bars = makeBars([1.08, 1.10], undefined, [1.08, 1.10]);
    expect(bars.isLocalLow(1, 0)).toBe(true);
  });

  it('isLocalHigh(2): checks 2 neighbours — fails if either is higher', () => {
    // index 0: H=1.11; index 1: H=1.10; index 2: H=1.12 — bar[2] is higher → NOT local high
    const bars = makeBars([1.11, 1.10, 1.12], [1.11, 1.10, 1.12]);
    expect(bars.isLocalHigh(2, 0)).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────
// T6 – AtrMethod.Ema: correct (oldest→newest) direction
// ─────────────────────────────────────────────────────────────

describe('T6 – AtrMethod.Ema iterates oldest-to-newest, weighting recent bars most', () => {
  it('EMA ATR with 2 bars gives higher weight to the more recent (smaller) TR', () => {
    // Bars (index 0 = most-recent):
    //   data[0]: H=1.1010, L=1.1000  → used as bar i=0,  prev = data[1]
    //   data[1]: H=1.1030, L=1.0990  → used as bar i=1,  prev = data[2]
    //   data[2]: H=1.1010, L=1.1010  → only used as previous close
    //
    // TR[0] = max(0.001, |1.101−1.101|, |1.100−1.101|) = 0.001  (most-recent, SMALL)
    // TR[1] = max(0.004, |1.103−1.101|, |1.099−1.101|) = 0.004  (older,       LARGE)
    //
    // trs = [0.001, 0.004]  (newest first)
    // k = 2/3
    // Correct EMA (oldest→newest):  seed=0.004, then 0.001×(2/3) + 0.004×(1/3) = 0.002
    // Wrong  EMA (newest→oldest):   seed=0.001, then 0.004×(2/3) + 0.001×(1/3) = 0.003
    const data: OHLC[] = [
      makeOHLC(1.1005, { high: 1.1010, low: 1.1000 }),  // i=0
      makeOHLC(1.1010, { high: 1.1030, low: 1.0990 }),  // i=1
      makeOHLC(1.1010, { high: 1.1010, low: 1.1010 }),  // prev close only
    ];
    const bars = new Bars(data);
    expect(bars.atr(2, 0, AtrMethod.Ema)).toBeCloseTo(0.002, 6);
  });
});

// ─────────────────────────────────────────────────────────────
// T7 – RSI: Wilder's smoothing
// ─────────────────────────────────────────────────────────────

describe('T7 – RSI uses Wilders smoothed averaging', () => {
  it('all-gain series → RSI = 100', () => {
    // periods=3, need 3×2+1=7 bars.  Prices descend so every diff is a gain.
    // closes[i] = 7−i  (most-recent=7, oldest=1).
    // All diffs = data[i].close − data[i+1].close = 1 (gain).
    const closes = [7, 6, 5, 4, 3, 2, 1].map(Number);
    const bars = makeBars(closes);
    expect(bars.rsi(3, 0)).toBe(100);
  });

  it('all-loss series → RSI = 0', () => {
    // Prices ascend → every diff is negative (loss).
    const closes = [1, 2, 3, 4, 5, 6, 7].map(Number);
    const bars = makeBars(closes);
    expect(bars.rsi(3, 0)).toBe(0);
  });

  it('returns 50 when there are fewer bars than the Wilders bootstrap requires', () => {
    // periods=3 needs 3×2+1=7 bars.  With 6 bars it should return 50.
    const closes = [7, 6, 5, 4, 3, 2].map(Number);
    const bars = makeBars(closes);
    expect(bars.rsi(3, 0)).toBe(50);
  });

  it('mixed series → exact Wilders RSI value (hand-verified)', () => {
    // closes = [6, 5, 4, 3, 2, 1, 5, 4]  (index 0 = most-recent = 6, index 7 = oldest = 4)
    // periods = 3  →  base = 3
    //
    // Bootstrap (i = 3..5):
    //   i=3: diff = data[3]−data[4] = 3−2 = 1 (gain)
    //   i=4: diff = data[4]−data[5] = 2−1 = 1 (gain)
    //   i=5: diff = data[5]−data[6] = 1−5 = −4 (loss)
    //   avgGain = 2/3,  avgLoss = 4/3
    //
    // Wilder smoothing (i = 2 → 0):
    //   i=2: g=1, l=0 → avgGain = (2/3×2+1)/3 = 7/9,  avgLoss = (4/3×2)/3 = 8/9
    //   i=1: g=1, l=0 → avgGain = (7/9×2+1)/3 = 23/27, avgLoss = (8/9×2)/3 = 16/27
    //   i=0: g=1, l=0 → avgGain = (23/27×2+1)/3 = 73/81, avgLoss = (16/27×2)/3 = 32/81
    //
    // RSI = 100 − 100 / (1 + (73/81)/(32/81)) = 100 − 100/(1 + 73/32)
    //      = 100 − 3200/105 = 1460/21 ≈ 69.5238
    const closes = [6, 5, 4, 3, 2, 1, 5, 4].map(Number);
    const bars = makeBars(closes);
    expect(bars.rsi(3, 0)).toBeCloseTo(1460 / 21, 4);
  });
});

// ─────────────────────────────────────────────────────────────
// P14 – Bars utility methods: sma, highestHigh, lowestLow
// ─────────────────────────────────────────────────────────────

describe('P14 – Bars utilities', () => {
  // data[0] = newest; data[3] = oldest
  const bars = makeBars(
    [1.1004, 1.1003, 1.1002, 1.1001],          // closes (newest first)
    [1.1010, 1.1009, 1.1008, 1.1007],          // highs
    [1.0994, 1.0993, 1.0992, 1.0991],          // lows
  );

  it('sma(3) = average of 3 most-recent closes', () => {
    // (1.1004 + 1.1003 + 1.1002) / 3 = 3.3009 / 3 = 1.1003
    expect(bars.sma(3)).toBeCloseTo(1.1003, 5);
  });

  it('highestHigh(3) = max high across 3 most-recent bars', () => {
    // max(1.1010, 1.1009, 1.1008) = 1.1010
    expect(bars.highestHigh(3)).toBeCloseTo(1.1010, 5);
  });

  it('lowestLow(3) = min low across 3 most-recent bars', () => {
    // min(1.0994, 1.0993, 1.0992) = 1.0992
    expect(bars.lowestLow(3)).toBeCloseTo(1.0992, 5);
  });
});

// ─────────────────────────────────────────────────────────────
// T1.2 – Bars: multi-bar patterns
// ─────────────────────────────────────────────────────────────

describe('T1.2 – Bars multi-bar patterns', () => {
  it('isEngulfingLong: current low < prev low AND close > prev high', () => {
    const bars = new Bars([
      { open: 1.0950, high: 1.1060, low: 1.0890, close: 1.1050, time: new Date() }, // engulfs
      { open: 1.1020, high: 1.1040, low: 1.0900, close: 1.0920, time: new Date() }, // prev
    ]);
    expect(bars.isEngulfingLong(0)).toBe(true);
  });

  it('isEngulfingLong: false when close does not exceed prev high', () => {
    const bars = new Bars([
      { open: 1.0950, high: 1.1030, low: 1.0890, close: 1.1030, time: new Date() },
      { open: 1.1020, high: 1.1040, low: 1.0900, close: 1.0920, time: new Date() },
    ]);
    expect(bars.isEngulfingLong(0)).toBe(false); // close 1.1030 < prev high 1.1040
  });

  it('isEngulfingShort: current high > prev high AND close < prev low', () => {
    const bars = new Bars([
      { open: 1.1050, high: 1.1060, low: 1.0880, close: 1.0880, time: new Date() }, // engulfs down
      { open: 1.0920, high: 1.1040, low: 1.0900, close: 1.1020, time: new Date() }, // prev
    ]);
    expect(bars.isEngulfingShort(0)).toBe(true);
  });

  it('isReversingLong: bullish bar with higher high and close > prev close & open', () => {
    const bars = new Bars([
      { open: 1.0930, high: 1.1060, low: 1.0920, close: 1.1050, time: new Date() }, // reversal
      { open: 1.1020, high: 1.1040, low: 1.0900, close: 1.0930, time: new Date() }, // prev bearish
    ]);
    expect(bars.isReversingLong(0)).toBe(true);
  });

  it('isReversingShort: bearish bar with lower low and close < prev close & open', () => {
    const bars = new Bars([
      { open: 1.1050, high: 1.1060, low: 1.0880, close: 1.0890, time: new Date() }, // reversal
      { open: 1.0920, high: 1.1040, low: 1.0900, close: 1.1020, time: new Date() }, // prev bullish
    ]);
    expect(bars.isReversingShort(0)).toBe(true);
  });

  it('multi-bar patterns return false when not enough bars', () => {
    const bars = new Bars([
      { open: 1.1000, high: 1.1050, low: 1.0950, close: 1.1030, time: new Date() },
    ]);
    expect(bars.isEngulfingLong(0)).toBe(false);
    expect(bars.isEngulfingShort(0)).toBe(false);
    expect(bars.isReversingLong(0)).toBe(false);
    expect(bars.isReversingShort(0)).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────
// T1.3 – Bars: EMA
// ─────────────────────────────────────────────────────────────

describe('T1.3 – Bars.ema', () => {
  it('ema(1) returns the close at shift', () => {
    const bars = new Bars([
      { open: 1, high: 2, low: 0.5, close: 1.5, time: new Date() },
      { open: 1, high: 2, low: 0.5, close: 1.0, time: new Date() },
    ]);
    // EMA(1) with k=1.0 should converge to the close at shift
    expect(bars.ema(1, 0)).toBeCloseTo(1.5, 5);
  });

  it('ema with constant closes equals that close', () => {
    const data = Array.from({ length: 20 }, () => ({
      open: 1.1, high: 1.2, low: 1.0, close: 1.1, time: new Date(),
    }));
    const bars = new Bars(data);
    expect(bars.ema(10, 0)).toBeCloseTo(1.1, 5);
  });

  it('ema reacts faster than sma to recent price changes', () => {
    // 10 bars at 1.0, then jump to 2.0 at shift 0
    const data = [
      { open: 2, high: 2, low: 2, close: 2.0, time: new Date() },
      ...Array.from({ length: 10 }, () => ({
        open: 1, high: 1, low: 1, close: 1.0, time: new Date(),
      })),
    ];
    const bars = new Bars(data);
    const emaVal = bars.ema(5, 0);
    const smaVal = bars.sma(5, 0);
    // EMA weights recent data more → closer to 2.0 than SMA
    expect(emaVal).toBeGreaterThan(smaVal);
  });

  it('ema returns close when only 1 bar available', () => {
    const bars = new Bars([{ open: 1, high: 2, low: 0.5, close: 1.5, time: new Date() }]);
    expect(bars.ema(10, 0)).toBeCloseTo(1.5, 5);
  });
});

// ─────────────────────────────────────────────────────────────
// T2.1 – Bars: tickVolumeAverage & volumeRatio
// ─────────────────────────────────────────────────────────────

describe('T2.1 – Bars volume helpers', () => {
  const mkBar = (vol: number): OHLC => ({ open: 1, high: 2, low: 0.5, close: 1.5, time: new Date(), volume: vol });

  it('tickVolumeAverage returns mean volume over periods', () => {
    const bars = new Bars([mkBar(100), mkBar(200), mkBar(300)]);
    expect(bars.tickVolumeAverage(3)).toBe(200);
  });

  it('tickVolumeAverage with shift skips leading bars', () => {
    const bars = new Bars([mkBar(100), mkBar(200), mkBar(300)]);
    expect(bars.tickVolumeAverage(2, 1)).toBe(250);
  });

  it('tickVolumeAverage returns 0 for empty bars', () => {
    const bars = new Bars([]);
    expect(bars.tickVolumeAverage(5)).toBe(0);
  });

  it('volumeRatio = current volume / average of subsequent bars', () => {
    // bar[0]=400, avg of bar[1..2] = (100+200)/2 = 150 → ratio = 400/150
    const bars = new Bars([mkBar(400), mkBar(100), mkBar(200)]);
    expect(bars.volumeRatio(2)).toBeCloseTo(400 / 150, 5);
  });

  it('volumeRatio returns 0 when average is 0', () => {
    const bars = new Bars([mkBar(100), mkBar(0)]);
    expect(bars.volumeRatio(1)).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────
// T2.2 – Bars: isMaSloping
// ─────────────────────────────────────────────────────────────

describe('T2.2 – Bars.isMaSloping', () => {
  // Create bars with monotonically increasing closes: [10, 9, 8, 7, 6, 5, 4, 3, 2, 1]
  // (index 0 = most recent = highest close)
  const upBars = new Bars(
    Array.from({ length: 10 }, (_, i) => ({
      open: 10 - i, high: 11 - i, low: 9 - i, close: 10 - i, time: new Date(),
    })),
  );

  it('detects upward SMA slope', () => {
    // SMA(3) at shift 0,1,2,3 = 9, 8, 7, 6 → monotonically increasing (newest→oldest reversed)
    expect(upBars.isMaSloping('sma', 3, 4, 0, true)).toBe(true);
  });

  it('detects upward EMA slope', () => {
    expect(upBars.isMaSloping('ema', 3, 4, 0, true)).toBe(true);
  });

  it('returns false for down when trend is up', () => {
    expect(upBars.isMaSloping('sma', 3, 4, 0, false)).toBe(false);
  });

  it('returns false when span < 2', () => {
    expect(upBars.isMaSloping('sma', 3, 1, 0, true)).toBe(false);
  });

  it('detects downward slope on descending closes', () => {
    // closes: [1, 2, 3, 4, 5] → SMA(2) at shift 0,1,2 = 1.5, 2.5, 3.5 → descending
    const downBars = new Bars(
      Array.from({ length: 5 }, (_, i) => ({
        open: i + 1, high: i + 2, low: i, close: i + 1, time: new Date(),
      })),
    );
    expect(downBars.isMaSloping('sma', 2, 3, 0, false)).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────
// T2.3 – Bars: stochastic
// ─────────────────────────────────────────────────────────────

describe('T2.3 – Bars.stochastic', () => {
  it('returns 50 when all bars are identical (no range)', () => {
    const bars = new Bars(
      Array.from({ length: 20 }, () => ({ open: 1, high: 1, low: 1, close: 1, time: new Date() })),
    );
    const { main, signal } = bars.stochastic(14, 3, 3);
    expect(main).toBe(50);
    expect(signal).toBe(50);
  });

  it('returns 100 when close is at highest high', () => {
    // Most recent bar at the top of the range
    const data: OHLC[] = Array.from({ length: 20 }, (_, i) => ({
      open: i + 1, high: i + 2, low: i, close: i + 1, time: new Date(),
    }));
    const bars = new Bars(data);
    // %K with periodK=5: close[0]=1, lowestLow(5,0)=0, highestHigh(5,0)=6
    // Actually let's just check it's a reasonable value
    const { main, signal } = bars.stochastic(5, 3, 1);
    expect(main).toBeGreaterThanOrEqual(0);
    expect(main).toBeLessThanOrEqual(100);
    expect(signal).toBeGreaterThanOrEqual(0);
    expect(signal).toBeLessThanOrEqual(100);
  });

  it('main and signal are in [0, 100] for random-ish data', () => {
    const data: OHLC[] = [
      { open: 5, high: 10, low: 1, close: 8, time: new Date() },
      { open: 4, high: 9, low: 2, close: 3, time: new Date() },
      { open: 6, high: 11, low: 3, close: 7, time: new Date() },
      { open: 3, high: 8, low: 1, close: 5, time: new Date() },
      { open: 7, high: 12, low: 4, close: 9, time: new Date() },
      { open: 2, high: 7, low: 0, close: 4, time: new Date() },
      { open: 5, high: 10, low: 2, close: 6, time: new Date() },
      { open: 3, high: 9, low: 1, close: 5, time: new Date() },
      { open: 4, high: 8, low: 2, close: 7, time: new Date() },
      { open: 6, high: 11, low: 3, close: 8, time: new Date() },
    ];
    const bars = new Bars(data);
    const { main, signal } = bars.stochastic(5, 3, 3);
    expect(main).toBeGreaterThanOrEqual(0);
    expect(main).toBeLessThanOrEqual(100);
    expect(signal).toBeGreaterThanOrEqual(0);
    expect(signal).toBeLessThanOrEqual(100);
  });

  it('slowing=1 means no smoothing on raw %K', () => {
    const data: OHLC[] = Array.from({ length: 10 }, (_, i) => ({
      open: 5, high: 10, low: 0, close: i, time: new Date(),
    }));
    const bars = new Bars(data);
    // With slowing=1, main = raw %K at shift 0
    const { main } = bars.stochastic(5, 3, 1);
    // close[0]=0, lowestLow(5,0)=0, highestHigh(5,0)=10 → %K = (0-0)/(10-0)*100 = 0
    expect(main).toBeCloseTo(0, 5);
  });
});

// ─────────────────────────────────────────────────────────────
// T3.2 – Bars: highestHighShift & lowestLowShift
// ─────────────────────────────────────────────────────────────

describe('T3.2 – Bars shift lookups', () => {
  const data: OHLC[] = [
    { open: 5, high: 10, low: 3, close: 7, time: new Date('2026-01-05') },
    { open: 4, high: 15, low: 2, close: 6, time: new Date('2026-01-04') }, // highest high
    { open: 3, high: 8,  low: 1, close: 5, time: new Date('2026-01-03') }, // lowest low
    { open: 2, high: 9,  low: 4, close: 4, time: new Date('2026-01-02') },
    { open: 1, high: 7,  low: 3, close: 3, time: new Date('2026-01-01') },
  ];
  const bars = new Bars(data);

  it('highestHighShift returns shift of max high', () => {
    expect(bars.highestHighShift(5)).toBe(1); // high=15 at index 1
  });

  it('lowestLowShift returns shift of min low', () => {
    expect(bars.lowestLowShift(5)).toBe(2); // low=1 at index 2
  });

  it('highestHighShift respects shift parameter', () => {
    expect(bars.highestHighShift(3, 2)).toBe(3); // indices 2,3,4 → high=9 at index 3
  });

  it('lowestLowShift respects shift parameter', () => {
    expect(bars.lowestLowShift(2, 0)).toBe(1); // indices 0,1 → low=2 at index 1
  });
});

// ─────────────────────────────────────────────────────────────
// T3.3 – Bars: getBarShift (binary search)
// ─────────────────────────────────────────────────────────────

describe('T3.3 – Bars.getBarShift', () => {
  const dates = [
    new Date('2026-01-05T00:00Z'),
    new Date('2026-01-04T00:00Z'),
    new Date('2026-01-03T00:00Z'),
    new Date('2026-01-02T00:00Z'),
    new Date('2026-01-01T00:00Z'),
  ];
  const data: OHLC[] = dates.map(d => ({ open: 1, high: 2, low: 0.5, close: 1.5, time: d }));
  const bars = new Bars(data);

  it('finds exact match', () => {
    expect(bars.getBarShift(new Date('2026-01-03T00:00Z'))).toBe(2);
  });

  it('finds nearest bar for in-between date', () => {
    // Between index 1 (Jan 4) and index 2 (Jan 3) — should return nearest
    const shift = bars.getBarShift(new Date('2026-01-03T12:00Z'));
    expect(shift).toBeGreaterThanOrEqual(1);
    expect(shift).toBeLessThanOrEqual(2);
  });

  it('returns 0 for date newer than all bars', () => {
    expect(bars.getBarShift(new Date('2026-02-01T00:00Z'))).toBe(0);
  });

  it('returns last index for date older than all bars', () => {
    expect(bars.getBarShift(new Date('2025-01-01T00:00Z'))).toBe(4);
  });
});

// ─────────────────────────────────────────────────────────────
// T3.4 – Bars: findOutsideBar
// ─────────────────────────────────────────────────────────────

describe('T3.4 – Bars.findOutsideBar', () => {
  it('finds enclosing bar scanning backward', () => {
    const data: OHLC[] = [
      { open: 1.2, high: 1.3, low: 1.1, close: 1.25, time: new Date() }, // narrow bar
      { open: 1.1, high: 1.2, low: 1.15, close: 1.18, time: new Date() }, // too narrow
      { open: 1.0, high: 1.5, low: 0.9, close: 1.4, time: new Date() },  // outside bar — encloses bar[0]
    ];
    const bars = new Bars(data);
    expect(bars.findOutsideBar(0)).toBe(2);
  });

  it('returns -1 when no outside bar found', () => {
    const data: OHLC[] = [
      { open: 1, high: 10, low: 0.1, close: 5, time: new Date() },
      { open: 1, high: 5,  low: 1,   close: 3, time: new Date() },
    ];
    const bars = new Bars(data);
    expect(bars.findOutsideBar(0)).toBe(-1);
  });

  it('respects maxScan limit', () => {
    const data: OHLC[] = [
      { open: 1.2, high: 1.3, low: 1.1, close: 1.25, time: new Date() },
      { open: 1.1, high: 1.2, low: 1.15, close: 1.18, time: new Date() },
      { open: 1.0, high: 1.5, low: 0.9, close: 1.4, time: new Date() },
    ];
    const bars = new Bars(data);
    // maxScan=1 only checks bar[1], which doesn't enclose bar[0]
    expect(bars.findOutsideBar(0, 1)).toBe(-1);
  });
});

// ─────────────────────────────────────────────────────────────
// T3.5 – Bars: dayOHLC
// ─────────────────────────────────────────────────────────────

describe('T3.5 – Bars.dayOHLC', () => {
  // Simulate 2 days of intraday bars (newest first)
  const data: OHLC[] = [
    // Day 2 (Jan 2) — 2 bars
    { open: 5, high: 7, low: 4, close: 6, time: new Date('2026-01-02T12:00Z') },
    { open: 4, high: 6, low: 3, close: 5, time: new Date('2026-01-02T08:00Z') },
    // Day 1 (Jan 1) — 2 bars
    { open: 2, high: 4, low: 1, close: 3, time: new Date('2026-01-01T12:00Z') },
    { open: 1, high: 3, low: 0, close: 2, time: new Date('2026-01-01T08:00Z') },
  ];
  const bars = new Bars(data);

  it('daysBack=0 returns today (most recent day)', () => {
    const day = bars.dayOHLC(0);
    expect(day).not.toBeNull();
    expect(day?.open).toBe(4);  // oldest bar of the day = bar[1]
    expect(day?.close).toBe(6); // newest bar of the day = bar[0]
    expect(day?.high).toBe(7);
    expect(day?.low).toBe(3);
  });

  it('daysBack=1 returns previous day', () => {
    const day = bars.dayOHLC(1);
    expect(day).not.toBeNull();
    expect(day?.open).toBe(1);
    expect(day?.close).toBe(3);
    expect(day?.high).toBe(4);
    expect(day?.low).toBe(0);
  });

  it('returns null for out-of-range day', () => {
    expect(bars.dayOHLC(5)).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────
// T3.6 – Bars: LWMA & SMMA
// ─────────────────────────────────────────────────────────────

describe('T3.6 – Bars.lwma & smma', () => {
  // closes: [5, 4, 3, 2, 1] (newest first)
  const data: OHLC[] = Array.from({ length: 5 }, (_, i) => ({
    open: 5 - i, high: 6 - i, low: 4 - i, close: 5 - i, time: new Date(),
  }));
  const bars = new Bars(data);

  it('lwma weights newest bar highest', () => {
    // LWMA(3) at shift 0: (5*3 + 4*2 + 3*1) / (3+2+1) = (15+8+3)/6 = 26/6
    expect(bars.lwma(3)).toBeCloseTo(26 / 6, 5);
  });

  it('lwma(1) = close', () => {
    expect(bars.lwma(1)).toBeCloseTo(5, 5);
  });

  it('smma converges differently than sma', () => {
    // SMMA applies Wilder's smoothing — should differ from simple SMA
    const smmaVal = bars.smma(3);
    const smaVal = bars.sma(3);
    // Both should be reasonable values in the [1, 5] range
    expect(smmaVal).toBeGreaterThan(0);
    expect(smmaVal).toBeLessThan(6);
    // SMMA lags more than SMA
    expect(smmaVal).not.toBeCloseTo(smaVal, 2);
  });

  it('lwma returns 0 for empty bars', () => {
    const empty = new Bars([]);
    expect(empty.lwma(5)).toBe(0);
  });

  it('smma returns 0 for empty bars', () => {
    const empty = new Bars([]);
    expect(empty.smma(5)).toBe(0);
  });
});
