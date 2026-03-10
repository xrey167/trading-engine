// ─────────────────────────────────────────────────────────────
// Pool<T> — generic immutable collection with composable predicates
// ─────────────────────────────────────────────────────────────

/**
 * An immutable, typed view over a readonly array of `T`.
 *
 * Provides composable query, filter, and aggregation operations.
 * Domain-specific pools (OrderPool, PositionPool, DealPool) extend
 * this with their own matchers and aggregate helpers.
 *
 * @typeParam T  The element type held by the pool.
 */
export abstract class Pool<T> {
  constructor(protected readonly items: readonly T[]) {}

  // ── Size ──────────────────────────────────────────────────

  get size(): number     { return this.items.length; }
  get isEmpty(): boolean { return this.items.length === 0; }

  // ── Query ─────────────────────────────────────────────────

  /** Count items, optionally filtered by a predicate. */
  count(predicate?: (item: T) => boolean): number {
    if (!predicate) return this.items.length;
    let n = 0;
    for (const item of this.items) if (predicate(item)) n++;
    return n;
  }

  /** Return the first item satisfying `predicate`, or `undefined`. */
  find(predicate: (item: T) => boolean): T | undefined {
    return this.items.find(predicate);
  }

  /** `true` when at least one item satisfies `predicate`. */
  has(predicate: (item: T) => boolean): boolean {
    return this.items.some(predicate);
  }

  // ── Composition ───────────────────────────────────────────

  /** Return a new pool of the same type containing only matching items. */
  abstract filter(predicate: (item: T) => boolean): Pool<T>;

  // ── Iteration ─────────────────────────────────────────────

  [Symbol.iterator](): Iterator<T> {
    return this.items[Symbol.iterator]();
  }

  // ── Aggregation ───────────────────────────────────────────

  map<R>(fn: (item: T) => R): R[] {
    return this.items.map(fn);
  }

  reduce<R>(fn: (acc: R, item: T) => R, initial: R): R {
    return this.items.reduce(fn, initial);
  }

  // ── Escape hatch ──────────────────────────────────────────

  toArray(): readonly T[] { return this.items; }
}
