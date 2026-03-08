// Domain enums as `as const` maps — ported from quant-lib

export const DayOfWeek = {
  Sunday: 0,
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
} as const;
export type DayOfWeek = (typeof DayOfWeek)[keyof typeof DayOfWeek];

export const MAType = {
  SMA: 0,
  EMA: 1,
  DEMA: 2,
  TEMA: 3,
  VWMA: 4,
  Hull: 5,
  RMA: 6,
  LinearRegression: 7,
} as const;
export type MAType = (typeof MAType)[keyof typeof MAType];

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

export const PriceType = {
  Close: 0,
  Open: 1,
  High: 2,
  Low: 3,
  Median: 4,
  Typical: 5,
  Weighted: 6,
  MedianBody: 7,
  Average: 8,
  TrendBiased: 9,
  Volume: 10,
} as const;
export type PriceType = (typeof PriceType)[keyof typeof PriceType];

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
