import { BaseCalculator } from '../base-calculator.js';
import type { CalculationContext } from '../calculation-context.js';
import type { ITakeProfitCalculator, TakeProfitParams } from '../types.js';
import type { Result } from '../../../shared/lib/result.js';
import type { DomainError } from '../../../shared/lib/errors.js';
import { ok } from '../../../shared/lib/result.js';
import { StopLimitType } from '../../../shared/domain/risk/risk.js';

/**
 * Default take-profit calculator.
 * Supports Percent, Pips, Dollar, Absolute, and DoNotUse take-profit types.
 * Ported from DefaultTakeProfitStrategy.mqh.
 */
export class DefaultTakeProfitCalculator extends BaseCalculator implements ITakeProfitCalculator {
  constructor(
    private readonly ctx: CalculationContext,
    private readonly takeProfitType: string,
    private readonly takeProfitValue: number,
    direction: 'BUY' | 'SELL',
  ) {
    super(direction);
  }

  calculate(params: TakeProfitParams): Result<number, DomainError> {
    if (this.takeProfitType === StopLimitType.DoNotUse) {
      return ok(0);
    }
    return this.ctx.calculateTakeProfit({
      limitType: this.takeProfitType,
      takeProfitValue: this.takeProfitValue,
      entryPrice: params.entryPrice,
      lots: params.lots,
    });
  }
}
