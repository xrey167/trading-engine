import { describe, it, expect, vi } from 'vitest';
import { calcTrailingSL, checkSLTP } from './trailing-stop.js';
import type { TrailState } from './trailing-stop.js';
import { Bar } from '../market-data/bar.js';
import { Bars } from '../market-data/bars.js';
import type { OHLC } from '../market-data/ohlc.js';
import { Side, TrailMode } from '../shared/domain/engine-enums.js';
import { SymbolInfoForex } from '../engine/core/symbol.js';
import { TradingEngine } from '../engine/core/trading-engine.js';
import type { IBrokerAdapter } from '../engine/core/trading-engine.js';

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

const EURUSD5 = new SymbolInfoForex('EURUSD', 5); // pointSize = 0.00001

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
// P7 – checkSLTP both-hit resolution
// ─────────────────────────────────────────────────────────────

describe('P7 – checkSLTP: both SL and TP hit on the same bar', () => {
  // MQL rule: Long → SL always wins; Short → TP always wins (conservative worst-case)
  it('Long position hitting both SL and TP → SL_BOTH (Long: SL always wins per MQL)', () => {
    // even bullish bar: high=1.111 >= tp=1.110; low=1.089 <= sl=1.090 — SL wins
    const bar = new Bar(1.099, 1.111, 1.089, 1.110, new Date());
    const result = checkSLTP({
      side: Side.Long, bar,
      sl: 1.090, tp: 1.110,
      slActive: true, tpActive: true, trailActive: false, spreadAbs: 0,
    });
    expect(result?.reason).toBe('SL_BOTH');
  });

  it('Short position hitting both SL and TP → TP_BOTH (Short: TP always wins per MQL)', () => {
    // high=1.111 >= sl=1.110 (short SL above entry); low=1.089 <= tp=1.090 (short TP below entry)
    const bar = new Bar(1.102, 1.111, 1.089, 1.095, new Date());
    const result = checkSLTP({
      side: Side.Short, bar,
      sl: 1.110, tp: 1.090,
      slActive: true, tpActive: true, trailActive: false, spreadAbs: 0,
    });
    expect(result?.reason).toBe('TP_BOTH');
  });
});

// ─────────────────────────────────────────────────────────────
// T5 – plhRef initial value: Infinity for Short
// ─────────────────────────────────────────────────────────────

