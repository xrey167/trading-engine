import type { Position } from './position.js';

// ─────────────────────────────────────────────────────────────
// PositionMatcher — typed predicate over Position
// ─────────────────────────────────────────────────────────────

/**
 * A predicate that tests whether a single position satisfies a condition.
 *
 * @example
 * const profitable: PositionMatcher = p => p.netProfit() > 0;
 */
export type PositionMatcher = (p: Position) => boolean;

// ─────────────────────────────────────────────────────────────
// Common matchers
// ─────────────────────────────────────────────────────────────

/** Matches buy positions. */
export const buyMatcher:       PositionMatcher = p => p.isBuy();
/** Matches sell positions. */
export const sellMatcher:      PositionMatcher = p => p.isSell();
/** Matches positions that have an active stop-loss set. */
export const hasSlMatcher:     PositionMatcher = p => p.hasStopLoss();
/** Matches positions that have an active take-profit set. */
export const hasTpMatcher:     PositionMatcher = p => p.hasTakeProfit();
/** Matches positions where the SL is at or past the open price (cannot lose). */
export const breakevenMatcher: PositionMatcher = p => p.isBreakeven();
/** Matches positions with positive net profit. */
export const profitableMatcher: PositionMatcher = p => p.isProfitable();

// ─────────────────────────────────────────────────────────────
// PositionPool — typed, composable collection
// ─────────────────────────────────────────────────────────────

/**
 * An immutable, typed view over a collection of `Position` objects.
 *
 * Replaces scattered `.filter()` / `.find()` / `.some()` chains with
 * named, composable operations using `PositionMatcher` predicates.
 *
 * @example
 * const pool = new PositionPool(positions);
 * pool.count(buyMatcher);                         // number of buy positions
 * pool.filter(hasSlMatcher);                      // sub-pool with SL set
 * pool.filter(buyMatcher).filter(hasSlMatcher);   // composed filters
 * pool.totalVolume();                             // sum of all lots
 * pool.vwap();                                    // volume-weighted average open price
 */
export class PositionPool {
  constructor(private readonly positions: readonly Position[]) {}

  // ── Size ──────────────────────────────────────────────────

  get size(): number    { return this.positions.length; }
  get isEmpty(): boolean { return this.positions.length === 0; }

  // ── Query ─────────────────────────────────────────────────

  /**
   * Count positions, optionally filtered by a matcher.
   * Without a matcher, returns the total pool size.
   */
  count(matcher?: PositionMatcher): number {
    if (!matcher) return this.positions.length;
    let n = 0;
    for (const p of this.positions) if (matcher(p)) n++;
    return n;
  }

  /** Return the first position satisfying `matcher`, or `undefined`. */
  find(matcher: PositionMatcher): Position | undefined {
    return this.positions.find(matcher);
  }

  /** `true` when at least one position satisfies `matcher`. */
  has(matcher: PositionMatcher): boolean {
    return this.positions.some(matcher);
  }

  // ── Composition ───────────────────────────────────────────

  /**
   * Return a new pool containing only matching positions.
   *
   * @example
   * const buysWithSL = pool.filter(buyMatcher).filter(hasSlMatcher);
   */
  filter(matcher: PositionMatcher): PositionPool {
    return new PositionPool(this.positions.filter(matcher));
  }

  // ── Iteration ─────────────────────────────────────────────

  /** Native iterator — enables `for...of` directly on the pool. */
  [Symbol.iterator](): Iterator<Position> {
    return this.positions[Symbol.iterator]();
  }

  // ── Aggregation ───────────────────────────────────────────

  /** Project each position to a value. */
  map<R>(fn: (p: Position) => R): R[] {
    return this.positions.map(fn);
  }

  /** Fold the pool into a single value. */
  reduce<R>(fn: (acc: R, p: Position) => R, initial: R): R {
    return this.positions.reduce(fn, initial);
  }

  /** Sum of all position volumes (lots). */
  totalVolume(): number {
    return this.reduce((n, p) => n + p.volume, 0);
  }

  /** Sum of net profit across all positions (profit + commission + swap). */
  totalNetProfit(): number {
    return this.reduce((n, p) => n + p.netProfit(), 0);
  }

  /**
   * Volume-weighted average of `priceOpen`.
   * Returns 0 when the pool is empty.
   */
  vwap(): number {
    const vol = this.totalVolume();
    if (vol === 0) return 0;
    const value = this.reduce((n, p) => n + p.volume * p.priceOpen, 0);
    return value / vol;
  }

  // ── Escape hatch ──────────────────────────────────────────

  /** Raw readonly array — for serialization or engine internals. */
  toArray(): readonly Position[] { return this.positions; }
}
