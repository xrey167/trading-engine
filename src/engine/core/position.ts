import type { Side } from '../../shared/domain/engine-enums.js';
import type { TrailConfig, TrailState } from '../../trading/trailing-stop.js';

export interface PositionSlot {
  side:        Side;
  size:        number;
  openPrice:   number;
  openTime:    Date;
  sl:          number;
  tp:          number;
  slOffsetPts: number;
  tpOffsetPts: number;
  slActive:    boolean;
  tpActive:    boolean;
  trailCfg:   TrailConfig;
  trailState: TrailState;
  trailActive: boolean;
  trailBeginPts: number;
  beActive:   boolean;
  beAddPts:   number;
  barsHeld:    number;
  entryReason: string;
  mae:         number;
  mfe:         number;
}

export interface DealRecord {
  id:          number;
  side:        Side;
  entryPrice:  number;
  exitPrice:   number;
  size:        number;
  openTime:    Date;
  closeTime:   Date;
  barsHeld:    number;
  entryReason: string;
  exitReason:  string;
  plPoints:    number;
  result:      'win' | 'loss' | 'breakeven';
  mae:         number;
  mfe:         number;
}

export interface DealStats {
  totalDeals:     number;
  winningDeals:   number;
  losingDeals:    number;
  breakevenDeals: number;
  grossProfitPts: number;
  grossLossPts:   number;
  netPLPts:       number;
  maxWinStreak:   number;
  maxLossStreak:  number;
  maxDrawdownPts: number;
  marRatio:       number;
}

export function dealStatsComputed(s: DealStats): {
  winRate:         number;
  profitFactor:    number;
  avgWinPts:       number;
  avgLossPts:      number;
  expectedValuePts: number;
} {
  const winRate      = s.totalDeals > 0 ? s.winningDeals / s.totalDeals : 0;
  const profitFactor = s.grossLossPts !== 0 ? Math.abs(s.grossProfitPts / s.grossLossPts) : Infinity;
  const avgWinPts    = s.winningDeals > 0 ? s.grossProfitPts / s.winningDeals : 0;
  const avgLossPts   = s.losingDeals  > 0 ? s.grossLossPts  / s.losingDeals  : 0;
  const expectedValuePts = winRate * avgWinPts + (1 - winRate) * avgLossPts;
  return { winRate, profitFactor, avgWinPts, avgLossPts, expectedValuePts };
}

export interface ExecutionReport {
  price: number;
  time:  Date;
  id:    string;
}

export interface IBrokerAdapter {
  marketOrder(side: Side, size: number, info?: string): Promise<ExecutionReport>;
  closePosition(side: Side, size: number, info?: string): Promise<{ price: number }>;
  updateSLTP(side: Side, sl: number | null, tp: number | null): Promise<void>;
  getSpread(symbol: string): Promise<number>;
  getAccount(): Promise<{ equity: number; balance: number }>;
}
