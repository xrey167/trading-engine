// Barrel re-exports — convenience aggregation of domain symbols.
export { Side, OrderAttr, LimitConfirm, ExitReason, OrderBase } from './order/order.js';
export { OrderPool, OrderMatcher, buyMatcher, sellMatcher, hasSlMatcher, hasTpMatcher } from './order/order-pool.js';
export { BarsAtrMode, BarBase } from './bar/bar.js';
export { AtrMethod } from './indicator/indicator.js';
export { AssetType } from './symbol/symbol.js';

export { TrailMode, TrailConfig, TrailState, HitResult } from './trail/trail.js';
export { PositionPool, type PositionMatcher } from './position/position-pool.js';
export { DealPool, type DealMatcher } from './deal/deal-pool.js';
export { PositionReason, OrderReason, TradeEventFlag, tradeEventFlags, hasTradeEventFlag, OrderStatus } from './history/history.js';
export { AccountStopoutMode, Account, AccountVOFactory } from './account/account.js';
