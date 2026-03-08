import { BaseCalculator } from '../base-calculator.js';
import type { IStopLossCalculator, IIndicatorGateway, StopLossParams } from '../types.js';
import type { Result } from '../../../shared/lib/result.js';
import type { DomainError } from '../../../shared/lib/errors.js';
import { ok } from '../../../shared/lib/result.js';
import { targetPrice } from '../price-utils.js';

/**
 * ATR-distance stop-loss calculator.
 * SL = entryPrice -/+ ATR[barIndex] * multiplier (opposite side to take-profit).
 * Ported from ATRDistanceStopLossStrategy.mqh.
 */
export class AtrDistanceStopLossCalculator extends BaseCalculator implements IStopLossCalculator {
  constructor(
    direction: 'BUY' | 'SELL',
    private readonly indicatorGateway: IIndicatorGateway,
    private readonly symbol: string,
    private readonly timeframe: string,
    private readonly atrPeriod: number,
    private readonly multiplier: number,
    private readonly userId: string,
  ) {
    super(direction);
  }

  async calculate(params: StopLossParams): Promise<Result<number, DomainError>> {
    const atrResult = await this.indicatorGateway.getAtr(
      {
        symbol: this.symbol,
        timeframe: this.timeframe,
        period: this.atrPeriod,
        barIndex: params.barIndex,
      },
      this.userId,
    );
    if (!atrResult.ok) return atrResult;

    const delta = atrResult.value * this.multiplier;
    const stopDirection = this.direction === 'BUY' ? 'SELL' : 'BUY';
    return ok(targetPrice(params.entryPrice, delta, 1.0, stopDirection));
  }
}
