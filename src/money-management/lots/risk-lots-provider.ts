import { BaseCalculator } from '../base-calculator.js';
import type { CalculationContext } from '../calculation-context.js';
import type { ILotsProvider, IStopLossCalculator, LotsParams } from '../types.js';
import type { Result } from '../../shared/lib/result.js';
import type { DomainError } from '../../shared/lib/errors.js';
import { priceDelta } from '../price-utils.js';

/**
 * Risk-based lots provider.
 * 1. Calls stopLossCalculator.calculate() to get the stop-loss price.
 * 2. Computes stop-loss distance = |entryPrice - stopLossPrice|.
 * 3. Calls ctx.getLots() with the SL distance to size position by risk.
 * Ported from RiskLotsProvider.mqh.
 */
export class RiskLotsProvider extends BaseCalculator implements ILotsProvider {
  constructor(
    private readonly ctx: CalculationContext,
    private readonly lotsType: string,
    private readonly lotsValue: number,
    private readonly stopLossCalculator: IStopLossCalculator,
    direction: 'BUY' | 'SELL',
  ) {
    super(direction);
  }

  async calculate(params: LotsParams): Promise<Result<number, DomainError>> {
    const slResult = await this.stopLossCalculator.calculate({
      barIndex: params.barIndex,
      entryPrice: params.entryPrice,
      direction: params.direction,
    });
    if (!slResult.ok) return slResult;

    const stopLossDistance = priceDelta(params.entryPrice, slResult.value);

    return this.ctx.getLots({
      sizeType: this.lotsType,
      lotsValue: this.lotsValue,
      entryPrice: params.entryPrice,
      stopLossDistance,
    });
  }
}
