import type { IMoneyManagementStrategy, ILotsProvider, IStopLossCalculator, ITakeProfitCalculator, MoneyManagementResult, MoneyManagementParams } from './types.js';
import type { Result } from '../shared/lib/result.js';
import type { DomainError } from '../shared/lib/errors.js';
import { ok } from '../shared/lib/result.js';

/**
 * Port of MoneyManagementStrategy.mqh.
 *
 * Composite that wires together three independent strategies:
 *   1. ILotsProvider          -- position size
 *   2. IStopLossCalculator    -- stop-loss price
 *   3. ITakeProfitCalculator  -- take-profit price (receives resolved SL + lots)
 *
 * If any step fails the error is propagated immediately without calling later steps.
 */
export class CompositeMoneyManagementStrategy implements IMoneyManagementStrategy {
  constructor(
    private readonly lotsProvider: ILotsProvider,
    private readonly stopLossCalculator: IStopLossCalculator,
    private readonly takeProfitCalculator: ITakeProfitCalculator,
  ) {}

  async calculate(params: MoneyManagementParams): Promise<Result<MoneyManagementResult, DomainError>> {
    const [lotsResult, slResult] = await Promise.all([
      this.lotsProvider.calculate(params),
      this.stopLossCalculator.calculate(params),
    ]);
    if (!lotsResult.ok) return lotsResult;
    if (!slResult.ok) return slResult;

    const tpResult = await this.takeProfitCalculator.calculate({
      ...params,
      stopLoss: slResult.value,
      lots: lotsResult.value,
    });
    if (!tpResult.ok) return tpResult;

    return ok({
      lots: lotsResult.value,
      stopLoss: slResult.value,
      takeProfit: tpResult.value,
    });
  }
}
