// Domain enums as `as const` maps — ported from quant-lib

export const PositionSizeType = {
  Fixed: 'FIXED',
  Percent: 'PERCENT',
  Risk: 'RISK',
  PositionSizeRisk: 'POSITION_SIZE_RISK',
} as const;
export type PositionSizeType = (typeof PositionSizeType)[keyof typeof PositionSizeType];

export const StopLimitType = {
  DoNotUse: 'DO_NOT_USE',
  Percent: 'PERCENT',
  Pips: 'PIPS',
  Absolute: 'ABSOLUTE',
  Dollar: 'DOLLAR',
  RiskBalance: 'RISK_BALANCE',
} as const;
export type StopLimitType = (typeof StopLimitType)[keyof typeof StopLimitType];

export const StopLossType = {
  DoNotUse: 'DO_NOT_USE',
  Percent: 'PERCENT',
  Pips: 'PIPS',
  Absolute: 'ABSOLUTE',
  Dollar: 'DOLLAR',
  RiskBalance: 'RISK_BALANCE',
  PositionSizeRisk: 'POSITION_SIZE_RISK',
  ATRDistance: 'ATR_DISTANCE',
  HighLow: 'HIGH_LOW',
} as const;
export type StopLossType = (typeof StopLossType)[keyof typeof StopLossType];

export const TakeProfitType = {
  DoNotUse: 'DO_NOT_USE',
  Percent: 'PERCENT',
  Pips: 'PIPS',
  Dollar: 'DOLLAR',
  RiskReward: 'RISK_REWARD',
  Absolute: 'ABSOLUTE',
  ATRDistance: 'ATR_DISTANCE',
} as const;
export type TakeProfitType = (typeof TakeProfitType)[keyof typeof TakeProfitType];
