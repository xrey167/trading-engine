import { BaseCalculator } from '../base-calculator.js';
import type { CalculationContext } from '../calculation-context.js';
import type { IStopLossCalculator, StopLossParams } from '../types.js';
import type { Result } from '../../lib/result.js';
import type { DomainError } from '../../lib/errors.js';
import { ok } from '../../lib/result.js';
import { StopLimitType } from '../../domain/enums.js';

/**
 * Default stop-loss calculator.
 * Supports Percent, Pips, Dollar, Absolute, and DoNotUse stop-loss types.
 * Ported from DefaultStopLossStrategy.mqh.
 */
export class DefaultStopLossCalculator extends BaseCalculator implements IStopLossCalculator {
  constructor(
    private readonly ctx: CalculationContext,
    private readonly stopLossType: string,
    private readonly stopLossValue: number,
    direction: 'BUY' | 'SELL',
  ) {
    super(direction);
  }

  calculate(params: StopLossParams): Result<number, DomainError> {
    if (this.stopLossType === StopLimitType.DoNotUse) {
      return ok(0);
    }
    return this.ctx.calculateStopLoss({
      limitType: this.stopLossType,
      stopLossValue: this.stopLossValue,
      entryPrice: params.entryPrice,
      lots: params.lots,
    });
  }
}
