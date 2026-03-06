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

