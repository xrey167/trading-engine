import { BaseCalculator } from '../base-calculator.js';
import type { ITakeProfitCalculator, TakeProfitParams } from '../types.js';
import type { Result } from '../../shared/lib/result.js';
import type { DomainError } from '../../shared/lib/errors.js';
import { ok } from '../../shared/lib/result.js';
import { priceDelta, targetPrice } from '../price-utils.js';

/**
 * Risk-to-reward take-profit calculator.
 * Formula: TP = entryPrice +/- |entryPrice - stopLoss| * (ratio / 100)
 *
 * The MQL5 original divides by 100, treating the ratio as a percentage
 * (e.g. 200 means 2:1 ratio). We preserve this behaviour.
 *
 * Ported from RiskToRewardTakeProfitStrategy.mqh.
 */
export class RiskToRewardTakeProfitCalculator extends BaseCalculator implements ITakeProfitCalculator {
  constructor(
    private readonly ratio: number,
    direction: 'BUY' | 'SELL',
  ) {
    super(direction);
  }

  calculate(params: TakeProfitParams): Result<number, DomainError> {
    const slDistance = priceDelta(params.entryPrice, params.stopLoss);
    const delta = slDistance * (this.ratio / 100);
    return ok(targetPrice(params.entryPrice, delta, 1.0, this.direction));
  }
}
