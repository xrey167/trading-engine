import { BaseCalculator } from '../base-calculator.js';
import type { CalculationContext } from '../calculation-context.js';
import type { ILotsProvider, LotsParams } from '../types.js';
import type { Result } from '../../shared/lib/result.js';
import type { DomainError } from '../../shared/lib/errors.js';

/**
 * Default lots provider.
 * Delegates to CalculationContext.getLots() with no SL distance (fixed/balanced sizing).
 * Ported from DefaultLotsProvider.mqh.
 */
export class DefaultLotsProvider extends BaseCalculator implements ILotsProvider {
  constructor(
    private readonly ctx: CalculationContext,
    private readonly lotsType: string,
    private readonly lotsValue: number,
    direction: 'BUY' | 'SELL',
  ) {
    super(direction);
  }

  calculate(params: LotsParams): Result<number, DomainError> {
    return this.ctx.getLots({
      sizeType: this.lotsType,
      lotsValue: this.lotsValue,
      entryPrice: params.entryPrice,
      stopLossDistance: 0,
    });
  }
}
