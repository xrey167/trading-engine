import { Pool } from '../pool.js';
import type { OrderBase } from './order.js';

// ─────────────────────────────────────────────────────────────
// OrderMatcher — typed predicate over any OrderBase subtype
// ─────────────────────────────────────────────────────────────

export type OrderMatcher<T extends OrderBase> = (order: T) => boolean;

// ─────────────────────────────────────────────────────────────
// Common matchers
// ─────────────────────────────────────────────────────────────

export const buyMatcher  = <T extends OrderBase>(o: T): boolean => o.isBuy();
export const sellMatcher = <T extends OrderBase>(o: T): boolean => o.isSell();
export const hasSlMatcher = <T extends OrderBase>(o: T): boolean => o.hasStopLoss();
export const hasTpMatcher = <T extends OrderBase>(o: T): boolean => o.hasTakeProfit();

// ─────────────────────────────────────────────────────────────
// OrderPool — typed, composable collection
// ─────────────────────────────────────────────────────────────

export class OrderPool<T extends OrderBase> extends Pool<T> {
  filter(matcher: OrderMatcher<T>): OrderPool<T> {
    return new OrderPool(this.items.filter(matcher));
  }
}
