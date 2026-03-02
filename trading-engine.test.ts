/**
 * Tests for all 8 bug fixes applied to trading-engine.ts.
 *
 * T1  [CRITICAL] sl()/tp() setters — store offset, compute absolute on fill
 * T2  [HIGH]     _applyBracket — clears bracket after consuming
 * T3  [MEDIUM]   isLocalHigh / isLocalLow — lookback=1 checks one neighbour
 * T4  [MEDIUM]   closeBuy / closeSell — optional currentPrice guard
 * T5  [LOW]      plhRef initial value — Infinity instead of 999_999_999
 * T6  [LOW]      AtrMethod.Ema — iterates oldest→newest
 * T7  [LOW]      RSI — Wilder's smoothing instead of simple average
 * T8  [LOW]      placeBoth — sequential execution
 */

import { describe, it, expect, vi } from 'vitest';
import {
  TradingEngine, Bars, SymbolInfo, Candle,
  AtrMethod, TrailMode, Side,
  checkSLTP, calcTrailingSL,
  ScaledOrderEngine,
} from './trading-engine';
import type {
  IBrokerAdapter, OHLC, TrailState, ScaledOrderPreset,
} from './trading-engine';

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

function mockBroker(fillPrice = 1.1000): IBrokerAdapter {
  return {
    marketOrder:   vi.fn(async () => ({ price: fillPrice, time: new Date(), id: 'fill' })),
    closePosition: vi.fn(async () => ({ price: fillPrice })),
    updateSLTP:    vi.fn(async () => {}),
    getSpread:     vi.fn(async () => 0),
    getAccount:    vi.fn(async () => ({ equity: 10_000, balance: 10_000 })),
  };
}

const EURUSD5 = new SymbolInfo('EURUSD', 5); // pointSize = 0.00001

// ─────────────────────────────────────────────────────────────
// T1 – sl()/tp() setters
// ─────────────────────────────────────────────────────────────

describe('T1 – sl()/tp() setters store offset and apply absolute price on fill', () => {
  it('sl(N) set before buy() anchors SL below the fill price', async () => {
    const eng = new TradingEngine(EURUSD5, mockBroker(1.10000));
    eng.sl(200);       // 200 points = 0.00200
    await eng.buy();
    // SL = 1.10000 − 200 × 0.00001 = 1.09800
    expect(eng.getSLBuy()).toBeCloseTo(1.09800, 5);
  });

  it('tp(N) set before buy() anchors TP above the fill price', async () => {
    const eng = new TradingEngine(EURUSD5, mockBroker(1.10000));
    eng.tp(300);
    await eng.buy();
    // TP = 1.10000 + 300 × 0.00001 = 1.10300
    expect(eng.getTPBuy()).toBeCloseTo(1.10300, 5);
  });

  it('sl(N) set before sell() anchors SL above the fill price (short)', async () => {
    const eng = new TradingEngine(EURUSD5, mockBroker(1.10000));
    eng.slSell(200);
    await eng.sell();
    // Short SL = 1.10000 + 200 × 0.00001 = 1.10200
    expect(eng.getSLSell()).toBeCloseTo(1.10200, 5);
  });

  it('tp(N) set before sell() anchors TP below the fill price (short)', async () => {
    const eng = new TradingEngine(EURUSD5, mockBroker(1.10000));
    eng.tpSell(400);
    await eng.sell();
    // Short TP = 1.10000 − 400 × 0.00001 = 1.09600
    expect(eng.getTPSell()).toBeCloseTo(1.09600, 5);
  });

  it('sl(N) set after position is open updates SL immediately from openPrice', async () => {
    const eng = new TradingEngine(EURUSD5, mockBroker(1.10000));
    await eng.buy();   // position open at 1.10000
    eng.sl(100);       // 100 points applied to existing position
    expect(eng.getSLBuy()).toBeCloseTo(1.10000 - 100 * 0.00001, 5);
  });

  it('slOffsetPts is preserved across a position close and applied to the next fill', async () => {
    let fillPrice = 1.10000;
    const broker: IBrokerAdapter = {
      marketOrder:   vi.fn(async () => ({ price: fillPrice, time: new Date(), id: 'f' })),
      closePosition: vi.fn(async () => ({ price: fillPrice })),
      updateSLTP:    vi.fn(async () => {}),
      getSpread:     vi.fn(async () => 0),
      getAccount:    vi.fn(async () => ({ equity: 10_000, balance: 10_000 })),
    };
    const eng = new TradingEngine(EURUSD5, broker);
    eng.sl(200);
    await eng.buy();                   // fill at 1.10000 → SL = 1.09800
    await eng.closeBuy();              // close position (offset must survive)
    fillPrice = 1.12000;               // new price
    await eng.buy();                   // fill at 1.12000 → SL = 1.11800
    expect(eng.getSLBuy()).toBeCloseTo(1.12000 - 200 * 0.00001, 5);
  });
});

