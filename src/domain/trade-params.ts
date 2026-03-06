import { Type, type Static } from '@sinclair/typebox';

export const TradeStatType = {
  Wins:   'WINS',
  Losses: 'LOSSES',
  Total:  'TOTAL',
} as const;
export type TradeStatType = (typeof TradeStatType)[keyof typeof TradeStatType];

export const TradeStatPeriod = {
  Daily:   'DAILY',
  Weekly:  'WEEKLY',
  Monthly: 'MONTHLY',
  All:     'ALL',
} as const;
export type TradeStatPeriod = (typeof TradeStatPeriod)[keyof typeof TradeStatPeriod];

export const TradeStatsSchema = Type.Object({
  wins:   Type.Number(),
  losses: Type.Number(),
  total:  Type.Number(),
  profit: Type.Number(),
});
export type TradeStats = Static<typeof TradeStatsSchema>;

export function makeTradeStats(): TradeStats {
  return { wins: 0, losses: 0, total: 0, profit: 0 };
}
export function addStat(stats: TradeStats, profit: number): TradeStats {
  const win = profit > 0;
  return {
    wins:   stats.wins   + (win ? 1 : 0),
    losses: stats.losses + (win ? 0 : 1),
    total:  stats.total  + 1,
    profit: stats.profit + profit,
  };
}
export function resetStat(): TradeStats {
  return makeTradeStats();
}

export const TradeParamsSchema = Type.Object({
  symbol:    Type.String(),
  timeframe: Type.String(),
  magic:     Type.Number(),
  comment:   Type.Optional(Type.String()),
  maxSlippage: Type.Optional(Type.Number()),
});
export type TradeParams = Static<typeof TradeParamsSchema>;

export function makeTradeParams(overrides?: Partial<TradeParams>): TradeParams {
  return {
    symbol:    'EURUSD',
    timeframe: 'H1',
    magic:     0,
    ...overrides,
  };
}
