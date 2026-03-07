// TradeState bitflags — ported from quant-lib/domain
//
// Usage:
//   let state = TradeState.None;
//   state = addFlag(state, TradeState.Long);
//   state = addFlag(state, TradeState.TrailingActive);
//   hasFlag(state, TradeState.Long)  // true

export const TradeState = {
  None:             0,
  Long:             1 << 0,   // 1
  Short:            1 << 1,   // 2
  PendingBuy:       1 << 2,   // 4
  PendingSell:      1 << 3,   // 8
  StopLossActive:   1 << 4,   // 16
  TakeProfitActive: 1 << 5,   // 32
  TrailingActive:   1 << 6,   // 64
  ScaledIn:         1 << 7,   // 128
  Hedged:           1 << 8,   // 256
} as const;
// TradeState values are plain numbers; the type alias is just number.
export type TradeState = number;

export function hasFlag(state: TradeState, flag: number): boolean {
  return (state & flag) !== 0;
}

export function addFlag(state: TradeState, flag: number): TradeState {
  return state | flag;
}

export function removeFlag(state: TradeState, flag: number): TradeState {
  return state & ~flag;
}