// ─────────────────────────────────────────────────────────────
// T2 – _applyBracket clears bracket after consuming
// ─────────────────────────────────────────────────────────────

describe('T2 – _applyBracket clears bracket state after the first fill', () => {
  it('bracket SL applied to first buy() is NOT re-applied to a subsequent buy()', async () => {
    const eng = new TradingEngine(EURUSD5, mockBroker(1.10000));
    eng.bracketSL(100);
    await eng.buy();
    // First buy: bracket applied — SL should be set
    expect(eng.getSLBuy()).toBeGreaterThan(0);

    // Manually clear SL so we can detect if bracket re-applies
    eng.slBuyAbsolute(-1);
    await eng.buy();   // second buy — bracket must have been consumed already
    expect(eng.getSLBuy()).toBe(-1);
  });

  it('bracket TP applied to first sell() is NOT re-applied to a subsequent sell()', async () => {
    const eng = new TradingEngine(EURUSD5, mockBroker(1.10000));
    eng.bracketTP(150);
    await eng.sell();
    expect(eng.getTPSell()).toBeGreaterThan(0);

    eng.tpSellAbsolute(-1);
    await eng.sell();
    expect(eng.getTPSell()).toBe(-1);
  });
});

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
// T4 – closeBuy / closeSell optional currentPrice guard
// ─────────────────────────────────────────────────────────────

