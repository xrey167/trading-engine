import type { OrderBase } from './order.js';

// ─────────────────────────────────────────────────────────────
// OrderMatcher — typed predicate over any OrderBase subtype
// ─────────────────────────────────────────────────────────────

/**
 * A predicate that tests whether a single order satisfies a condition.
 * Equivalent to MQL4's `OrderMatcher.matches()` but expressed as a
 * plain TypeScript function — no class boilerplate required.
 *
 * @example
 * const profitable: OrderMatcher<Order> = o => o.netProfit() > 0;
 */
export type OrderMatcher<T extends OrderBase> = (order: T) => boolean;

// ─────────────────────────────────────────────────────────────
// Common matchers — usable with any OrderBase subtype
// ─────────────────────────────────────────────────────────────

/** Matches any buy-side order. */
export const buyMatcher  = <T extends OrderBase>(o: T): boolean => o.isBuy();
/** Matches any sell-side order. */
export const sellMatcher = <T extends OrderBase>(o: T): boolean => o.isSell();
/** Matches orders that have an active stop-loss level set. */
export const hasSlMatcher = <T extends OrderBase>(o: T): boolean => o.hasStopLoss();
/** Matches orders that have an active take-profit level set. */
export const hasTpMatcher = <T extends OrderBase>(o: T): boolean => o.hasTakeProfit();

// ─────────────────────────────────────────────────────────────
// OrderPool — typed, composable collection
// ─────────────────────────────────────────────────────────────

/**
 * An immutable, typed view over a collection of `OrderBase` objects.
 *
 * Replaces scattered `.filter()` / `.find()` / `.some()` chains with
 * named, composable operations using `OrderMatcher` predicates.
 *
 * Equivalent to MQL4's `OrderPoolMatcher` + `OrderPoolIter` + `OrderGroup`
 * aggregates, collapsed into a single class because TypeScript arrays don't
 * require the global `OrderSelect()` ceremony.
 *
 * @example
 * const pool = new OrderPool(engine.getOrders());
 * pool.count(buyMatcher);                            // number of buy orders
 * pool.filter(hasSlMatcher);                         // sub-pool with SL set
 * pool.find(o => o.id === id);                       // lookup by id
 * for (const o of pool) { ... }                     // foreachorder equivalent
 * pool.reduce((n, o) => n + o.size, 0);             // total lots (groupLots)
 * pool.map(o => o.size * o.price);                  // lot-price products (for VWAP)
 */
export class OrderPool<T extends OrderBase> {
  constructor(private readonly orders: readonly T[]) {}

  // ── Size ──────────────────────────────────────────────────

  get size(): number { return this.orders.length; }
  get isEmpty(): boolean { return this.orders.length === 0; }

  // ── Query ─────────────────────────────────────────────────

  /**
   * Count orders, optionally filtered by a matcher.
   * Without a matcher, returns the total pool size.
   */
  count(matcher?: OrderMatcher<T>): number {
    if (!matcher) return this.orders.length;
    let n = 0;
    for (const o of this.orders) if (matcher(o)) n++;
    return n;
  }

  /** Return the first order satisfying `matcher`, or `undefined`. */
  find(matcher: OrderMatcher<T>): T | undefined {
    return this.orders.find(matcher);
  }

  /** `true` when at least one order satisfies `matcher`. */
  has(matcher: OrderMatcher<T>): boolean {
    return this.orders.some(matcher);
  }

  // ── Composition ───────────────────────────────────────────

  /**
   * Return a new pool containing only matching orders.
   * Equivalent to MQL4's `OrderPoolMatcher` with an injected matcher.
   *
   * @example
   * const buysWithSL = pool.filter(buyMatcher).filter(hasSlMatcher);
   */
  filter(matcher: OrderMatcher<T>): OrderPool<T> {
    return new OrderPool(this.orders.filter(matcher));
  }

  // ── Iteration ─────────────────────────────────────────────

  /**
   * Native iterator — enables `for...of` directly on the pool.
   * Equivalent to MQL4's `foreachorder` macro.
   *
   * @example
   * for (const order of pool.filter(buyMatcher)) { ... }
   */
  [Symbol.iterator](): Iterator<T> {
    return this.orders[Symbol.iterator]();
  }

  // ── Aggregation ───────────────────────────────────────────

  /**
   * Project each order to a value.
   * Equivalent to MQL4's `OrderGroup` property accessors (groupLots, groupProfit…).
   *
   * @example
   * pool.map(o => o.size)                 // lot sizes
   * pool.map(o => o.size * o.price)       // lot-price products (VWAP numerator)
   */
  map<R>(fn: (order: T) => R): R[] {
    return this.orders.map(fn);
  }

  /**
   * Fold the pool into a single value.
   *
   * @example
   * // total lots (MQL4's groupLots)
   * pool.reduce((n, o) => n + o.size, 0)
   *
   * // volume-weighted average price (MQL4's groupAvg)
   * const lots  = pool.reduce((n, o) => n + o.size, 0);
   * const value = pool.reduce((n, o) => n + o.size * o.price, 0);
   * const vwap  = lots > 0 ? value / lots : 0;
   */
  reduce<R>(fn: (acc: R, order: T) => R, initial: R): R {
    return this.orders.reduce(fn, initial);
  }

  // ── Escape hatch ──────────────────────────────────────────

  /** Raw readonly array — for serialization or engine internals. */
  toArray(): readonly T[] { return this.orders; }
}
