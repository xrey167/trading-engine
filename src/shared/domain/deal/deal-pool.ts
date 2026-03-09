import type { Deal } from './deal.js';

// ─────────────────────────────────────────────────────────────
// DealMatcher — typed predicate over Deal
// ─────────────────────────────────────────────────────────────

/**
 * A predicate that tests whether a single deal satisfies a condition.
 *
 * @example
 * const profitable: DealMatcher = d => d.netProfit() > 0;
 */
export type DealMatcher = (d: Deal) => boolean;

// ─────────────────────────────────────────────────────────────
// Common matchers
// ─────────────────────────────────────────────────────────────

/** Matches buy deals. */
export const buyMatcher:        DealMatcher = d => d.isBuy();
/** Matches sell deals. */
export const sellMatcher:       DealMatcher = d => d.isSell();
/** Matches deals that open or partially open a position. */
export const entryMatcher:      DealMatcher = d => d.isEntry();
/** Matches deals that close or partially close a position. */
export const exitMatcher:       DealMatcher = d => d.isExit();
/** Matches deals with positive net profit. */
export const profitableMatcher: DealMatcher = d => d.isProfitable();

// ─────────────────────────────────────────────────────────────
// DealPool — typed, composable collection
// ─────────────────────────────────────────────────────────────

/**
 * An immutable, typed view over a collection of `Deal` objects.
 *
 * Replaces scattered `.filter()` / `.find()` / `.some()` chains with
 * named, composable operations using `DealMatcher` predicates.
 *
 * @example
 * const pool = new DealPool(deals);
 * pool.filter(entryMatcher);                 // sub-pool of opening deals
 * pool.groupBySymbol();                      // partition by symbol
 * pool.groupByPosition();                    // partition by positionId
 */
export class DealPool {
  constructor(private readonly deals: readonly Deal[]) {}

  // ── Size ──────────────────────────────────────────────────

  get size(): number     { return this.deals.length; }
  get isEmpty(): boolean { return this.deals.length === 0; }

  // ── Query ─────────────────────────────────────────────────

  /**
   * Count deals, optionally filtered by a matcher.
   * Without a matcher, returns the total pool size.
   */
  count(matcher?: DealMatcher): number {
    if (!matcher) return this.deals.length;
    let n = 0;
    for (const d of this.deals) if (matcher(d)) n++;
    return n;
  }

  /** Return the first deal satisfying `matcher`, or `undefined`. */
  find(matcher: DealMatcher): Deal | undefined {
    return this.deals.find(matcher);
  }

  /** `true` when at least one deal satisfies `matcher`. */
  has(matcher: DealMatcher): boolean {
    return this.deals.some(matcher);
  }

  // ── Composition ───────────────────────────────────────────

  /**
   * Return a new pool containing only matching deals.
   *
   * @example
   * const buyEntries = pool.filter(buyMatcher).filter(entryMatcher);
   */
  filter(matcher: DealMatcher): DealPool {
    return new DealPool(this.deals.filter(matcher));
  }

  // ── Iteration ─────────────────────────────────────────────

  /** Native iterator — enables `for...of` directly on the pool. */
  [Symbol.iterator](): Iterator<Deal> {
    return this.deals[Symbol.iterator]();
  }

  // ── Aggregation ───────────────────────────────────────────

  /** Project each deal to a value. */
  map<R>(fn: (d: Deal) => R): R[] {
    return this.deals.map(fn);
  }

  /** Fold the pool into a single value. */
  reduce<R>(fn: (acc: R, d: Deal) => R, initial: R): R {
    return this.deals.reduce(fn, initial);
  }

  /** Sum of all deal volumes (lots). */
  totalVolume(): number {
    return this.reduce((n, d) => n + d.volume, 0);
  }

  /** Sum of net profit across all deals (profit + commission + swap). */
  totalNetProfit(): number {
    return this.reduce((n, d) => n + d.netProfit(), 0);
  }

  /**
   * Volume-weighted average of `deal.price` (execution price).
   * Returns 0 when the pool is empty.
   *
   * Primary use: compute the true average fill price when a position is
   * built across multiple partial executions (scaled-in entries).
   *
   * @example
   * const avgEntry = pool.filter(entryMatcher).vwap();
   */
  vwap(): number {
    const vol = this.totalVolume();
    if (vol === 0) return 0;
    const value = this.reduce((n, d) => n + d.volume * d.price, 0);
    return value / vol;
  }

  /**
   * Partition this pool by `deal.symbol`.
   * Each entry in the returned map is a sub-pool of deals for that symbol.
   */
  groupBySymbol(): Map<string, DealPool> {
    const map = new Map<string, Deal[]>();
    for (const d of this.deals) {
      let bucket = map.get(d.symbol);
      if (!bucket) { bucket = []; map.set(d.symbol, bucket); }
      bucket.push(d);
    }
    const result = new Map<string, DealPool>();
    for (const [symbol, bucket] of map) result.set(symbol, new DealPool(bucket));
    return result;
  }

  /**
   * Partition this pool by `deal.positionId`.
   * Each entry in the returned map is a sub-pool of deals for that position.
   */
  groupByPosition(): Map<number, DealPool> {
    const map = new Map<number, Deal[]>();
    for (const d of this.deals) {
      let bucket = map.get(d.positionId);
      if (!bucket) { bucket = []; map.set(d.positionId, bucket); }
      bucket.push(d);
    }
    const result = new Map<number, DealPool>();
    for (const [id, bucket] of map) result.set(id, new DealPool(bucket));
    return result;
  }

  // ── Escape hatch ──────────────────────────────────────────

  /** Raw readonly array — for serialization or engine internals. */
  toArray(): readonly Deal[] { return this.deals; }
}
