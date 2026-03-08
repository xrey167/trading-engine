// Backward-compat re-exports — symbols now live in their domain sub-modules.
// Direct importers of engine-enums.ts continue to work unchanged.
export { Side, OrderAttr, LimitConfirm, ExitReason } from './order/order.js';
export { BarsAtrMode, BarBase } from './bar/bar.js';
export { AtrMethod } from './indicator/indicator.js';
export { AssetType } from './symbol/symbol.js';

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
