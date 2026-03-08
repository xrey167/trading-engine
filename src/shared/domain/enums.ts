// Domain enums as `as const` maps — ported from quant-lib
export { MAType, PriceType } from './indicator/indicator.js';

export const OrderSide = {
  BUY: 'BUY',
  SELL: 'SELL',
} as const;
export type OrderSide = (typeof OrderSide)[keyof typeof OrderSide];

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

export const OrderType = {
  Buy: 'BUY',
  Sell: 'SELL',
  BuyLimit: 'BUY_LIMIT',
  SellLimit: 'SELL_LIMIT',
  BuyStop: 'BUY_STOP',
  SellStop: 'SELL_STOP',
  BuyStopLimit: 'BUY_STOP_LIMIT',
  SellStopLimit: 'SELL_STOP_LIMIT',
  CloseBy: 'CLOSE_BY',
} as const;
export type OrderType = (typeof OrderType)[keyof typeof OrderType];

export const OrderFilling = {
  FOK: 'FOK',
  IOC: 'IOC',
  Return: 'RETURN',
} as const;
export type OrderFilling = (typeof OrderFilling)[keyof typeof OrderFilling];

/** All order entry types accepted by the HTTP API (superset of engine's pending-only OrderEntryType). */
export const OrderEntryType = {
  BuyMarket:      'BUY_MARKET',
  SellMarket:     'SELL_MARKET',
  BuyLimit:       'BUY_LIMIT',
  BuyStop:        'BUY_STOP',
  SellLimit:      'SELL_LIMIT',
  SellStop:       'SELL_STOP',
  BuyMIT:         'BUY_MIT',
  SellMIT:        'SELL_MIT',
  BuyStopLimit:   'BUY_STOP_LIMIT',
  SellStopLimit:  'SELL_STOP_LIMIT',
  BuyMTO:         'BUY_MTO',
  SellMTO:        'SELL_MTO',
  BuyLimitTrail:  'BUY_LIMIT_TRAIL',
  BuyStopTrail:   'BUY_STOP_TRAIL',
  SellLimitTrail: 'SELL_LIMIT_TRAIL',
  SellStopTrail:  'SELL_STOP_TRAIL',
} as const;
export type OrderEntryType = (typeof OrderEntryType)[keyof typeof OrderEntryType];
