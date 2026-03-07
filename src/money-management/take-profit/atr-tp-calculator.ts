import { BaseCalculator } from '../base-calculator.js';
import type { ITakeProfitCalculator, IIndicatorGateway, TakeProfitParams } from '../types.js';
import type { Result } from '../../shared/lib/result.js';
import type { DomainError } from '../../shared/lib/errors.js';
import { ok } from '../../shared/lib/result.js';
import { targetPrice } from '../price-utils.js';

/**
 * ATR-based take-profit calculator.
 * TP = entryPrice +/- ATR[barIndex] * multiplier
 * Ported from ATRTakeProfitStrategy.mqh.
 */
export class AtrTakeProfitCalculator extends BaseCalculator implements ITakeProfitCalculator {
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

  async calculate(params: TakeProfitParams): Promise<Result<number, DomainError>> {
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
    return ok(targetPrice(params.entryPrice, delta, 1.0, this.direction));
  }
}
