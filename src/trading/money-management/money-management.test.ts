import { describe, it, expect } from 'vitest';
import { CompositeMoneyManagementStrategy } from './composite.js';
import { DefaultLotsProvider } from './lots/default-lots-provider.js';
import { DefaultStopLossCalculator } from './stop-loss/default-sl-calculator.js';
import { DefaultTakeProfitCalculator } from './take-profit/default-tp-calculator.js';
import { RiskToRewardTakeProfitCalculator } from './take-profit/risk-reward-tp-calculator.js';
import { CalculationContext } from './calculation-context.js';
import { priceDelta, targetPrice, percentageToPrice } from './price-utils.js';
import { ok, err } from '../../shared/lib/result.js';
import { StopLimitType } from '../../shared/domain/enums.js';
import type { ILotsProvider, IStopLossCalculator, ITakeProfitCalculator, MoneyManagementParams, ITradingCalculator } from './types.js';
import type { DomainError } from '../../shared/lib/errors.js';

// ---------------------------------------------------------------------------
// price-utils
// ---------------------------------------------------------------------------
describe('price-utils', () => {
  it('priceDelta returns absolute difference', () => {
    expect(priceDelta(1.1, 1.09)).toBeCloseTo(0.01);
    expect(priceDelta(1.09, 1.1)).toBeCloseTo(0.01);
  });

  it('targetPrice BUY adds distance', () => {
    expect(targetPrice(100, 5, 2, 'BUY')).toBe(110);
  });

  it('targetPrice SELL subtracts distance', () => {
    expect(targetPrice(100, 5, 2, 'SELL')).toBe(90);
  });

  it('percentageToPrice BUY subtracts percentage', () => {
    expect(percentageToPrice(100, 5, 'BUY')).toBe(95);
  });

  it('percentageToPrice SELL adds percentage', () => {
    expect(percentageToPrice(100, 5, 'SELL')).toBe(105);
  });
});

// ---------------------------------------------------------------------------
// Composite strategy with mock providers
// ---------------------------------------------------------------------------
describe('CompositeMoneyManagementStrategy', () => {
  const params: MoneyManagementParams = { barIndex: 0, entryPrice: 1.1, direction: 'BUY' };

  it('combines lots + sl + tp on success', async () => {
    const lots: ILotsProvider = { calculate: () => ok(0.1) };
    const sl: IStopLossCalculator = { calculate: () => ok(1.09) };
    const tp: ITakeProfitCalculator = { calculate: () => ok(1.12) };

    const composite = new CompositeMoneyManagementStrategy(lots, sl, tp);
    const result = await composite.calculate(params);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.lots).toBe(0.1);
      expect(result.value.stopLoss).toBeCloseTo(1.09);
      expect(result.value.takeProfit).toBeCloseTo(1.12);
    }
  });

  it('propagates lots error', async () => {
    const error: DomainError = { type: 'INVALID_INPUT', message: 'bad lots' };
    const lots: ILotsProvider = { calculate: () => err(error) };
    const sl: IStopLossCalculator = { calculate: () => ok(1.09) };
    const tp: ITakeProfitCalculator = { calculate: () => ok(1.12) };

    const composite = new CompositeMoneyManagementStrategy(lots, sl, tp);
    const result = await composite.calculate(params);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toEqual(error);
    }
  });

  it('propagates sl error', async () => {
    const error: DomainError = { type: 'GATEWAY_ERROR', message: 'sl fail' };
    const lots: ILotsProvider = { calculate: () => ok(0.1) };
    const sl: IStopLossCalculator = { calculate: () => err(error) };
    const tp: ITakeProfitCalculator = { calculate: () => ok(1.12) };

    const composite = new CompositeMoneyManagementStrategy(lots, sl, tp);
    const result = await composite.calculate(params);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toEqual(error);
    }
  });

  it('propagates tp error', async () => {
    const error: DomainError = { type: 'GATEWAY_ERROR', message: 'tp fail' };
    const lots: ILotsProvider = { calculate: () => ok(0.1) };
    const sl: IStopLossCalculator = { calculate: () => ok(1.09) };
    const tp: ITakeProfitCalculator = { calculate: () => err(error) };

    const composite = new CompositeMoneyManagementStrategy(lots, sl, tp);
    const result = await composite.calculate(params);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toEqual(error);
    }
  });

  it('passes resolved sl and lots to tp calculator', async () => {
    let receivedParams: unknown;
    const lots: ILotsProvider = { calculate: () => ok(0.5) };
    const sl: IStopLossCalculator = { calculate: () => ok(1.08) };
    const tp: ITakeProfitCalculator = {
      calculate: (p) => {
        receivedParams = p;
        return ok(1.15);
      },
    };

    const composite = new CompositeMoneyManagementStrategy(lots, sl, tp);
    await composite.calculate(params);

    expect(receivedParams).toEqual({
      ...params,
      stopLoss: 1.08,
      lots: 0.5,
    });
  });
});

