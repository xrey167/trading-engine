import { Type, type Static } from '@sinclair/typebox';

// TradeSignalFlag as bitflag map
export const TradeSignalFlag = {
  None:      0,
  OpenBuy:   1 << 0,
  OpenSell:  1 << 1,
  CloseBuy:  1 << 2,
  CloseSell: 1 << 3,
} as const;
export type TradeSignalFlag = (typeof TradeSignalFlag)[keyof typeof TradeSignalFlag];

export const TradeSignalOp = {
  Add:    'ADD',
  Remove: 'REMOVE',
  Set:    'SET',
} as const;
export type TradeSignalOp = (typeof TradeSignalOp)[keyof typeof TradeSignalOp];

// TypeBox schema for signal entry
export const TradeSignalEntrySchema = Type.Object({
  flags: Type.Number(),
  timestamp: Type.String({ format: 'date-time' }),
});
export type TradeSignalEntry = Static<typeof TradeSignalEntrySchema>;

// Pure bitflag utility functions
export function checkSignals(flags: number, mask: number): boolean {
  return (flags & mask) === mask;
}
export function checkSignalsExact(flags: number, mask: number): boolean {
  return flags === mask;
}
export function addSignals(flags: number, mask: number): number {
  return flags | mask;
}
export function removeSignals(flags: number, mask: number): number {
  return flags & ~mask;
}
export function setSignal(flags: number, mask: number, value: boolean): number {
  return value ? addSignals(flags, mask) : removeSignals(flags, mask);
}
export function isOpenBuy(flags: number): boolean {
  return checkSignals(flags, TradeSignalFlag.OpenBuy);
}
export function isOpenSell(flags: number): boolean {
  return checkSignals(flags, TradeSignalFlag.OpenSell);
}
export function getSignalOp(flags: number, prevFlags: number): TradeSignalOp {
  if (flags === prevFlags) return TradeSignalOp.Set;
  return (flags & ~prevFlags) !== 0 ? TradeSignalOp.Add : TradeSignalOp.Remove;
}