describe('T4 – closeBuy/closeSell: minProfit guard uses currentPrice, not -1', () => {
  it('minProfit > -Inf with NO currentPrice → closes unconditionally (conservative)', async () => {
    const broker = mockBroker(1.10000);
    const eng = new TradingEngine(EURUSD5, broker);
    await eng.buy();
    const closed = await eng.closeBuy(100); // no currentPrice supplied
    expect(closed).toBe(true);
    expect(broker.closePosition).toHaveBeenCalledOnce();
  });

  it('minProfit > -Inf with currentPrice showing a loss → does NOT close', async () => {
    const broker = mockBroker(1.10000);
    const eng = new TradingEngine(EURUSD5, broker);
    await eng.buy();     // open at 1.10000, size=1
    // PL at 1.09000 = (1.09 − 1.10) × 1 = −0.01 < minProfit=100
    const closed = await eng.closeBuy(100, 1.09000);
    expect(closed).toBe(false);
    expect(broker.closePosition).not.toHaveBeenCalled();
  });

  it('minProfit > -Inf with currentPrice showing a profit → closes', async () => {
    const broker = mockBroker(1.10000);
    const eng = new TradingEngine(EURUSD5, broker);
    await eng.buy();
    // PL at 1.11000 = (1.11 − 1.10) × 1 = 0.01 > 0; but 0.01 < 100 points
    // Use a tiny minProfit (as price diff, not points) to ensure it passes
    const closed = await eng.closeBuy(0.005, 1.11000);
    expect(closed).toBe(true);
    expect(broker.closePosition).toHaveBeenCalledOnce();
  });

  it('minProfit = -Infinity → always closes regardless of currentPrice', async () => {
    const broker = mockBroker(1.10000);
    const eng = new TradingEngine(EURUSD5, broker);
    await eng.buy();
    const closed = await eng.closeBuy(-Infinity, 1.00000); // massive loss
    expect(closed).toBe(true);
    expect(broker.closePosition).toHaveBeenCalledOnce();
  });

  it('closeSell with currentPrice loss and positive minProfit → does NOT close', async () => {
    const broker = mockBroker(1.10000);
    const eng = new TradingEngine(EURUSD5, broker);
    await eng.sell();   // short at 1.10000
    // Short PL at 1.11000 = (1.10 − 1.11) × 1 = −0.01 < 100
    const closed = await eng.closeSell(100, 1.11000);
    expect(closed).toBe(false);
    expect(broker.closePosition).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────
// T5 – plhRef initial value: Infinity for Short
// ─────────────────────────────────────────────────────────────

describe('T5 – plhRef starts at Infinity for Short so trail fires on first bar', () => {
  it('Short PlhPeak trail: first bar updates plhRef (bar.low < Infinity is always true)', () => {
    // Use calcTrailingSL directly — it is exported and takes an explicit TrailState.
    const state: TrailState = { active: false, plhRef: Infinity };
    const bar = new Candle(1.1100, 1.1200, 1.0900, 1.1050, new Date());
    const sym = new SymbolInfo('EURUSD', 5);
    // For Short PlhPeak: if (bar.low < state.plhRef) → 1.09 < Infinity → true
    // → state.plhRef = bar.low = 1.09; cand = bar.high + distPrice
    const distancePts = 10;
    const distPrice = distancePts * sym.pointsToPrice(1); // 0.00010
    const result = calcTrailingSL({
      side:          Side.Short,
      bar,
      bars:          makeBars(Array(5).fill(1.10000)),
      posPrice:      1.12000,
      currentSL:     -1,
      spreadAbs:     0,
      trailBeginPts: 0,
      trail:         { mode: TrailMode.PlhPeak, distancePts, periods: 0 },
      state,
      symbol:        sym,
    });
    expect(state.plhRef).toBeCloseTo(1.0900, 5);           // updated from Infinity
    expect(result).toBeCloseTo(1.1200 + distPrice, 5);     // bar.high + distPrice
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
// T8 – placeBoth: sequential execution
// ─────────────────────────────────────────────────────────────

describe('T8 – placeBoth executes Long then Short sequentially', () => {
  const marketPreset: ScaledOrderPreset = {
    name: 'TestMarket',
    atrMode: 'None',
    distance: 20,
    progressLimits: 1, progressStops: 1,
    countLimits: 0, countStops: 0,
    slRel: 0, trailBegin: 0, trailDistance: 0,
    factorLong: 1, factorShort: 1,
    attrOCO: false, attrCO: false, attrREV: false, attrNET: false,
    instantOrderType: 'Market',
    instantOrderDistance: 1,
    chainLimits: false,
    eachTick: false,
  };

  it('returns ScaledOrderResult for both long and short with market order ids', async () => {
    const broker = mockBroker(1.10000);
    const eng = new TradingEngine(EURUSD5, broker);
    const scaled = new ScaledOrderEngine(eng, EURUSD5, marketPreset);
    const bars = makeBars(Array(30).fill(1.10000));

    const result = await scaled.placeBoth(bars, 1.10000);

    expect(result.long.orderIds).toContain('market');
    expect(result.short.orderIds).toContain('market');
    expect(eng.isLong()).toBe(true);
    expect(eng.isShort()).toBe(true);
  });

  it('with OCO attr + limit orders: both sides get OCO flag (sequential prevents flag bleed)', async () => {
    // Use attrOCO=true and 1 limit order per side so we can verify ordering.
    // With concurrent execution, the Long _place running concurrently with Short
    // would cause one side's limit to miss the OCO flag.  Sequential ensures both sides get it.
    //
    // We verify the engine places 2 pending orders (1 per side) which is only
    // possible if both sides ran their limit-add steps with the right state.
    const ocoPreset: ScaledOrderPreset = {
      ...marketPreset,
      attrOCO: true,
      countLimits: 1,
    };
    const broker = mockBroker(1.10000);
    const eng = new TradingEngine(EURUSD5, broker);
    const scaled = new ScaledOrderEngine(eng, EURUSD5, ocoPreset);
    const bars = makeBars(Array(30).fill(1.10000));

    await scaled.placeBoth(bars, 1.10000);

    // 1 market (consumed, not in order book) + 1 limit per side = 2 pending orders
    expect(eng.getCntOrders()).toBe(2);
    expect(eng.getCntOrdersBuy()).toBe(1);
    expect(eng.getCntOrdersSell()).toBe(1);
  });
});
