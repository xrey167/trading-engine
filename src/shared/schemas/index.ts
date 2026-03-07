// Barrel re-export: common schemas + domain schema re-exports
export * from './common.js';

// Domain schemas (defined at source within shared/domain/)
export { TradeSignalEntrySchema } from '../domain/trade-signal.js';
export { TradeStatsSchema, TradeParamsSchema } from '../domain/trade-params.js';
export { PositionInfoVOSchema, DealInfoVOSchema, HistoryOrderInfoVOSchema } from '../domain/position.js';
export { AccountInfoVOSchema, SymbolInfoVOSchema, TickSchema } from '../domain/account.js';
