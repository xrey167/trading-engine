import { describe, it, expect } from 'vitest';
import { Bar } from '../../shared/domain/bar/bar.js';

// Unit 1 — Result
import {
  ok, err, isOk, isErr, mapResult,
  type Result, 
} from './result.js';

// Unit 1 — Errors
import {
  invalidInput, notFound, businessRule,
  gatewayError, notImplemented, insufficientData,
} from './errors.js';

// Unit 13 — TradeRetcode
import {
  TradeRetcode, RetcodeCategory,
  retcodeDescription, retcodeCategory, isRetcodeSuccess, isRetcodeTransient, retcodeToError,
} from './retcode.js';

// Unit 2 — Domain enums
import { DayOfWeek } from '../domain/calendar/session.js';
import { MAType, PriceType } from '../domain/indicator/indicator.js';
import { OrderType, OrderFilling, OrderSide, OrderEntryType } from '../domain/order/order.js';
import {
  PositionSizeType,
  StopLimitType, StopLossType, TakeProfitType,
} from '../domain/risk/risk.js';

// Unit 3 — Analysis
import { isLocalHigh, isLocalLow } from '../../analysis/local-extremes.js';
import { calculateATR, calculateATRResult } from '../../analysis/atr.js';

// Unit 12 — Factories + Mock Adapters
import {
  makeBar, makeAccount, makePosition, makeSymbol, makeDeal,makeBarsFromArrays,
} from '../testing/factories.js';
import {
  MockBrokerAdapter, MockIndicatorAdapter,
} from '../testing/mock-adapters.js';

// ─────────────────────────────────────────────────────────────
// Unit 1 — Result
// ─────────────────────────────────────────────────────────────

describe('Result', () => {
  it('ok() creates an Ok result', () => {
    const r = ok(42);
    expect(r).toEqual({ ok: true, value: 42 });
    expect(isOk(r)).toBe(true);
    expect(isErr(r)).toBe(false);
  });

  it('err() creates an Err result', () => {
    const r = err('fail');
    expect(r).toEqual({ ok: false, error: 'fail' });
    expect(isErr(r)).toBe(true);
    expect(isOk(r)).toBe(false);
  });

  it('mapResult transforms Ok values', () => {
    const r = ok(10);
    const mapped = mapResult(r, v => v * 2);
    expect(mapped).toEqual({ ok: true, value: 20 });
  });

  it('mapResult passes through Err unchanged', () => {
    const r: Result<number, string> = err('nope');
    const mapped = mapResult(r, (v: number) => v * 2);
    expect(mapped).toEqual({ ok: false, error: 'nope' });
  });

  it('round-trips ok → isOk → value', () => {
    const r = ok({ data: [1, 2, 3] });
    if (isOk(r)) {
      expect(r.value.data).toEqual([1, 2, 3]);
    } else {
      expect.unreachable('should be Ok');
    }
  });
});

// ─────────────────────────────────────────────────────────────
// Unit 1 — DomainError factories
// ─────────────────────────────────────────────────────────────

