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

export const HistoryOrderType = {
  Buy:          'BUY',
  Sell:         'SELL',
  BuyLimit:     'BUY_LIMIT',
  SellLimit:    'SELL_LIMIT',
  BuyStop:      'BUY_STOP',
  SellStop:     'SELL_STOP',
  BuyStopLimit: 'BUY_STOP_LIMIT',
  SellStopLimit: 'SELL_STOP_LIMIT',
  CloseBy:      'CLOSE_BY',
} as const;
export type HistoryOrderType = (typeof HistoryOrderType)[keyof typeof HistoryOrderType];
