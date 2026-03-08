import { Type, type Static } from '@sinclair/typebox';

export const Side = { None: 0, Long: 1, Short: -1 } as const;
export type Side = (typeof Side)[keyof typeof Side];

export const OrderAttr = {
  OCO:  'ORDER_ATTR_OCO',
  CO:   'ORDER_ATTR_CO',
  CS:   'ORDER_ATTR_CS',
  REV:  'ORDER_ATTR_REV',
  NET:  'ORDER_ATTR_NET',
  SLTP: 'ORDER_ATTR_SLTP',
  ROL:  'ORDER_ATTR_ROL',
  ROP:  'ORDER_ATTR_ROP',
  MIT:  'ORDER_ATTR_MIT',
  FC:   'ORDER_ATTR_FC',
} as const;
export type OrderAttr = (typeof OrderAttr)[keyof typeof OrderAttr];

export const LimitConfirm = {
  None:      'LIMIT_CONFIRM_NONE',
  Wick:      'LIMIT_CONFIRM_WICK',
  WickBreak: 'LIMIT_CONFIRM_WICKBREAK',
  WickColor: 'LIMIT_CONFIRM_WICKCOLOR',
} as const;
export type LimitConfirm = (typeof LimitConfirm)[keyof typeof LimitConfirm];

export type ExitReason = 'SL' | 'TP' | 'SL_BOTH' | 'TP_BOTH';

export const HistoryOrderInfoVOSchema = Type.Object({
  ticket:        Type.Number(),
  userId:        Type.String(),
  symbol:        Type.String(),
  type:          Type.String(),
  state:         Type.String(),
  volumeInitial: Type.Number(),
  volumeCurrent: Type.Number(),
  priceOpen:     Type.Number(),
  stopLoss:      Type.Number(),
  takeProfit:    Type.Number(),
  timeSetup:     Type.String({ format: 'date-time' }),
  timeDone:      Type.String({ format: 'date-time' }),
  comment:       Type.String(),
});
export type HistoryOrderInfoVO = Static<typeof HistoryOrderInfoVOSchema>;

export const OrderSide = {
  BUY: 'BUY',
  SELL: 'SELL',
} as const;
export type OrderSide = (typeof OrderSide)[keyof typeof OrderSide];

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
