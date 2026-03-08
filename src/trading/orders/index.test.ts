import { describe, it, expect, vi } from 'vitest';
import { TradingEngine } from '../../engine/core/trading-engine.js';
import type { IBrokerAdapter } from '../../engine/core/trading-engine.js';
import { Bar } from '../../shared/domain/bar/bar.js';
import { Bars } from '../../market-data/bars.js';
import type { OHLC } from '../../shared/domain/bar/ohlc.js';
import { TrailMode, LimitConfirm } from '../../shared/domain/engine-enums.js';
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

function makeSingleCandle(open: number, high: number, low: number, close: number): Bar {
  return new Bar(open, high, low, close, new Date('2024-01-02'));
}

const EURUSD5 = new SymbolInfoForex('EURUSD', 5); // pointSize = 0.00001

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
  it('BUY_LIMIT bracket fills → SL below and TP above gap-clamped fill price', async () => {
    const eng = new TradingEngine(EURUSD5, mockBroker());
    // BUY_LIMIT at 1.0980; bar.open=1.1000 > trigger → gap-clamped fill = max(1.0980, 1.1000) = 1.1000
    // tpPts=500 → TP = 1.1000 + 0.005 = 1.1050; bar.high=1.1005 < TP so position stays open
    eng.addBracket({ entryType: 'BUY_LIMIT', entryPrice: 1.0980, slPts: 100, tpPts: 500 });
    const bar = makeSingleCandle(1.1000, 1.1005, 1.0980, 1.0990);
    await eng.onBar(bar, makeBars(Array(3).fill(1.099)));
    expect(eng.isLong()).toBe(true);
    // SL = fill(1.1000) − 100 pts = 1.0990
    expect(eng.getSLBuy()).toBeCloseTo(1.1000 - 100 * 0.00001, 5);
    // TP = fill(1.1000) + 500 pts = 1.1050
    expect(eng.getTPBuy()).toBeCloseTo(1.1000 + 500 * 0.00001, 5);
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

// ─────────────────────────────────────────────────────────────
// Trailing entry orders — side-based polymorphism
// ─────────────────────────────────────────────────────────────

describe('Trailing entry orders — side-based updateTrailingRef', () => {
  it('TrailingLimitOrder updateTrailingRef trails HIGH for long (side-based, not type-based)', async () => {
    const eng = new TradingEngine(EURUSD5, mockBroker());
    eng.addBuyLimitTrail(TrailMode.Dst, 100);
    const order = eng.getOrders()[0];
    const bar = makeSingleCandle(1.0950, 1.1000, 1.0900, 1.0960);
    await eng.onBar(bar, makeBars([bar.close]));
    // BUY trailing limit: price = high - 100pts = 1.1000 - 0.00100 = 1.09900
    expect(order.price).toBeCloseTo(1.09900, 4);
  });

  it('TrailingStopOrder updateTrailingRef trails LOW for long (side-based, not type-based)', async () => {
    const eng = new TradingEngine(EURUSD5, mockBroker());
    eng.addBuyStopTrail(TrailMode.Dst, 100);
    const order = eng.getOrders()[0];
    const bar = makeSingleCandle(1.1050, 1.1100, 1.1000, 1.1050);
    await eng.onBar(bar, makeBars([bar.close]));
    // BUY trailing stop: trails the low, price = low + 100pts = 1.1000 + 0.00100 = 1.10100
    expect(order.price).toBeCloseTo(1.10100, 4);
  });
});
