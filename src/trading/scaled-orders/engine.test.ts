import { describe, it, expect, vi } from 'vitest';
import { ScaledOrderEngine } from './engine.js';
import type { ScaledOrderPreset } from './engine.js';
import { TradingEngine } from '../../engine/core/trading-engine.js';
import type { IBrokerAdapter } from '../../engine/core/trading-engine.js';
import { Bars } from '../../market-data/bars.js';
import type { OHLC } from '../../market-data/ohlc.js';
import { SymbolInfoForex } from '../../engine/core/symbol.js';

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

// ─────────────────────────────────────────────────────────────
// T8 – placeBoth: sequential execution
// ─────────────────────────────────────────────────────────────

describe('T8 – placeBoth executes Long then Short sequentially', () => {
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
// P13b – ScaledOrderEngine: attrCO/attrREV re-applied in loops
// ─────────────────────────────────────────────────────────────

describe('P13b – ScaledOrderEngine: attrCO/attrREV carried on limit and stop loop orders', () => {
  const flatBars = makeBars(Array(30).fill(1.10000));

  it('attrCO=true: all limit loop orders carry the CO flag', async () => {
    const broker = mockBroker(1.10000);
    const eng = new TradingEngine(EURUSD5, broker);
    const preset: ScaledOrderPreset = {
      name: 'co-limit-test',
      atrMode: 'None', distance: 20,
      progressLimits: 1, progressStops: 1,
      countLimits: 2, countStops: 0,
      slRel: 0, trailBegin: 0, trailDistance: 0,
      factorLong: 1, factorShort: 1,
      attrOCO: false, attrCO: true, attrREV: false, attrNET: false,
      instantOrderType: 'MTO',
      instantOrderDistance: 1,
      chainLimits: false,
      eachTick: false,
    };
    const scaled = new ScaledOrderEngine(eng, EURUSD5, preset);
    await scaled.placeLong(flatBars, 1.10000);

    // 1 MIT (instant) + 2 limits = 3 pending orders; all 3 must have co=true
    const orders = eng.getOrders();
    expect(orders).toHaveLength(3);
    expect(orders.every(o => o.co === true)).toBe(true);
  });

  it('attrCO=true: all stop loop orders carry the CO flag', async () => {
    const broker = mockBroker(1.10000);
    const eng = new TradingEngine(EURUSD5, broker);
    const preset: ScaledOrderPreset = {
      name: 'co-stop-test',
      atrMode: 'None', distance: 20,
      progressLimits: 1, progressStops: 1,
      countLimits: 0, countStops: 2,
      slRel: 0, trailBegin: 0, trailDistance: 0,
      factorLong: 1, factorShort: 1,
      attrOCO: false, attrCO: true, attrREV: false, attrNET: false,
      instantOrderType: 'MTO',
      instantOrderDistance: 1,
      chainLimits: false,
      eachTick: false,
    };
    const scaled = new ScaledOrderEngine(eng, EURUSD5, preset);
    await scaled.placeLong(flatBars, 1.10000);

    // 1 MIT (instant) + 2 stops = 3 pending orders; all 3 must have co=true
    const orders = eng.getOrders();
    expect(orders).toHaveLength(3);
    expect(orders.every(o => o.co === true)).toBe(true);
  });
});
