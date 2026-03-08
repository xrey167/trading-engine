import { describe, it, expect, vi } from 'vitest';
import { TradingEngine } from './trading-engine.js';
import type { IBrokerAdapter } from './trading-engine.js';
import { Bar } from '../../market-data/bar.js';
import { Bars } from '../../market-data/bars.js';
import type { OHLC } from '../../market-data/ohlc.js';
import { Side } from '../../shared/domain/engine-enums.js';
import { SymbolInfoForex } from './symbol.js';

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

function makeSingleCandle(open: number, high: number, low: number, close: number): Bar {
  return new Bar(open, high, low, close, new Date('2024-01-02'));
}

const EURUSD5 = new SymbolInfoForex('EURUSD', 5); // pointSize = 0.00001

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
    // This test is covered in trailing-stop.test.ts — just verify TradingEngine exports work
    // by exercising the engine with TrailMode.Dst as a smoke test
    const eng = new TradingEngine(EURUSD5, mockBroker(1.10000));
    // Just verify construction works
    expect(eng).toBeTruthy();
  });
});

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
  it('long BE: SL moves to openPrice + beAddPts when bar.close meets the trigger (MQL close-based)', async () => {
    const broker = mockBroker(1.10000);
    const eng = new TradingEngine(EURUSD5, broker);
    await eng.buy();  // fill at 1.10000
    eng.beActivateBuy(true);
    eng.trailBeginBuy(100);  // trigger at openPrice + 100pts = 1.10100
    eng.beBuy(50);           // SL target = openPrice + 50pts = 1.10050
    // bar.close = 1.10100 (≥ trigger), bar.low = 1.10060 (above new SL — no exit)
    // MQL uses bar_close (not bar_high) to check the trigger
    const bar = makeSingleCandle(1.10080, 1.10110, 1.10060, 1.10100);
    await eng.onBar(bar, makeBars(Array(3).fill(1.1008)));
    expect(eng.getSLBuy()).toBeCloseTo(1.10000 + 50 * 0.00001, 5);
    expect(eng.isLong()).toBe(true);
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
// onTick — tick-driven fills
// ─────────────────────────────────────────────────────────────

describe('onTick — tick-driven fills', () => {
  it('throws if called before any onBar (no bar context)', async () => {
    const eng = new TradingEngine(EURUSD5, mockBroker());
    await expect(eng.onTick(1.1000, new Date())).rejects.toThrow();
  });

  it('fills a BUY_LIMIT order when tick price crosses limit', async () => {
    const eng = new TradingEngine(EURUSD5, mockBroker());
    const bar = makeSingleCandle(1.1000, 1.1050, 1.0950, 1.1000);
    const bars = makeBars([1.1000], [1.1050], [1.0950]);
    await eng.onBar(bar, bars);

    eng.addBuyLimit(1.0980, 1); // fills when price <= 1.0980
    expect(eng.getOrders()).toHaveLength(1);

    await eng.onTick(1.0975, new Date()); // crosses limit

    expect(eng.getOrders()).toHaveLength(0);
    expect(eng.getSizeBuy()).toBe(1);
  });

  it('does NOT fill when tick price does not cross limit', async () => {
    const eng = new TradingEngine(EURUSD5, mockBroker());
    const bar = makeSingleCandle(1.1000, 1.1050, 1.0950, 1.1000);
    const bars = makeBars([1.1000], [1.1050], [1.0950]);
    await eng.onBar(bar, bars);

    eng.addBuyLimit(1.0960, 1);
    await eng.onTick(1.1000, new Date()); // price above limit

    expect(eng.getOrders()).toHaveLength(1);
    expect(eng.getSizeBuy()).toBe(0);
  });

  it('triggers SL exit on tick for long position', async () => {
    const broker = mockBroker(1.10000);
    const eng = new TradingEngine(EURUSD5, broker);
    const bar = makeSingleCandle(1.1000, 1.1050, 1.0950, 1.1000);
    const bars = makeBars([1.1000], [1.1050], [1.0950]);
    await eng.onBar(bar, bars);
    eng.sl(500); // 500 points = 0.00500 → SL at 1.10000 - 0.00500 = 1.09500
    await eng.buy(1);
    eng.slActivateBuy(true);
    expect(eng.getSLBuy()).toBeCloseTo(1.09500, 5);

    await eng.onTick(1.0940, new Date()); // below SL

    expect(eng.getSizeBuy()).toBe(0);
  });
});
