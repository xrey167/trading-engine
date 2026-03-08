import type { Result } from '../shared/lib/result.js';
import type { DomainError } from '../shared/lib/errors.js';
import type { ITradingCalculator } from './types.js';

export class CalculationContext {
  constructor(
    private readonly calculator: ITradingCalculator,
    readonly direction: 'BUY' | 'SELL',
  ) {}

  calculateStopLoss(params: { limitType: string; stopLossValue: number; entryPrice: number; lots?: number }): Result<number, DomainError> {
    return this.calculator.calculateStopLoss({ ...params, direction: this.direction });
  }

  calculateTakeProfit(params: { limitType: string; takeProfitValue: number; entryPrice: number; lots?: number }): Result<number, DomainError> {
    return this.calculator.calculateTakeProfit({ ...params, direction: this.direction });
  }

  getLots(params: { sizeType: string; lotsValue: number; entryPrice?: number; stopLossDistance?: number }): Result<number, DomainError> {
    return this.calculator.getLots({ ...params, direction: this.direction });
  }
}
