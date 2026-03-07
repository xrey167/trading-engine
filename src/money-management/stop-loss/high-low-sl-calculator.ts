import { BaseCalculator } from '../base-calculator.js';
import type { IStopLossCalculator, StopLossParams } from '../types.js';
import type { Result } from '../../shared/lib/result.js';
import type { DomainError } from '../../shared/lib/errors.js';
import { ok, err } from '../../shared/lib/result.js';
import { insufficientData } from '../../shared/lib/errors.js';
import type { Bars } from '../../../trading-engine.js';

export interface IBarFetcher {
  getBars(symbol: string, timeframe: string): Promise<Result<Bars, DomainError>>;
}

/**
 * High/Low stop-loss calculator.
 * BUY  -> SL placed at bar.low  - pipBuffer
 * SELL -> SL placed at bar.high + pipBuffer
 * Ported from HighLowStopLossStrategy.mqh.
 */
export class HighLowStopLossCalculator extends BaseCalculator implements IStopLossCalculator {
  constructor(
    direction: 'BUY' | 'SELL',
    private readonly barFetcher: IBarFetcher,
    private readonly symbol: string,
    private readonly timeframe: string,
    private readonly pipBuffer: number,
  ) {
    super(direction);
  }

  async calculate(params: StopLossParams): Promise<Result<number, DomainError>> {
    const barsResult = await this.barFetcher.getBars(this.symbol, this.timeframe);
    if (!barsResult.ok) return barsResult;

    const bars = barsResult.value;
    if (params.barIndex >= bars.length) {
      return err(insufficientData(params.barIndex + 1, bars.length));
    }

    const stopPrice = this.isLong()
      ? bars.low(params.barIndex) - this.pipBuffer
      : bars.high(params.barIndex) + this.pipBuffer;

    return ok(stopPrice);
  }
}