// ---------------------------------------------------------------------------
// DefaultLotsProvider with mock CalculationContext
// ---------------------------------------------------------------------------
describe('DefaultLotsProvider', () => {
  it('delegates to ctx.getLots with stopLossDistance=0', () => {
    const mockCalc: ITradingCalculator = {
      calculateStopLoss: () => ok(0),
      calculateTakeProfit: () => ok(0),
      getLots: (p) => ok(p.lotsValue),
    };
    const ctx = new CalculationContext(mockCalc, 'BUY');
    const provider = new DefaultLotsProvider(ctx, 'FIXED', 0.1, 'BUY');

    const result = provider.calculate({ barIndex: 0, entryPrice: 1.1, direction: 'BUY' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe(0.1);
    }
  });
});

// ---------------------------------------------------------------------------
// DefaultStopLossCalculator
// ---------------------------------------------------------------------------
describe('DefaultStopLossCalculator', () => {
  it('returns 0 for DO_NOT_USE type', () => {
    const mockCalc: ITradingCalculator = {
      calculateStopLoss: () => ok(0),
      calculateTakeProfit: () => ok(0),
      getLots: () => ok(0),
    };
    const ctx = new CalculationContext(mockCalc, 'BUY');
    const calc = new DefaultStopLossCalculator(ctx, StopLimitType.DoNotUse, 10, 'BUY');

    const result = calc.calculate({ barIndex: 0, entryPrice: 1.1, direction: 'BUY' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe(0);
    }
  });

  it('delegates to ctx.calculateStopLoss for other types', () => {
    const mockCalc: ITradingCalculator = {
      calculateStopLoss: (p) => ok(p.entryPrice - p.stopLossValue * 0.0001),
      calculateTakeProfit: () => ok(0),
      getLots: () => ok(0),
    };
    const ctx = new CalculationContext(mockCalc, 'BUY');
    const calc = new DefaultStopLossCalculator(ctx, 'PIPS', 50, 'BUY');

    const result = calc.calculate({ barIndex: 0, entryPrice: 1.1, direction: 'BUY' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBeCloseTo(1.095);
    }
  });
});

// ---------------------------------------------------------------------------
// DefaultTakeProfitCalculator
// ---------------------------------------------------------------------------
describe('DefaultTakeProfitCalculator', () => {
  it('returns 0 for DO_NOT_USE type', () => {
    const mockCalc: ITradingCalculator = {
      calculateStopLoss: () => ok(0),
      calculateTakeProfit: () => ok(0),
      getLots: () => ok(0),
    };
    const ctx = new CalculationContext(mockCalc, 'BUY');
    const calc = new DefaultTakeProfitCalculator(ctx, StopLimitType.DoNotUse, 10, 'BUY');

    const result = calc.calculate({ barIndex: 0, entryPrice: 1.1, direction: 'BUY', stopLoss: 1.09, lots: 0.1 });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe(0);
    }
  });
});

// ---------------------------------------------------------------------------
// RiskToRewardTakeProfitCalculator
// ---------------------------------------------------------------------------
describe('RiskToRewardTakeProfitCalculator', () => {
  it('computes TP based on SL distance and ratio (BUY)', () => {
    const calc = new RiskToRewardTakeProfitCalculator(200, 'BUY');
    const result = calc.calculate({
      barIndex: 0,
      entryPrice: 1.1,
      direction: 'BUY',
      stopLoss: 1.09,
      lots: 0.1,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      // SL distance = 0.01, ratio = 200/100 = 2.0, TP = 1.1 + 0.01*2 = 1.12
      expect(result.value).toBeCloseTo(1.12);
    }
  });

  it('computes TP based on SL distance and ratio (SELL)', () => {
    const calc = new RiskToRewardTakeProfitCalculator(150, 'SELL');
    const result = calc.calculate({
      barIndex: 0,
      entryPrice: 1.1,
      direction: 'SELL',
      stopLoss: 1.12,
      lots: 0.1,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      // SL distance = 0.02, ratio = 150/100 = 1.5, TP = 1.1 - 0.02*1.5 = 1.07
      expect(result.value).toBeCloseTo(1.07);
    }
  });
});
