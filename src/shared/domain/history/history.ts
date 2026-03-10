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

// ─────────────────────────────────────────────────────────────
// TradeEventFlag — bitflag set describing a trade event
// Ported from DoEasy ENUM_TRADE_EVENT_FLAGS (MetaQuotes, 2018)
// ─────────────────────────────────────────────────────────────

export const TradeEventFlag = {
  None:             0,
  OrderPlaced:      1 << 0,  // pending order was placed
  OrderRemoved:     1 << 1,  // pending order was removed / canceled
  OrderActivated:   1 << 2,  // pending order was activated by price
  PositionOpened:   1 << 3,  // position was opened
  PositionClosed:   1 << 4,  // position was closed
  BalanceOperation: 1 << 5,  // balance/credit operation
  Partial:          1 << 6,  // partial execution
  ByPos:            1 << 7,  // executed by opposite position (close-by)
  ClosedBySL:       1 << 8,  // closed by stop-loss
  ClosedByTP:       1 << 9,  // closed by take-profit
} as const;
export type TradeEventFlag = (typeof TradeEventFlag)[keyof typeof TradeEventFlag];

/** Combine multiple TradeEventFlag bits into a single bitmask. */
export function tradeEventFlags(...flags: TradeEventFlag[]): number {
  return flags.reduce((acc, f) => acc | f, 0);
}

/** Test whether a bitmask includes a given flag. */
export function hasTradeEventFlag(mask: number, flag: TradeEventFlag): boolean {
  return flag !== 0 && (mask & flag) !== 0;
}

// ─────────────────────────────────────────────────────────────
// OrderStatus — unified classifier for all order-like entities
// Ported from DoEasy ENUM_ORDER_STATUS (MetaQuotes, 2018)
// ─────────────────────────────────────────────────────────────

export const OrderStatus = {
  MarketPending:  'MARKET_PENDING',   // active pending order
  MarketOrder:    'MARKET_ORDER',     // active market order (rare in MT5)
  MarketPosition: 'MARKET_POSITION',  // open position
  HistoryOrder:   'HISTORY_ORDER',    // filled / canceled market order in history
  HistoryPending: 'HISTORY_PENDING',  // removed pending order in history
  Balance:        'BALANCE',          // balance operation
  Credit:         'CREDIT',           // credit operation
  Deal:           'DEAL',             // executed deal
  Unknown:        'UNKNOWN',
} as const;
export type OrderStatus = (typeof OrderStatus)[keyof typeof OrderStatus];

