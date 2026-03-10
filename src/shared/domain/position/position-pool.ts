import { Pool } from '../pool.js';
import type { Position } from './position.js';

// ─────────────────────────────────────────────────────────────
// PositionMatcher — typed predicate over Position
// ─────────────────────────────────────────────────────────────

export type PositionMatcher = (p: Position) => boolean;

// ─────────────────────────────────────────────────────────────
// Common matchers
// ─────────────────────────────────────────────────────────────

export const buyMatcher:        PositionMatcher = p => p.isBuy();
export const sellMatcher:       PositionMatcher = p => p.isSell();
export const hasSlMatcher:      PositionMatcher = p => p.hasStopLoss();
export const hasTpMatcher:      PositionMatcher = p => p.hasTakeProfit();
export const breakevenMatcher:  PositionMatcher = p => p.isBreakeven();
export const profitableMatcher: PositionMatcher = p => p.isProfitable();

// ─────────────────────────────────────────────────────────────
// PositionPool — typed, composable collection
// ─────────────────────────────────────────────────────────────

export class PositionPool extends Pool<Position> {
  filter(matcher: PositionMatcher): PositionPool {
    return new PositionPool(this.items.filter(matcher));
  }

  totalVolume(): number {
    return this.reduce((n, p) => n + p.volume, 0);
  }

  totalNetProfit(): number {
    return this.reduce((n, p) => n + p.netProfit(), 0);
  }

  /** Volume-weighted average of `priceOpen`. Returns 0 when empty. */
  vwap(): number {
    const vol = this.totalVolume();
    if (vol === 0) return 0;
    return this.reduce((n, p) => n + p.volume * p.priceOpen, 0) / vol;
  }
}