describe('DomainError', () => {
  it('invalidInput produces INVALID_INPUT', () => {
    const e = invalidInput('bad value', 'email');
    expect(e.type).toBe('INVALID_INPUT');
    expect(e.message).toBe('bad value');
    if (e.type === 'INVALID_INPUT') expect(e.field).toBe('email');
  });

  it('invalidInput without field', () => {
    const e = invalidInput('missing');
    expect(e.type).toBe('INVALID_INPUT');
    if (e.type === 'INVALID_INPUT') expect(e.field).toBeUndefined();
  });

  it('notFound produces NOT_FOUND', () => {
    const e = notFound('user missing', 'abc');
    expect(e.type).toBe('NOT_FOUND');
    if (e.type === 'NOT_FOUND') expect(e.id).toBe('abc');
  });

  it('businessRule produces BUSINESS_RULE', () => {
    const e = businessRule('cannot do that', 'MAX_POSITIONS');
    expect(e.type).toBe('BUSINESS_RULE');
    if (e.type === 'BUSINESS_RULE') expect(e.rule).toBe('MAX_POSITIONS');
  });

  it('gatewayError produces GATEWAY_ERROR', () => {
    const cause = new Error('timeout');
    const e = gatewayError('broker down', cause);
    expect(e.type).toBe('GATEWAY_ERROR');
    if (e.type === 'GATEWAY_ERROR') expect(e.cause).toBe(cause);
  });

  it('notImplemented produces NOT_IMPLEMENTED', () => {
    const e = notImplemented('trailing');
    expect(e.type).toBe('NOT_IMPLEMENTED');
    expect(e.message).toBe('trailing is not implemented');
  });

  it('insufficientData produces INSUFFICIENT_DATA', () => {
    const e = insufficientData(14, 5);
    expect(e.type).toBe('INSUFFICIENT_DATA');
    if (e.type === 'INSUFFICIENT_DATA') {
      expect(e.required).toBe(14);
      expect(e.available).toBe(5);
      expect(e.message).toContain('14');
    }
  });
});

// ─────────────────────────────────────────────────────────────
// Unit 2 — Domain enums (as const maps)
// ─────────────────────────────────────────────────────────────

describe('Domain enums', () => {
  it('DayOfWeek has correct values', () => {
    expect(DayOfWeek.Sunday).toBe(0);
    expect(DayOfWeek.Saturday).toBe(6);
    expect(Object.keys(DayOfWeek)).toHaveLength(7);
  });

  it('MAType has 8 values', () => {
    expect(MAType.SMA).toBe(0);
    expect(MAType.EMA).toBe(1);
    expect(MAType.DEMA).toBe(2);
    expect(MAType.TEMA).toBe(3);
    expect(MAType.VWMA).toBe(4);
    expect(MAType.Hull).toBe(5);
    expect(MAType.RMA).toBe(6);
    expect(MAType.LinearRegression).toBe(7);
    expect(Object.keys(MAType)).toHaveLength(8);
  });

  it('OrderSide has BUY and SELL', () => {
    expect(OrderSide.BUY).toBe('BUY');
    expect(OrderSide.SELL).toBe('SELL');
  });

  it('PositionSizeType has correct values', () => {
    expect(PositionSizeType.Fixed).toBe('FIXED');
    expect(PositionSizeType.Risk).toBe('RISK');
    expect(Object.keys(PositionSizeType)).toHaveLength(4);
  });

  it('PriceType has 11 values', () => {
    expect(PriceType.Close).toBe(0);
    expect(PriceType.Volume).toBe(10);
    expect(Object.keys(PriceType)).toHaveLength(11);
  });

  it('StopLimitType has correct values', () => {
    expect(StopLimitType.DoNotUse).toBe('DO_NOT_USE');
    expect(StopLimitType.RiskBalance).toBe('RISK_BALANCE');
    expect(Object.keys(StopLimitType)).toHaveLength(6);
  });

  it('StopLossType has 9 values', () => {
    expect(StopLossType.DoNotUse).toBe('DO_NOT_USE');
    expect(StopLossType.ATRDistance).toBe('ATR_DISTANCE');
    expect(StopLossType.HighLow).toBe('HIGH_LOW');
    expect(Object.keys(StopLossType)).toHaveLength(9);
  });

  it('TakeProfitType has 7 values', () => {
    expect(TakeProfitType.DoNotUse).toBe('DO_NOT_USE');
    expect(TakeProfitType.RiskReward).toBe('RISK_REWARD');
    expect(Object.keys(TakeProfitType)).toHaveLength(7);
  });

  it('OrderType has 9 values', () => {
    expect(OrderType.Buy).toBe('BUY');
    expect(OrderType.SellStopLimit).toBe('SELL_STOP_LIMIT');
    expect(Object.keys(OrderType)).toHaveLength(9);
  });

  it('OrderFilling has FOK, IOC, Return', () => {
    expect(OrderFilling.FOK).toBe('FOK');
    expect(OrderFilling.IOC).toBe('IOC');
    expect(OrderFilling.Return).toBe('RETURN');
  });
});

