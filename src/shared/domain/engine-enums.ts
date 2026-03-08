export const Side = { None: 0, Long: 1, Short: -1 } as const;
export type Side = (typeof Side)[keyof typeof Side];

export const TrailMode = {
  None:     0,
  Dst:      1,
  Eop:      2,
  Ma:       3,
  PlhPeak:  5,
  PlhClose: 6,
  Prx:      7,
} as const;
export type TrailMode = (typeof TrailMode)[keyof typeof TrailMode];

export const AtrMethod = { Sma: 0, Ema: 1 } as const;
export type AtrMethod = (typeof AtrMethod)[keyof typeof AtrMethod];

export const BarsAtrMode = {
  Normal:  0,
  Bullish: 1,
  Bearish: -1,
} as const;
export type BarsAtrMode = (typeof BarsAtrMode)[keyof typeof BarsAtrMode];

export const BarBase = {
  HiLo:      'BASE_HILO',
  OpenClose: 'BASE_OPENCLOSE',
} as const;
export type BarBase = (typeof BarBase)[keyof typeof BarBase];

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

export const AssetType = {
  Forex:  'FOREX',
  Stock:  'STOCK',
  Future: 'FUTURE',
  Crypto: 'CRYPTO',
  Index:  'INDEX',
} as const;
export type AssetType = (typeof AssetType)[keyof typeof AssetType];

export type ExitReason = 'SL' | 'TP' | 'SL_BOTH' | 'TP_BOTH';
