import { BaseCalculator } from '../base-calculator.js';
import type { CalculationContext } from '../calculation-context.js';
import type { IStopLossCalculator, ILotsProvider, StopLossParams } from '../types.js';
import type { Result } from '../../lib/result.js';
import type { DomainError } from '../../lib/errors.js';
import { StopLimitType } from '../../domain/enums.js';

/**
 * Dollar-based stop-loss calculator.
 * Uses a fixed dollar amount as stop-loss distance.
 * Requires ILotsProvider to compute lot size for that dollar risk.
 * Ported from DollarStopLossStrategy.mqh.
 */
export class DollarStopLossCalculator extends BaseCalculator implements IStopLossCalculator {
  constructor(
    private readonly ctx: CalculationContext,
    private readonly stopLossValue: number,
    private readonly lotsProvider: ILotsProvider,
    direction: 'BUY' | 'SELL',
  ) {
    super(direction);
  }

  async calculate(params: StopLossParams): Promise<Result<number, DomainError>> {
    const lotsResult = await this.lotsProvider.calculate({
      barIndex: params.barIndex,
      entryPrice: params.entryPrice,
      direction: this.direction,
    });
    if (!lotsResult.ok) return lotsResult;

    return this.ctx.calculateStopLoss({
      limitType: StopLimitType.Dollar,
      stopLossValue: this.stopLossValue,
      entryPrice: params.entryPrice,
      lots: lotsResult.value,
    });
  }
}