// ─────────────────────────────────────────────────────────────
// Unit 3 — Bar analysis
// ─────────────────────────────────────────────────────────────

describe('Bar analysis', () => {
  const bullish = new Bar(1.1000, 1.1050, 1.0950, 1.1040, new Date());
  const bearish = new Bar(1.1040, 1.1050, 1.0950, 1.1000, new Date());

  it('isBullish detects bullish candles', () => {
    expect(bullish.isBullish()).toBe(true);
    expect(bearish.isBullish()).toBe(false);
  });

  it('isBearish detects bearish candles', () => {
    expect(bearish.isBearish()).toBe(true);
    expect(bullish.isBearish()).toBe(false);
  });

  it('range returns high - low', () => {
    expect(bullish.range()).toBeCloseTo(0.0100, 6);
  });

  it('wickPart returns wick ratio', () => {
    // bullish: wick = high - max(open,close) = 1.1050 - 1.1040 = 0.0010
    // range = 0.0100, wickPart = 0.1
    expect(bullish.wickPart()).toBeCloseTo(0.1, 6);
  });

  it('tailPart returns tail ratio', () => {
    // bullish: tail = min(open,close) - low = 1.1000 - 1.0950 = 0.0050
    // range = 0.0100, tailPart = 0.5
    expect(bullish.tailPart()).toBeCloseTo(0.5, 6);
  });

  it('bodyRange returns absolute body', () => {
    // bullish: |1.1040 - 1.1000| = 0.004
    expect(bullish.bodyRange()).toBeCloseTo(0.004, 6);
  });
});

// ─────────────────────────────────────────────────────────────
// Unit 3 — Local extremes
// ─────────────────────────────────────────────────────────────

