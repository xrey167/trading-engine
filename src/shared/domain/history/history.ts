// History / deal / order enums — ported from quant-lib/domain

export const DealEntry = {
  In:    'IN',
  Out:   'OUT',
  InOut: 'IN_OUT',
  OutBy: 'OUT_BY',
} as const;
export type DealEntry = (typeof DealEntry)[keyof typeof DealEntry];

export const DealType = {
  Buy:                'BUY',
  Sell:               'SELL',
  Balance:            'BALANCE',
  Credit:             'CREDIT',
  Charge:             'CHARGE',
  Correction:         'CORRECTION',
  Bonus:              'BONUS',
  Commission:         'COMMISSION',
  CommissionDaily:    'COMMISSION_DAILY',
  CommissionMonthly:  'COMMISSION_MONTHLY',
  AgentCommission:    'AGENT_COMMISSION',
  InterestRate:       'INTEREST_RATE',
  BuyCanceled:        'BUY_CANCELED',
  SellCanceled:       'SELL_CANCELED',
  Dividend:           'DIVIDEND',
  DividendFranked:    'DIVIDEND_FRANKED',
  Tax:                'TAX',
} as const;
export type DealType = (typeof DealType)[keyof typeof DealType];

export const DealReason = {
  Client:   'CLIENT',
  Mobile:   'MOBILE',
  Web:      'WEB',
  Expert:   'EXPERT',
  SL:       'SL',
  TP:       'TP',
  SO:       'SO',
  Rollover: 'ROLLOVER',
  Vmargin:  'VMARGIN',
  Split:    'SPLIT',
} as const;
export type DealReason = (typeof DealReason)[keyof typeof DealReason];

export const OrderState = {
  Started:       'STARTED',
  Placed:        'PLACED',
  Canceled:      'CANCELED',
  Partial:       'PARTIAL',
  Filled:        'FILLED',
  Rejected:      'REJECTED',
  Expired:       'EXPIRED',
  RequestAdd:    'REQUEST_ADD',
  RequestModify: 'REQUEST_MODIFY',
  RequestCancel: 'REQUEST_CANCEL',
} as const;
export type OrderState = (typeof OrderState)[keyof typeof OrderState];

// MT5 POSITION_REASON_* — why the position was opened (4 values)
export const PositionReason = {
  Client: 'CLIENT',  // opened by desktop terminal
  Mobile: 'MOBILE',  // opened by mobile app
  Web:    'WEB',     // opened from web platform
  Expert: 'EXPERT',  // opened by EA / script
} as const;
export type PositionReason = (typeof PositionReason)[keyof typeof PositionReason];

// MT5 ORDER_REASON_* — why the order was placed (superset of PositionReason)
export const OrderReason = {
  Client: 'CLIENT',  // placed by desktop terminal
  Mobile: 'MOBILE',  // placed by mobile app
  Web:    'WEB',     // placed from web platform
  Expert: 'EXPERT',  // placed by EA / script
  SL:     'SL',      // placed by SL activation
  TP:     'TP',      // placed by TP activation
  SO:     'SO',      // placed by stop-out
} as const;
export type OrderReason = (typeof OrderReason)[keyof typeof OrderReason];

