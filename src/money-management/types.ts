import { Type, type Static } from '@sinclair/typebox';
import type { Result } from '../lib/result.js';
import type { DomainError } from '../lib/errors.js';

export type { Result } from '../lib/result.js';
export type { DomainError } from '../lib/errors.js';

export interface MoneyManagementResult {
  readonly lots: number;
  readonly stopLoss: number;
  readonly takeProfit: number;
}

export interface MoneyManagementParams {
  readonly barIndex: number;
  readonly entryPrice: number;
  readonly direction: 'BUY' | 'SELL';
}

// Port of StopLossParams from quant-lib
export interface StopLossParams extends MoneyManagementParams {
  readonly lots?: number;
}

export interface LotsParams extends MoneyManagementParams {}

export interface TakeProfitParams extends MoneyManagementParams {
  readonly stopLoss: number;
  readonly lots: number;
}

export interface ILotsProvider {
  calculate(params: LotsParams): Result<number, DomainError> | Promise<Result<number, DomainError>>;
}
export interface IStopLossCalculator {
  calculate(params: StopLossParams): Result<number, DomainError> | Promise<Result<number, DomainError>>;
}
export interface ITakeProfitCalculator {
  calculate(params: TakeProfitParams): Result<number, DomainError> | Promise<Result<number, DomainError>>;
}
export interface IMoneyManagementStrategy {
  calculate(params: MoneyManagementParams): Promise<Result<MoneyManagementResult, DomainError>>;
}

// Gateway interfaces
export interface IAccountBalanceGateway {
  getBalance(userId: string): Promise<Result<number, DomainError>>;
}
export interface IIndicatorGateway {
  getAtr(params: { symbol: string; timeframe: string; period: number; barIndex: number }, userId: string): Promise<Result<number, DomainError>>;
}
export interface ITradingCalculator {
  calculateStopLoss(params: { direction: 'BUY'|'SELL'; limitType: string; stopLossValue: number; entryPrice: number; lots?: number }): Result<number, DomainError>;
  calculateTakeProfit(params: { direction: 'BUY'|'SELL'; limitType: string; takeProfitValue: number; entryPrice: number; lots?: number }): Result<number, DomainError>;
  getLots(params: { direction: 'BUY'|'SELL'; sizeType: string; lotsValue: number; entryPrice?: number; stopLossDistance?: number }): Result<number, DomainError>;
}

// MoneyManagementFactoryConfig TypeBox schema
export const MoneyManagementFactoryConfigSchema = Type.Object({
  userId:    Type.String({ minLength: 1 }),
  symbol:    Type.String({ minLength: 1 }),
  timeframe: Type.String({ minLength: 1 }),
  direction: Type.Union([Type.Literal('BUY'), Type.Literal('SELL')]),

  // Stop loss
  stopLossType:           Type.String(),
  stopLossValue:          Type.Number(),
  stopLossAtrMultiplier:  Type.Optional(Type.Number({ minimum: 0 })),
  stopLossPipBuffer:      Type.Optional(Type.Number({ minimum: 0 })),

  // Take profit
  takeProfitType:          Type.String(),
  takeProfitValue:         Type.Number(),
  takeProfitAtrMultiplier: Type.Optional(Type.Number({ minimum: 0 })),
  riskRewardRatio:         Type.Optional(Type.Number({ minimum: 0 })),

  // Lots
  lotsType:  Type.String(),
  lotsValue: Type.Number({ minimum: 0 }),
});
export type MoneyManagementFactoryConfig = Static<typeof MoneyManagementFactoryConfigSchema>;
