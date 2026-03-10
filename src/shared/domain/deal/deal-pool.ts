import { Pool } from '../pool.js';
import type { Deal } from './deal.js';

// ─────────────────────────────────────────────────────────────
// DealMatcher — typed predicate over Deal
// ─────────────────────────────────────────────────────────────

export type DealMatcher = (d: Deal) => boolean;

// ─────────────────────────────────────────────────────────────
// Common matchers
// ─────────────────────────────────────────────────────────────

export const buyMatcher:        DealMatcher = d => d.isBuy();
export const sellMatcher:       DealMatcher = d => d.isSell();
export const entryMatcher:      DealMatcher = d => d.isEntry();
export const exitMatcher:       DealMatcher = d => d.isExit();
export const profitableMatcher: DealMatcher = d => d.isProfitable();

// ─────────────────────────────────────────────────────────────
// DealPool — typed, composable collection
// ─────────────────────────────────────────────────────────────

export class DealPool extends Pool<Deal> {
  filter(matcher: DealMatcher): DealPool {
    return new DealPool(this.items.filter(matcher));
  }

  totalVolume(): number {
    return this.reduce((n, d) => n + d.volume, 0);
  }

  totalNetProfit(): number {
    return this.reduce((n, d) => n + d.netProfit(), 0);
  }

  /** Volume-weighted average of `deal.price`. Returns 0 when empty. */
  vwap(): number {
    const vol = this.totalVolume();
    if (vol === 0) return 0;
    return this.reduce((n, d) => n + d.volume * d.price, 0) / vol;
  }

  /** Partition by `deal.symbol`. */
  groupBySymbol(): Map<string, DealPool> {
    return this._groupBy(d => d.symbol);
  }

  /** Partition by `deal.positionId`. */
  groupByPosition(): Map<number, DealPool> {
    return this._groupBy(d => d.positionId);
  }

  private _groupBy<K>(keyFn: (d: Deal) => K): Map<K, DealPool> {
    const map = new Map<K, Deal[]>();
    for (const d of this.items) {
      let bucket = map.get(keyFn(d));
      if (!bucket) { bucket = []; map.set(keyFn(d), bucket); }
      bucket.push(d);
    }
    const result = new Map<K, DealPool>();
    for (const [key, bucket] of map) result.set(key, new DealPool(bucket));
    return result;
  }
}
