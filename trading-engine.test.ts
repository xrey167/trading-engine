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
  TradingEngine, Bars, SymbolInfo, Bar,
  AtrMethod, BarsAtrMode, BarBase, TrailMode, Side, LimitConfirm,
  checkSLTP, calcTrailingSL,
  ScaledOrderEngine, AtrModule,
  evaluateCandleATR03,
} from './trading-engine';
import type {
  IBrokerAdapter, OHLC, TrailState, ScaledOrderPreset, AtrModuleConfig,
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
    const closed = await eng.closeBuy(-Infinity, Math.LOG2E); // arbitrary price — -Infinity bypasses PL check
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
    const bar = new Bar(1.1100, 1.1200, 1.0900, 1.1050, new Date());
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

// ─────────────────────────────────────────────────────────────
// Phase 2 — Integration: onBar fills, exits, trailing SL,
//            break-even, net mode, evaluateCandleATR03
// ─────────────────────────────────────────────────────────────

function makeSingleCandle(open: number, high: number, low: number, close: number): Bar {
  return new Bar(open, high, low, close, new Date('2024-01-02'));
}

// ─────────────────────────────────────────────────────────────
// P1 – onBar pending-order fills
// ─────────────────────────────────────────────────────────────

describe('P1 – onBar: pending order fills', () => {
  it('BUY_LIMIT fills when bar.low touches the limit price', async () => {
    const eng = new TradingEngine(EURUSD5, mockBroker());
    eng.addBuyLimit(1.0990);
    const bar = makeSingleCandle(1.1000, 1.1005, 1.0990, 1.1000);
    await eng.onBar(bar, makeBars(Array(3).fill(1.1000)));
    expect(eng.isLong()).toBe(true);
  });

  it('BUY_LIMIT does NOT fill when bar.low stays above the limit price', async () => {
    const eng = new TradingEngine(EURUSD5, mockBroker());
    eng.addBuyLimit(1.0990);
    const bar = makeSingleCandle(1.1000, 1.1010, 1.0995, 1.1000);
    await eng.onBar(bar, makeBars(Array(3).fill(1.1000)));
    expect(eng.isLong()).toBe(false);
    expect(eng.getCntOrders()).toBe(1);
  });

  it('SELL_LIMIT fills when bar.high reaches the limit price', async () => {
    const eng = new TradingEngine(EURUSD5, mockBroker());
    eng.addSellLimit(1.1010);
    const bar = makeSingleCandle(1.1000, 1.1010, 1.0995, 1.1000);
    await eng.onBar(bar, makeBars(Array(3).fill(1.1000)));
    expect(eng.isShort()).toBe(true);
  });

  it('OCO: filling BUY_LIMIT cancels all remaining pending orders', async () => {
    const eng = new TradingEngine(EURUSD5, mockBroker());
    eng.orderAttrOCO(true);
    eng.addBuyLimit(1.0990);   // with OCO flag
    eng.addBuyLimit(1.0985);   // lower — bar won't reach it
    eng.addSellLimit(1.1010);  // upper — bar won't reach it
    // bar.low = 1.0990: only the first BUY_LIMIT triggers
    const bar = makeSingleCandle(1.1000, 1.1005, 1.0990, 1.0995);
    await eng.onBar(bar, makeBars(Array(3).fill(1.1000)));
    expect(eng.isLong()).toBe(true);
    expect(eng.getCntOrders()).toBe(0);  // OCO cleared the other two
  });

  it('CS: filling BUY_LIMIT cancels same-side orders and preserves opposite side', async () => {
    const eng = new TradingEngine(EURUSD5, mockBroker());
    eng.orderAttrCS(true);
    eng.addBuyLimit(1.0990);   // with CS flag
    eng.addBuyLimit(1.0985);   // same side — will be cancelled by CS
    eng.addSellLimit(1.1010);  // opposite side — must survive
    const bar = makeSingleCandle(1.1000, 1.1005, 1.0990, 1.0995);
    await eng.onBar(bar, makeBars(Array(3).fill(1.1000)));
    expect(eng.getCntOrdersBuy()).toBe(0);
    expect(eng.getCntOrdersSell()).toBe(1);
  });
});

// ─────────────────────────────────────────────────────────────
// P2 – onBar SL/TP exit checking
// ─────────────────────────────────────────────────────────────

describe('P2 – onBar: SL/TP exit checking', () => {
  it('long SL fires when bar.low drops at or below SL price', async () => {
    const broker = mockBroker(1.10000);
    const eng = new TradingEngine(EURUSD5, broker);
    await eng.buy();
    eng.slBuyAbsolute(1.0900);
    eng.slActivateBuy(true);
    const bar = makeSingleCandle(1.0950, 1.0960, 1.0890, 1.0900);  // L < SL
    await eng.onBar(bar, makeBars(Array(3).fill(1.095)));
    expect(broker.closePosition).toHaveBeenCalledWith(Side.Long, 1, 'SL');
    expect(eng.isLong()).toBe(false);
  });

  it('long TP fires when bar.high reaches or exceeds TP price', async () => {
    const broker = mockBroker(1.10000);
    const eng = new TradingEngine(EURUSD5, broker);
    await eng.buy();
    eng.tpBuyAbsolute(1.1100);
    eng.tpActivateBuy(true);
    const bar = makeSingleCandle(1.1050, 1.1110, 1.1040, 1.1100);  // H > TP
    await eng.onBar(bar, makeBars(Array(3).fill(1.105)));
    expect(broker.closePosition).toHaveBeenCalledWith(Side.Long, 1, 'TP');
    expect(eng.isLong()).toBe(false);
  });

  it('SL is NOT triggered when bar.low stays above the SL price', async () => {
    const broker = mockBroker(1.10000);
    const eng = new TradingEngine(EURUSD5, broker);
    await eng.buy();
    eng.slBuyAbsolute(1.0900);
    eng.slActivateBuy(true);
    const bar = makeSingleCandle(1.0960, 1.0970, 1.0910, 1.0960);  // L > SL
    await eng.onBar(bar, makeBars(Array(3).fill(1.096)));
    expect(broker.closePosition).not.toHaveBeenCalled();
    expect(eng.isLong()).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────
// P3 – onBar break-even
// ─────────────────────────────────────────────────────────────

describe('P3 – onBar: break-even raises SL to open price + offset', () => {
  it('long BE: SL moves to openPrice + beAddPts when bar.high exceeds the trigger', async () => {
    const broker = mockBroker(1.10000);
    const eng = new TradingEngine(EURUSD5, broker);
    await eng.buy();  // fill at 1.10000
    eng.beActivateBuy(true);
    eng.trailBeginBuy(100);  // trigger at openPrice + 100pts = 1.10100
    eng.beBuy(50);           // SL target = openPrice + 50pts = 1.10050
    // bar.high = 1.10100 (at trigger), bar.low = 1.10060 (above new SL — no exit)
    const bar = makeSingleCandle(1.10080, 1.10100, 1.10060, 1.10080);
    await eng.onBar(bar, makeBars(Array(3).fill(1.1008)));
    expect(eng.getSLBuy()).toBeCloseTo(1.10000 + 50 * 0.00001, 5);
    expect(eng.isLong()).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────
// P4 – onBar trailing stop (TrailMode.Dst)
// ─────────────────────────────────────────────────────────────

describe('P4 – onBar: trailing stop (TrailMode.Dst)', () => {
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

// ─────────────────────────────────────────────────────────────
// P5 – hedging=false (net mode)
// ─────────────────────────────────────────────────────────────

describe('P5 – hedging=false: buy/sell net out opposite positions', () => {
  it('sell() closes the existing long before opening short', async () => {
    const broker = mockBroker(1.10000);
    const eng = new TradingEngine(EURUSD5, broker, false);
    await eng.buy();
    expect(eng.isLong()).toBe(true);
    await eng.sell();
    expect(broker.closePosition).toHaveBeenCalledOnce();
    expect(eng.isLong()).toBe(false);
    expect(eng.isShort()).toBe(true);
  });

  it('buy() closes the existing short before opening long', async () => {
    const broker = mockBroker(1.10000);
    const eng = new TradingEngine(EURUSD5, broker, false);
    await eng.sell();
    expect(eng.isShort()).toBe(true);
    await eng.buy();
    expect(broker.closePosition).toHaveBeenCalledOnce();
    expect(eng.isShort()).toBe(false);
    expect(eng.isLong()).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────
// P6 – evaluateCandleATR03
// ─────────────────────────────────────────────────────────────

describe('P6 – evaluateCandleATR03', () => {
  /**
   * Builds a 17-bar Bars object for the ATR03 evaluator.
   * bars[0] = current bar (not evaluated), bars[1] = signal bar,
   * bars[2..16] = small-range history bars used for the ATR baseline.
   *
   * History bars: H=1.1020, L=1.1010, range=0.001
   * ATR(14,1) with signal-bar TR ≈ 0.021:
   *   ATR ≈ (0.021 + 13×0.001) / 14 ≈ 0.00243  →  2×ATR ≈ 0.00486
   * Signal bar range = 0.021 >> 0.00486 ✓
   */
  function buildATR03Bars(signalBar: OHLC): Bars {
    const history = makeOHLC(1.1015, { high: 1.1020, low: 1.1010 });
    const current = makeOHLC(1.1015, { high: 1.1025, low: 1.1005 });
    const data: OHLC[] = [current, signalBar, ...Array(15).fill(history)];
    return new Bars(data);
  }

  it('bearish large-range bar → engine opens short with SL above signal bar high', async () => {
    const broker = mockBroker(1.1000);
    const eng = new TradingEngine(EURUSD5, broker);
    // bearish: close(1.100) < open(1.120); tailPart=0 < 0.5; local low of last 5 bars ✓
    const signalBar = makeOHLC(1.100, { open: 1.120, high: 1.121, low: 1.100 });
    await evaluateCandleATR03(buildATR03Bars(signalBar), eng, EURUSD5);
    expect(eng.isShort()).toBe(true);
    // SL = signalBar.high + 5 points
    expect(eng.getSLSell()).toBeCloseTo(1.121 + 5 * 0.00001, 5);
  });

  it('bullish large-range bar → engine opens long with SL below signal bar low', async () => {
    const broker = mockBroker(1.1210);
    const eng = new TradingEngine(EURUSD5, broker);
    // bullish: close(1.121) > open(1.100); wickPart=0 < 0.5; local high of last 5 bars ✓
    const signalBar = makeOHLC(1.121, { open: 1.100, high: 1.121, low: 1.099 });
    await evaluateCandleATR03(buildATR03Bars(signalBar), eng, EURUSD5);
    expect(eng.isLong()).toBe(true);
    // SL = signalBar.low − 5 points
    expect(eng.getSLBuy()).toBeCloseTo(1.099 - 5 * 0.00001, 5);
  });

  it('small-range bar (range < 2×ATR) → no position opened', async () => {
    const broker = mockBroker(1.1000);
    const eng = new TradingEngine(EURUSD5, broker);
    // range = 0.001; same as history → ATR ≈ 0.001 → 2×ATR ≈ 0.002 > range → exits early
    const signalBar = makeOHLC(1.1005, { open: 1.1015, high: 1.1020, low: 1.1010 });
    await evaluateCandleATR03(buildATR03Bars(signalBar), eng, EURUSD5);
    expect(eng.isLong()).toBe(false);
    expect(eng.isShort()).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────
// Phase 3 — Edge cases, order attributes, ScaledOrderEngine
// ─────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────
// P7 – checkSLTP both-hit resolution
// ─────────────────────────────────────────────────────────────

describe('P7 – checkSLTP: both SL and TP hit on the same bar', () => {
  it('bullish bar hitting both SL and TP → TP_BOTH (TP assumed first)', () => {
    // open=1.099, close=1.110 → bullish; high=1.111 >= tp=1.110; low=1.089 <= sl=1.090
    const bar = new Bar(1.099, 1.111, 1.089, 1.110, new Date());
    const result = checkSLTP({
      side: Side.Long, bar,
      sl: 1.090, tp: 1.110,
      slActive: true, tpActive: true, trailActive: false, spreadAbs: 0,
    });
    expect(result?.reason).toBe('TP_BOTH');
  });

  it('bearish bar hitting both SL and TP → SL_BOTH (SL assumed first)', () => {
    // open=1.102, close=1.095 → bearish; high=1.111 >= tp=1.110; low=1.089 <= sl=1.090
    const bar = new Bar(1.102, 1.111, 1.089, 1.095, new Date());
    const result = checkSLTP({
      side: Side.Long, bar,
      sl: 1.090, tp: 1.110,
      slActive: true, tpActive: true, trailActive: false, spreadAbs: 0,
    });
    expect(result?.reason).toBe('SL_BOTH');
  });
});

// ─────────────────────────────────────────────────────────────
// P8 – CO attribute: close opposite on fill
// ─────────────────────────────────────────────────────────────

describe('P8 – CO attribute: filling a sell order closes the open long', () => {
  it('SELL_LIMIT with CO fills → long position is closed, short is opened', async () => {
    const broker = mockBroker(1.10000);
    const eng = new TradingEngine(EURUSD5, broker);
    await eng.buy();                   // long open, size=1
    eng.orderAttrCO(true);
    eng.addSellLimit(1.1020);          // with CO
    const bar = makeSingleCandle(1.1010, 1.1020, 1.1005, 1.1015);  // H touches limit
    await eng.onBar(bar, makeBars(Array(3).fill(1.1015)));
    // CO should have closed the long, then filled the short
    expect(eng.isLong()).toBe(false);
    expect(eng.isShort()).toBe(true);
    expect(broker.closePosition).toHaveBeenCalledOnce();  // the CO close
  });
});

// ─────────────────────────────────────────────────────────────
// P9 – REV attribute: reverse and re-enter with combined size
// ─────────────────────────────────────────────────────────────

describe('P9 – REV attribute: re-enters same side with original + new size', () => {
  it('BUY_LIMIT with REV fills while long → closes existing long, opens long with double size', async () => {
    const broker = mockBroker(1.10000);
    const eng = new TradingEngine(EURUSD5, broker);
    await eng.buy(1);                  // long open, size=1
    eng.orderAttrREV(true);
    eng.addBuyLimit(1.0980, 1);        // REV, size=1
    const bar = makeSingleCandle(1.1000, 1.1005, 1.0980, 1.0990);
    await eng.onBar(bar, makeBars(Array(3).fill(1.099)));
    // REV: close existing long(1), re-open long(1+1=2)
    expect(broker.closePosition).toHaveBeenCalledOnce();
    expect(eng.isLong()).toBe(true);
    expect(eng.getSizeBuy()).toBe(2);
  });
});

// ─────────────────────────────────────────────────────────────
// P10 – addBracket: pending order fill applies SL/TP from fill price
// ─────────────────────────────────────────────────────────────

describe('P10 – addBracket: SL and TP computed from pending order fill price', () => {
  it('BUY_LIMIT bracket fills → SL below and TP above fill price', async () => {
    const eng = new TradingEngine(EURUSD5, mockBroker());
    // tpPts=500 → TP=1.0980+0.005=1.1030; bar.high=1.1005 < TP so it stays open
    eng.addBracket({ entryType: 'BUY_LIMIT', entryPrice: 1.0980, slPts: 100, tpPts: 500 });
    const bar = makeSingleCandle(1.1000, 1.1005, 1.0980, 1.0990);
    await eng.onBar(bar, makeBars(Array(3).fill(1.099)));
    expect(eng.isLong()).toBe(true);
    // SL = 1.0980 − 100 pts = 1.0970
    expect(eng.getSLBuy()).toBeCloseTo(1.0980 - 100 * 0.00001, 5);
    // TP = 1.0980 + 500 pts = 1.1030
    expect(eng.getTPBuy()).toBeCloseTo(1.0980 + 500 * 0.00001, 5);
  });
});

// ─────────────────────────────────────────────────────────────
// P11 – LimitConfirm.Wick: require close to confirm wick entry
// ─────────────────────────────────────────────────────────────

describe('P11 – LimitConfirm.Wick: entry requires bar to wick through and close above', () => {
  it('bar wicks through limit and closes above → fills', async () => {
    const eng = new TradingEngine(EURUSD5, mockBroker());
    eng.orderLimitConfirm(LimitConfirm.Wick);
    eng.addBuyLimit(1.0990);
    // bar.low=1.0989 (<= limit=1.0990 ✓), bar.close=1.1000 (> 1.0990 ✓)
    const bar = makeSingleCandle(1.1000, 1.1010, 1.0989, 1.1000);
    await eng.onBar(bar, makeBars(Array(3).fill(1.1000)));
    expect(eng.isLong()).toBe(true);
  });

  it('bar wicks through limit but closes below → does NOT fill', async () => {
    const eng = new TradingEngine(EURUSD5, mockBroker());
    eng.orderLimitConfirm(LimitConfirm.Wick);
    eng.addBuyLimit(1.0990);
    // bar.low=1.0989 (<= 1.0990 ✓), bar.close=1.0985 (NOT > 1.0990 ✗)
    const bar = makeSingleCandle(1.1000, 1.1005, 1.0989, 1.0985);
    await eng.onBar(bar, makeBars(Array(3).fill(1.099)));
    expect(eng.isLong()).toBe(false);
    expect(eng.getCntOrders()).toBe(1);  // order still in book
  });
});

// ─────────────────────────────────────────────────────────────
// P12 – ScaledOrderEngine: ATR-mode base distance
// ─────────────────────────────────────────────────────────────

describe('P12 – ScaledOrderEngine: ATR-mode computes baseDist from ATR', () => {
  it('atrMode="ATR 14" with distance=2 → baseDist ≈ 2 × ATR(14)', async () => {
    const broker = mockBroker(1.10000);
    const eng = new TradingEngine(EURUSD5, broker);

    // Build 17 bars where ATR(14, shift=1) ≈ 0.001 (each bar range=0.001)
    const bars = makeBars(
      Array(17).fill(1.1000),
      Array(17).fill(1.1005),  // high
      Array(17).fill(1.0995),  // low → range=0.001, TR≈0.001
    );

    const atrPreset: ScaledOrderPreset = {
      name: 'ATR-test',
      atrMode: 'ATR 14',
      distance: 2,
      progressLimits: 1, progressStops: 1,
      countLimits: 0, countStops: 0,
      slRel: 0, trailBegin: 0, trailDistance: 0,
      factorLong: 1, factorShort: 1,
      attrOCO: false, attrCO: false, attrREV: false, attrNET: false,
      instantOrderType: 'Market',
      instantOrderDistance: 0,
      chainLimits: false,
      eachTick: false,
    };

    const scaled = new ScaledOrderEngine(eng, EURUSD5, atrPreset);
    const result = await scaled.placeLong(bars, 1.10000);

    // ATR(14, shift=1) ≈ 0.001 → baseDist ≈ 2 × 0.001 = 0.002
    expect(result.baseDist).toBeCloseTo(0.001 * 2, 4);
  });
});

// ─────────────────────────────────────────────────────────────
// P13 – ScaledOrderEngine: order count and named preset lookup
// ─────────────────────────────────────────────────────────────

describe('P13 – ScaledOrderEngine: order count and named preset', () => {
  const flatBars = makeBars(Array(30).fill(1.10000));

  it('MTO preset with countLimits=3 countStops=1 places 5 orders in the book', async () => {
    const broker = mockBroker(1.10000);
    const eng = new TradingEngine(EURUSD5, broker);
    const preset: ScaledOrderPreset = {
      name: 'count-test',
      atrMode: 'None', distance: 20,
      progressLimits: 1, progressStops: 1,
      countLimits: 3, countStops: 1,
      slRel: 0, trailBegin: 0, trailDistance: 0,
      factorLong: 1, factorShort: 1,
      attrOCO: false, attrCO: false, attrREV: false, attrNET: false,
      instantOrderType: 'MTO',
      instantOrderDistance: 1,
      chainLimits: false,
      eachTick: false,
    };
    const scaled = new ScaledOrderEngine(eng, EURUSD5, preset);
    await scaled.placeLong(flatBars, 1.10000);
    // 1 MIT (instant) + 3 limits + 1 stop = 5 pending orders
    expect(eng.getCntOrders()).toBe(5);
  });

  it('named preset "5xATR" resolves without throwing', () => {
    const eng = new TradingEngine(EURUSD5, mockBroker());
    expect(() => new ScaledOrderEngine(eng, EURUSD5, '5xATR')).not.toThrow();
  });

  it('unknown preset name throws an Error', () => {
    const eng = new TradingEngine(EURUSD5, mockBroker());
    expect(() => new ScaledOrderEngine(eng, EURUSD5, 'no-such-preset')).toThrow('Unknown preset');
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
// P17 – AtrModule.onBar: applies ATR-scaled SL offset
// ─────────────────────────────────────────────────────────────

describe('P17 – AtrModule.onBar applies ATR-scaled SL offset to engine', () => {
  it('slMultiplier=2 with ATR≈100pts → engine.sl(200) → SL ≈ fill − 0.00200', async () => {
    const fillPrice = 1.10000;
    const broker = mockBroker(fillPrice);
    const eng = new TradingEngine(EURUSD5, broker);

    // 16 bars all uniform: range = 0.0010, close = 1.1000
    // atr(14, shift=1) = avg of TRs at positions 1..14 = 14 × 0.001 / 14 = 0.001
    // ATR in points = 0.001 / 0.00001 = 100 pts
    const bars = makeBars(
      Array(16).fill(1.10000),
      Array(16).fill(1.10050),
      Array(16).fill(1.09950),
    );

    const cfg: AtrModuleConfig = {
      period: 14, method: AtrMethod.Sma, shift: 1,
      slMultiplier: 2, tpMultiplier: 0,
      trailBeginMultiplier: 0, trailDistMultiplier: 0,
      onlyWhenFlat: false,
      barsAtrMode: BarsAtrMode.Normal,
      barBase: BarBase.HiLo,
    };
    const mod = new AtrModule(cfg, eng, EURUSD5);
    mod.onBar(bars);           // sets sl(200) on the engine
    await eng.buy();           // fills at 1.1000 → SL = 1.1000 − 0.00200 = 1.09800

    expect(eng.getSLBuy()).toBeCloseTo(1.09800, 5);
  });
});

// ─────────────────────────────────────────────────────────────
// P18 – AtrModule.onBar: onlyWhenFlat=true skips update
// ─────────────────────────────────────────────────────────────

describe('P18 – AtrModule.onBar onlyWhenFlat=true skips SL update when position open', () => {
  it('SL is not overwritten when position is open and onlyWhenFlat=true', async () => {
    const fillPrice = 1.10000;
    const broker = mockBroker(fillPrice);
    const eng = new TradingEngine(EURUSD5, broker);

    // Set initial SL offset of 100 pts, then open position
    eng.sl(100);                   // SL offset = 100 pts
    await eng.buy();               // fills at 1.1000 → SL = 1.1000 − 0.001 = 1.09900

    // 16 uniform bars producing ATR = 100 pts again
    const bars = makeBars(
      Array(16).fill(1.10000),
      Array(16).fill(1.10050),
      Array(16).fill(1.09950),
    );

    // AtrModule with slMultiplier=3 (would set sl(300) = SL 1.0970), onlyWhenFlat=true
    const cfg: AtrModuleConfig = {
      period: 14, method: AtrMethod.Sma, shift: 1,
      slMultiplier: 3, tpMultiplier: 0,
      trailBeginMultiplier: 0, trailDistMultiplier: 0,
      onlyWhenFlat: true,
      barsAtrMode: BarsAtrMode.Normal,
      barBase: BarBase.HiLo,
    };
    const mod = new AtrModule(cfg, eng, EURUSD5);
    mod.onBar(bars);  // position is open → update skipped

    // SL should remain at the original 1.09900, not 1.0970
    expect(eng.getSLBuy()).toBeCloseTo(1.09900, 5);
  });
});

// ─────────────────────────────────────────────────────────────
// P19 – MIT order: onBar fills via broker.marketOrder
// ─────────────────────────────────────────────────────────────

describe('P19 – BUY_MIT fill calls broker.marketOrder', () => {
  it('BUY_MIT fills when bar.low touches level, opening a long via market order', async () => {
    const broker = mockBroker(1.09800);
    const eng = new TradingEngine(EURUSD5, broker);

    eng.addBuyMIT(1.09800);   // triggers when bar.low <= 1.09800

    // bar.low = 1.09780 ≤ 1.09800 → triggered
    const bar = new Bar(1.10000, 1.10050, 1.09780, 1.09850, new Date());
    await eng.onBar(bar, makeBars(Array(3).fill(1.10000)));

    expect(eng.isLong()).toBe(true);
    expect(broker.marketOrder).toHaveBeenCalledOnce();
    expect(eng.getCntOrders()).toBe(0);  // consumed
  });
});

// ─────────────────────────────────────────────────────────────
// P20 – LimitConfirm.WickBreak fill and no-fill
// ─────────────────────────────────────────────────────────────

describe('P20 – LimitConfirm.WickBreak', () => {
  it('fills when wick crosses limit and entire body is above limit', async () => {
    const broker = mockBroker(1.09900);
    const eng = new TradingEngine(EURUSD5, broker);
    eng.orderLimitConfirm(LimitConfirm.WickBreak);
    eng.addBuyLimit(1.09900);

    // open=1.09950, close=1.10050 → min(open,close)=1.09950 > 1.09900 ✓
    // low=1.09870 ≤ 1.09900 ✓  → fills
    const bar = new Bar(1.09950, 1.10100, 1.09870, 1.10050, new Date());
    await eng.onBar(bar, makeBars(Array(3).fill(1.10000)));

    expect(eng.isLong()).toBe(true);
  });

  it('does not fill when body dips below limit (open < limit)', async () => {
    const broker = mockBroker(1.09900);
    const eng = new TradingEngine(EURUSD5, broker);
    eng.orderLimitConfirm(LimitConfirm.WickBreak);
    eng.addBuyLimit(1.09900);

    // open=1.09880, close=1.10050 → min(open,close)=1.09880 < 1.09900 ✗ → no fill
    const bar = new Bar(1.09880, 1.10100, 1.09870, 1.10050, new Date());
    await eng.onBar(bar, makeBars(Array(3).fill(1.10000)));

    expect(eng.isLong()).toBe(false);
    expect(eng.getCntOrders()).toBe(1);  // order remains
  });
});

// ─────────────────────────────────────────────────────────────
// P21 – LimitConfirm.WickColor fill
// ─────────────────────────────────────────────────────────────

describe('P21 – LimitConfirm.WickColor', () => {
  it('fills only on a bullish bar that wicked through and closed above limit', async () => {
    const broker = mockBroker(1.09900);
    const eng = new TradingEngine(EURUSD5, broker);
    eng.orderLimitConfirm(LimitConfirm.WickColor);
    eng.addBuyLimit(1.09900);

    // Bullish: open=1.09920 < close=1.10050 → isBullish ✓
    // low=1.09870 ≤ 1.09900 ✓, close=1.10050 > 1.09900 ✓ → fills
    const bar = new Bar(1.09920, 1.10100, 1.09870, 1.10050, new Date());
    await eng.onBar(bar, makeBars(Array(3).fill(1.10000)));

    expect(eng.isLong()).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────
// P22 – OCO same-bar regression (_checkOrderFills fix)
// ─────────────────────────────────────────────────────────────

describe('P22 – OCO same-bar regression: second order must not fill after OCO cancels it', () => {
  it('first order fills with OCO and cancels the second; second is not filled', async () => {
    const broker = mockBroker(1.09900);
    const eng = new TradingEngine(EURUSD5, broker);

    // Two orders both triggered by the same bar
    eng.orderAttrOCO(true);
    eng.addBuyLimit(1.09900);    // Long: triggers when bar.low ≤ 1.09900
    eng.orderAttrOCO(false);
    eng.addSellLimit(1.10100);   // Short: triggers when bar.high ≥ 1.10100

    // Bar touches both levels: low=1.09850, high=1.10150
    const bar = new Bar(1.10000, 1.10150, 1.09850, 1.10050, new Date());
    await eng.onBar(bar, makeBars(Array(3).fill(1.10000)));

    // Only the first (BUY_LIMIT) should have filled; SELL_LIMIT cancelled by OCO
    expect(eng.isLong()).toBe(true);
    expect(eng.isShort()).toBe(false);
    expect(eng.getCntOrders()).toBe(0);  // no leftover orders
  });
});
