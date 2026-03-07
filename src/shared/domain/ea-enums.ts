// EA / strategy classification enums — ported from quant-lib/domain

export const EAMode = {
  Live:         'LIVE',
  Backtest:     'BACKTEST',
  Optimization: 'OPTIMIZATION',
  Forward:      'FORWARD',
} as const;
export type EAMode = (typeof EAMode)[keyof typeof EAMode];

export const StrategyType = {
  Trend:         'TREND',
  Reversal:      'REVERSAL',
  Breakout:      'BREAKOUT',
  ScalpRange:    'SCALP_RANGE',
  Carry:         'CARRY',
  Arbitrage:     'ARBITRAGE',
  MeanReversion: 'MEAN_REVERSION',
} as const;
export type StrategyType = (typeof StrategyType)[keyof typeof StrategyType];

export const OptimizationTarget = {
  ProfitFactor:      'PROFIT_FACTOR',
  ExpectedPayoff:    'EXPECTED_PAYOFF',
  DrawdownRelative:  'DRAWDOWN_RELATIVE',
  RecoveryFactor:    'RECOVERY_FACTOR',
  SharpeRatio:       'SHARPE_RATIO',
  Custom:            'CUSTOM',
} as const;
export type OptimizationTarget = (typeof OptimizationTarget)[keyof typeof OptimizationTarget];
