import { BaseCalculator } from '../base-calculator.js';
import type { CalculationContext } from '../calculation-context.js';
import type { IStopLossCalculator, ILotsProvider, StopLossParams } from '../types.js';
import type { IAccountGateway } from '../../../broker/types.js';
import type { Result } from '../../../shared/lib/result.js';
import type { DomainError } from '../../../shared/lib/errors.js';
import { StopLimitType } from '../../../shared/domain/risk/risk.js';

/**
 * Risk-balance stop-loss calculator.
 * Computes stop-loss as a percentage of account balance.
 * Ported from RiskBalanceStopLossStrategy.mqh.
 */
export class RiskBalanceStopLossCalculator extends BaseCalculator implements IStopLossCalculator {
  private readonly stopLossPercentage: number;

  constructor(
    private readonly ctx: CalculationContext,
    stopLossPercent: number,
    private readonly lotsProvider: ILotsProvider,
    private readonly accountGateway: IAccountGateway,
    private readonly userId: string,
    direction: 'BUY' | 'SELL',
  ) {
    super(direction);
    this.stopLossPercentage = stopLossPercent / 100.0;
  }

  async calculate(params: StopLossParams): Promise<Result<number, DomainError>> {
    const [lotsResult, balanceResult] = await Promise.all([
      this.lotsProvider.calculate({
        barIndex: params.barIndex,
        entryPrice: params.entryPrice,
        direction: this.direction,
      }),
      this.accountGateway.getBalance(this.userId),
    ]);

    if (!lotsResult.ok) return lotsResult;
    if (!balanceResult.ok) return balanceResult;

    const dollars = balanceResult.value * this.stopLossPercentage;

    return this.ctx.calculateStopLoss({
      limitType: StopLimitType.Dollar,
      stopLossValue: dollars,
      entryPrice: params.entryPrice,
      lots: lotsResult.value,
    });
  }
}