describe('T5 – plhRef starts at Infinity for Short so trail fires on first bar', () => {
  it('Short PlhPeak trail: first bar updates plhRef (bar.low < Infinity is always true)', () => {
    // Use calcTrailingSL directly — it is exported and takes an explicit TrailState.
    const state: TrailState = { active: false, plhRef: Infinity };
    const bar = new Bar(1.1100, 1.1200, 1.0900, 1.1050, new Date());
    const sym = new SymbolInfoForex('EURUSD', 5);
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
// P15 – calcTrailingSL: TrailMode.Eop (Long)
// ─────────────────────────────────────────────────────────────

describe('P15 – calcTrailingSL TrailMode.Eop anchors SL below lowest-low', () => {
  it('Long Eop: SL = lowestLow(3) − distance', () => {
    // lows (newest first): 1.0960, 1.0950, 1.0940, 1.0930 → lowestLow(3) = 1.0940
    const bars = makeBars(
      [1.1000, 1.1000, 1.1000, 1.1000],
      [1.1010, 1.1010, 1.1010, 1.1010],
      [1.0960, 1.0950, 1.0940, 1.0930],
    );
    const bar = new Bar(1.1000, 1.1010, 1.0960, 1.1005, new Date());
    const state: TrailState = { active: false, plhRef: 0 };

    const sl = calcTrailingSL({
      side:          Side.Long,
      bar,
      bars,
      posPrice:      1.0900,   // opened lower, so bar.high > posPrice immediately
      currentSL:     -1,
      spreadAbs:     0,
      trailBeginPts: 0,
      trail:         { mode: TrailMode.Eop, distancePts: 5, periods: 3 },
      state,
      symbol:        EURUSD5,
    });

    // lowestLow(3) = 1.0940, dist = 5 × 0.00001 = 0.00005
    // expected SL = 1.0940 − 0.00005 = 1.09395
    expect(sl).toBeCloseTo(1.09395, 5);
    expect(state.active).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────
// P16 – calcTrailingSL: TrailMode.Ma (Long)
// ─────────────────────────────────────────────────────────────

describe('P16 – calcTrailingSL TrailMode.Ma anchors SL below SMA', () => {
  it('Long Ma: SL = sma(5) − distance', () => {
    // All closes = 1.1000 → sma(5) = 1.1000
    const bars = makeBars(Array(6).fill(1.1000));
    const bar = new Bar(1.1000, 1.1010, 1.0990, 1.1005, new Date());
    const state: TrailState = { active: false, plhRef: 0 };

    const sl = calcTrailingSL({
      side:          Side.Long,
      bar,
      bars,
      posPrice:      1.0900,
      currentSL:     -1,
      spreadAbs:     0,
      trailBeginPts: 0,
      trail:         { mode: TrailMode.Ma, distancePts: 100, periods: 5 },
      state,
      symbol:        EURUSD5,
    });

    // sma(5) = 1.1000, dist = 100 × 0.00001 = 0.00100
    // expected SL = 1.1000 − 0.00100 = 1.09900
    expect(sl).toBeCloseTo(1.09900, 5);
  });
});

// ─────────────────────────────────────────────────────────────
// P4 – onBar trailing stop (TrailMode.Dst) — engine-level tests
// ─────────────────────────────────────────────────────────────

describe('P4 – onBar: trailing stop (TrailMode.Dst)', () => {
  function makeSingleCandle(open: number, high: number, low: number, close: number): Bar {
    return new Bar(open, high, low, close, new Date('2024-01-02'));
  }

  it('trailing SL ratchets upward as bar.high advances', async () => {
    const broker = mockBroker(1.10000);
    const eng = new TradingEngine(EURUSD5, broker);
    await eng.buy();  // fill at 1.10000
    eng.trailModeBuy(TrailMode.Dst, 500);  // 500pt = 0.00500 distance
    eng.trailActivateBuy(true);
    // bar.high = 1.10300; bar.low = 1.10100 (above new SL of 1.09800 — no exit)
    const bar = makeSingleCandle(1.10100, 1.10300, 1.10100, 1.10200);
    await eng.onBar(bar, makeBars(Array(3).fill(1.102)));
    // newSL = 1.10300 − 500 × 0.00001 = 1.09800
    expect(eng.getSLBuy()).toBeCloseTo(1.10300 - 500 * 0.00001, 5);
    expect(eng.isLong()).toBe(true);
  });

  it('trailing SL fires when price subsequently drops below the trailed level', async () => {
    const broker = mockBroker(1.10000);
    const eng = new TradingEngine(EURUSD5, broker);
    await eng.buy();
    eng.trailModeBuy(TrailMode.Dst, 500);
    eng.trailActivateBuy(true);
    // Bar 1: sets trailing SL to 1.09800
    await eng.onBar(
      makeSingleCandle(1.10100, 1.10300, 1.10100, 1.10200),
      makeBars(Array(3).fill(1.102)),
    );
    expect(eng.isLong()).toBe(true);
    // Bar 2: bar.high < posPrice → trail frozen; bar.low=1.09700 < SL=1.09800 → fires
    await eng.onBar(
      makeSingleCandle(1.09900, 1.09900, 1.09700, 1.09750),
      makeBars(Array(3).fill(1.099)),
    );
    expect(broker.closePosition).toHaveBeenCalledWith(Side.Long, 1, 'SL');
    expect(eng.isLong()).toBe(false);
  });
});
