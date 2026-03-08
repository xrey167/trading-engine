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