describe('Local extremes', () => {
  //                shift:  0       1       2       3       4
  const bars = makeBarsFromArrays(
    [1.10,   1.08,   1.12,   1.07,   1.09],  // closes
    [1.11,   1.09,   1.15,   1.08,   1.10],  // highs
    [1.09,   1.07,   1.10,   1.06,   1.08],  // lows
  );

  it('isLocalHigh finds the highest bar in window', () => {
    // shift=2 has highest high (1.15), window=3 covers indices 2,3,4
    expect(isLocalHigh(bars, 3, 2)).toBe(true);
    // shift=0 has high 1.11, window=3 covers indices 0,1,2 — shift=2 has 1.15
    expect(isLocalHigh(bars, 3, 0)).toBe(false);
  });

  it('isLocalLow finds the lowest bar in window', () => {
    // shift=3 has lowest low (1.06), window=2 covers indices 3,4
    expect(isLocalLow(bars, 2, 3)).toBe(true);
    // shift=0 has low 1.09, window=3 covers 0,1,2 — shift=1 has 1.07
    expect(isLocalLow(bars, 3, 0)).toBe(false);
  });

  it('returns false when a neighbor has a higher high', () => {
    // shift=3 high=1.08, but shift=4 high=1.10 > 1.08
    expect(isLocalHigh(bars, 10, 3)).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────
// Unit 3 — ATR
// ─────────────────────────────────────────────────────────────

describe('calculateATR', () => {
  // 6 bars: shift 0..4 have prev-bar (i+1), so ATR period=3, shift=0 needs 4 bars
  const bars = makeBarsFromArrays(
    [100, 102, 98, 101, 99, 103],
    [105, 106, 103, 104, 102, 107],
    [95,  97,  93,  96,  94,  98],
  );

  it('returns null when insufficient data', () => {
    const short = makeBarsFromArrays([100, 102]);
    expect(calculateATR(short, 14, 0)).toBeNull();
  });

  it('calculates ATR correctly', () => {
    const atr = calculateATR(bars, 3, 0);
    expect(atr).not.toBeNull();
    // Manual check: for each bar i in [0,1,2]:
    // TR(0): max(105-95, |105-102|, |95-102|) = max(10,3,7) = 10
    // TR(1): max(106-97, |106-98|, |97-98|) = max(9,8,1) = 9
    // TR(2): max(103-93, |103-101|, |93-101|) = max(10,2,8) = 10
    // ATR = (10+9+10)/3 = 9.6667
    expect(atr).toBeCloseTo(29 / 3, 6);
  });

  it('calculateATRResult returns Ok on success', () => {
    const r = calculateATRResult(bars, 3, 0);
    expect(isOk(r)).toBe(true);
    if (isOk(r)) {
      expect(r.value).toBeCloseTo(29 / 3, 6);
    }
  });

  it('calculateATRResult returns Err on insufficient data', () => {
    const short = makeBarsFromArrays([100, 102]);
    const r = calculateATRResult(short, 14, 0);
    expect(isErr(r)).toBe(true);
    if (isErr(r)) {
      expect(r.error.type).toBe('INSUFFICIENT_DATA');
    }
  });
});

// ─────────────────────────────────────────────────────────────
// Unit 12 — Test factories
// ─────────────────────────────────────────────────────────────

describe('Test factories', () => {
  it('makeBar creates a bar with defaults', () => {
    const bar = makeBar();
    expect(bar.open).toBe(1.1000);
    expect(bar.high).toBe(1.1050);
    expect(bar.low).toBe(1.0950);
    expect(bar.close).toBe(1.1020);
    expect(bar.time).toBeInstanceOf(Date);
    expect(bar.volume).toBe(100);
  });

  it('makeBar accepts overrides', () => {
    const bar = makeBar({ close: 2.0 });
    expect(bar.close).toBe(2.0);
    expect(bar.open).toBe(1.1000); // default kept
  });

  it('makeAccount creates an account with defaults', () => {
    const acct = makeAccount();
    expect(acct.balance).toBe(10000);
    expect(acct.currency).toBe('USD');
    expect(acct.leverage).toBe(100);
    expect(acct.tradeAllowed).toBe(true);
  });

  it('makePosition creates a position with defaults', () => {
    const pos = makePosition();
    expect(pos.ticket).toBe(1);
    expect(pos.symbol).toBe('EURUSD');
    expect(pos.type).toBe('BUY');
    expect(pos.volume).toBe(0.1);
    expect(pos.priceOpen).toBe(1.1000);
  });

  it('makeSymbol creates a symbol with defaults', () => {
    const sym = makeSymbol();
    expect(sym.name).toBe('EURUSD');
    expect(sym.digits).toBe(5);
    expect(sym.point).toBe(0.00001);
  });

  it('makeDeal creates a deal with defaults', () => {
    const deal = makeDeal();
    expect(deal.symbol).toBe('EURUSD');
    expect(deal.type).toBe('DEAL_TYPE_BUY');
    expect(deal.volume).toBe(0.1);
  });
});

// ─────────────────────────────────────────────────────────────
// Unit 12 — Mock adapters
// ─────────────────────────────────────────────────────────────

describe('MockBrokerAdapter', () => {
  it('returns empty positions by default', async () => {
    const broker = new MockBrokerAdapter();
    const r = await broker.getPositions('user-1');
    expect(isOk(r)).toBe(true);
    if (isOk(r)) expect(r.value).toEqual([]);
  });

  it('returns set positions', async () => {
    const broker = new MockBrokerAdapter();
    broker.setPositions('user-1', [makePosition()]);
    const r = await broker.getPositions('user-1');
    expect(isOk(r)).toBe(true);
    if (isOk(r)) expect(r.value).toHaveLength(1);
  });

  it('returns balance when set', async () => {
    const broker = new MockBrokerAdapter();
    broker.setBalance('user-1', 5000);
    const r = await broker.getBalance('user-1');
    expect(isOk(r)).toBe(true);
    if (isOk(r)) expect(r.value).toBe(5000);
  });

  it('returns err for missing balance', async () => {
    const broker = new MockBrokerAdapter();
    const r = await broker.getBalance('unknown');
    expect(isErr(r)).toBe(true);
  });

  it('closes a position', async () => {
    const broker = new MockBrokerAdapter();
    broker.setPositions('user-1', [makePosition({ ticket: 42 })]);
    const r = await broker.closePosition('user-1', 42);
    expect(isOk(r)).toBe(true);
    const remaining = await broker.getPositions('user-1');
    if (isOk(remaining)) expect(remaining.value).toHaveLength(0);
  });
});

describe('MockIndicatorAdapter', () => {
  it('returns null by default', () => {
    const ind = new MockIndicatorAdapter();
    expect(ind.getATR('EURUSD', 'H1', 14, 0)).toBeNull();
  });

  it('returns specific ATR value', () => {
    const ind = new MockIndicatorAdapter();
    ind.setATR('EURUSD', 'H1', 14, 0, 0.0025);
    expect(ind.getATR('EURUSD', 'H1', 14, 0)).toBe(0.0025);
  });

  it('returns default ATR when no specific match', () => {
    const ind = new MockIndicatorAdapter();
    ind.setDefaultATR(0.003);
    expect(ind.getATR('GBPUSD', 'M15', 20, 5)).toBe(0.003);
  });
});

// ─────────────────────────────────────────────────────────────
// Unit 13 — TradeRetcode
// ─────────────────────────────────────────────────────────────

describe('TradeRetcode', () => {
  it('retcodeDescription returns known description', () => {
    expect(retcodeDescription(TradeRetcode.Done)).toBe('Request completed');
    expect(retcodeDescription(TradeRetcode.NoMoney)).toBe('There is not enough money to complete the request');
    expect(retcodeDescription(TradeRetcode.Connection)).toBe('No connection with the trade server');
  });

  it('retcodeDescription returns fallback for unknown code', () => {
    expect(retcodeDescription(99999)).toBe('Unknown retcode (99999)');
  });

  it('retcodeCategory classifies success codes', () => {
    expect(retcodeCategory(TradeRetcode.Done)).toBe(RetcodeCategory.Success);
    expect(retcodeCategory(TradeRetcode.Placed)).toBe(RetcodeCategory.Success);
    expect(retcodeCategory(TradeRetcode.DonePartial)).toBe(RetcodeCategory.Success);
  });

  it('retcodeCategory classifies transient codes', () => {
    expect(retcodeCategory(TradeRetcode.Requote)).toBe(RetcodeCategory.Transient);
    expect(retcodeCategory(TradeRetcode.PriceChanged)).toBe(RetcodeCategory.Transient);
    expect(retcodeCategory(TradeRetcode.TooManyRequests)).toBe(RetcodeCategory.Transient);
    expect(retcodeCategory(TradeRetcode.Locked)).toBe(RetcodeCategory.Transient);
  });

  it('retcodeCategory classifies invalid-input codes', () => {
    expect(retcodeCategory(TradeRetcode.InvalidVolume)).toBe(RetcodeCategory.InvalidInput);
    expect(retcodeCategory(TradeRetcode.InvalidPrice)).toBe(RetcodeCategory.InvalidInput);
    expect(retcodeCategory(TradeRetcode.InvalidStops)).toBe(RetcodeCategory.InvalidInput);
    expect(retcodeCategory(TradeRetcode.InvalidFill)).toBe(RetcodeCategory.InvalidInput);
  });

  it('retcodeCategory classifies market-condition codes', () => {
    expect(retcodeCategory(TradeRetcode.MarketClosed)).toBe(RetcodeCategory.MarketCondition);
    expect(retcodeCategory(TradeRetcode.TradeDisabled)).toBe(RetcodeCategory.MarketCondition);
    expect(retcodeCategory(TradeRetcode.LongOnly)).toBe(RetcodeCategory.MarketCondition);
    expect(retcodeCategory(TradeRetcode.CloseOnly)).toBe(RetcodeCategory.MarketCondition);
  });

  it('retcodeCategory classifies account-constraint codes', () => {
    expect(retcodeCategory(TradeRetcode.NoMoney)).toBe(RetcodeCategory.AccountConstraint);
    expect(retcodeCategory(TradeRetcode.LimitOrders)).toBe(RetcodeCategory.AccountConstraint);
    expect(retcodeCategory(TradeRetcode.LimitVolume)).toBe(RetcodeCategory.AccountConstraint);
    expect(retcodeCategory(TradeRetcode.LimitPositions)).toBe(RetcodeCategory.AccountConstraint);
  });

  it('retcodeCategory classifies connection codes', () => {
    expect(retcodeCategory(TradeRetcode.Connection)).toBe(RetcodeCategory.Connection);
    expect(retcodeCategory(TradeRetcode.Timeout)).toBe(RetcodeCategory.Connection);
  });

  it('isRetcodeSuccess is true only for success codes', () => {
    expect(isRetcodeSuccess(TradeRetcode.Done)).toBe(true);
    expect(isRetcodeSuccess(TradeRetcode.Placed)).toBe(true);
    expect(isRetcodeSuccess(TradeRetcode.DonePartial)).toBe(true);
    expect(isRetcodeSuccess(TradeRetcode.NoMoney)).toBe(false);
    expect(isRetcodeSuccess(TradeRetcode.Requote)).toBe(false);
  });

  it('isRetcodeTransient is true only for transient codes', () => {
    expect(isRetcodeTransient(TradeRetcode.Requote)).toBe(true);
    expect(isRetcodeTransient(TradeRetcode.PriceOff)).toBe(true);
    expect(isRetcodeTransient(TradeRetcode.Done)).toBe(false);
    expect(isRetcodeTransient(TradeRetcode.NoMoney)).toBe(false);
  });

  it('retcodeToError maps invalid-input codes to invalidInput DomainError', () => {
    const e = retcodeToError(TradeRetcode.InvalidVolume);
    expect(e.type).toBe('INVALID_INPUT');
  });

  it('retcodeToError maps market-condition codes to businessRule DomainError', () => {
    const e = retcodeToError(TradeRetcode.MarketClosed);
    expect(e.type).toBe('BUSINESS_RULE');
    if (e.type === 'BUSINESS_RULE') expect(e.rule).toBe(`RETCODE_${TradeRetcode.MarketClosed}`);
  });

  it('retcodeToError maps account-constraint codes to businessRule DomainError', () => {
    const e = retcodeToError(TradeRetcode.NoMoney, 'placeOrder');
    expect(e.type).toBe('BUSINESS_RULE');
    if (e.type === 'BUSINESS_RULE') {
      expect(e.message).toMatch(/placeOrder/);
      expect(e.message).toMatch(/not enough money/i);
    }
  });

  it('retcodeToError maps connection codes to gatewayError DomainError', () => {
    expect(retcodeToError(TradeRetcode.Connection).type).toBe('GATEWAY_ERROR');
    expect(retcodeToError(TradeRetcode.Timeout).type).toBe('GATEWAY_ERROR');
  });

  it('retcodeToError maps transient codes to gatewayError after exhaustion', () => {
    expect(retcodeToError(TradeRetcode.Requote).type).toBe('GATEWAY_ERROR');
  });

  it('retcodeToError uses fallback for unknown code', () => {
    const e = retcodeToError(99999);
    expect(e.type).toBe('GATEWAY_ERROR');
    if (e.type === 'GATEWAY_ERROR') expect(e.message).toMatch(/99999/);
  });

  it('TradeRetcode values cover the expected range with no 10005/10037 gaps', () => {
    const codes = Object.values(TradeRetcode) as number[];
    expect(codes).not.toContain(10005);
    expect(codes).not.toContain(10037);
    expect(codes).toContain(10004);
    expect(codes).toContain(10044);
  });
});
