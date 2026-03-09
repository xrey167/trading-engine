// Backward-compat re-exports — symbols now live in their domain sub-modules.
// Direct importers of engine-enums.ts continue to work unchanged.
export { Side, OrderAttr, LimitConfirm, ExitReason, OrderBase } from './order/order.js';
export { OrderPool, OrderMatcher, buyMatcher, sellMatcher, hasSlMatcher, hasTpMatcher } from './order/order-pool.js';
export { BarsAtrMode, BarBase } from './bar/bar.js';
export { AtrMethod } from './indicator/indicator.js';
export { AssetType } from './symbol/symbol.js';

export { TrailMode, TrailConfig, TrailState, HitResult } from './trail/trail.js';
export { PositionPool, type PositionMatcher } from './position/position-pool.js';
export { DealPool, type DealMatcher } from './deal/deal-pool.js';
