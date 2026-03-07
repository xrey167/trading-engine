// ─── ScheduledEvent + ScheduledEventCalendar ─────────────────────────────────
//
// A ScheduledEvent is a specific instance of an EventDefinition pinned to a
// date (and optional UTC time). ScheduledEventCalendar wraps TradingCalendar
// and adds strategy-predicate helpers that operate on scheduled instances.
//
// Date convention: `date` is 'YYYY-MM-DD' in exchange-local timezone —
// identical to TradingHoliday.date in country.ts.

import { DateTime } from 'luxon';
import type { TradingCalendar } from '../trading-calendar.js';
import { getEventById } from './catalog.js';
import type { EventDefinition } from './types.js';
import { EventImportance } from './types.js';

export interface ScheduledEvent {
  /** Unique instance id, e.g. 'NFP-2025-07-05' */
  id: string;
  /** Links to EventDefinition.id */
  definitionId: string;
  /** 'YYYY-MM-DD' in exchange-local timezone */
  date: string;
  /** 'HH:mm' UTC — omit when exact time is unknown */
  timeUtc?: string;
  /** Affected instrument ticker, e.g. 'EURUSD' */
  ticker?: string;
  /** Affected currency for quick pair-based filtering, e.g. 'USD' */
  currency?: string;
  forecast?: number;
  previous?: number;
  actual?: number;
}

// ─── ScheduledEventCalendar ──────────────────────────────────────────────────

export class ScheduledEventCalendar {
  private readonly cal: TradingCalendar;
  private events: ScheduledEvent[];

  constructor(tradingCalendar: TradingCalendar, events: ScheduledEvent[] = []) {
    this.cal = tradingCalendar;
    this.events = [...events];
  }

  // ── Mutation ─────────────────────────────────────────────────────────────

  add(event: ScheduledEvent): void {
    this.events.push(event);
  }

  remove(id: string): void {
    this.events = this.events.filter(e => e.id !== id);
  }

  bulkAdd(events: ScheduledEvent[]): void {
    this.events.push(...events);
  }

  // ── Queries ──────────────────────────────────────────────────────────────

  /** All events scheduled on the exchange-local date containing `date`. */
  onDate(date: Date): ScheduledEvent[] {
    const localDate = this.toLocalDateStr(date);
    return this.events.filter(e => e.date === localDate);
  }

  /** Events with dates in [from, to] (both inclusive, exchange-local). */
  between(from: Date, to: Date): ScheduledEvent[] {
    const f = this.toLocalDateStr(from);
    const t = this.toLocalDateStr(to);
    return this.events
      .filter(e => e.date >= f && e.date <= t)
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  /** Next `n` events on or after `from`, sorted ascending. */
  upcoming(from: Date, n = 10): ScheduledEvent[] {
    const f = this.toLocalDateStr(from);
    return this.events
      .filter(e => e.date >= f)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, n);
  }

  forTicker(ticker: string, from?: Date): ScheduledEvent[] {
    const f = from ? this.toLocalDateStr(from) : undefined;
    return this.events
      .filter(e => e.ticker === ticker && (f === undefined || e.date >= f))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  forDefinition(definitionId: string, from?: Date): ScheduledEvent[] {
    const f = from ? this.toLocalDateStr(from) : undefined;
    return this.events
      .filter(e => e.definitionId === definitionId && (f === undefined || e.date >= f))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  // ── Strategy-trigger predicates ──────────────────────────────────────────

  /** `true` when the next scheduled instance of `definitionId` falls today. */
  isEventToday(date: Date, definitionId: string): boolean {
    return this.tradingDaysBeforeEvent(date, definitionId) === 0;
  }

  /** `true` when the next scheduled instance is exactly `n` trading days away. */
  isTradingDaysBeforeEvent(date: Date, definitionId: string, n: number): boolean {
    return this.tradingDaysBeforeEvent(date, definitionId) === n;
  }

  /** Convenience: `true` when the next instance is exactly 1 trading day away. */
  isEventTomorrow(date: Date, definitionId: string): boolean {
    return this.isTradingDaysBeforeEvent(date, definitionId, 1);
  }

  /**
   * `true` when the next scheduled instance of `definitionId` falls within
   * the next 5 trading days (inclusive of today).
   */
  isEventWeek(date: Date, definitionId: string): boolean {
    const days = this.tradingDaysBeforeEvent(date, definitionId);
    return days !== Infinity && days <= 5;
  }

  /**
   * `true` when any HIGH importance event falls on `date`.
   * Optionally filtered by ticker or currency.
   */
  hasHighImpactEventToday(
    date: Date,
    opts?: { ticker?: string; currency?: string },
  ): boolean {
    const todayEvents = this.onDate(date);
    return todayEvents.some(ev => {
      if (opts?.ticker && ev.ticker !== opts.ticker) return false;
      if (opts?.currency && ev.currency !== opts.currency) return false;
      const def = getEventById(ev.definitionId) as EventDefinition | undefined;
      return def ? def.importance >= EventImportance.High : false;
    });
  }

  /**
   * Returns the number of trading days from `date` (inclusive when `date`
   * itself is the event) to the next scheduled instance of `definitionId`.
   * Returns `Infinity` when no future instance is found.
   */
  tradingDaysBeforeEvent(date: Date, definitionId: string): number {
    const localDate = this.toLocalDateStr(date);
    const next = this.events
      .filter(e => e.definitionId === definitionId && e.date >= localDate)
      .sort((a, b) => a.date.localeCompare(b.date))[0];

    if (!next) return Infinity;
    if (next.date === localDate) return 0;

    const zone = this.cal.exchange.timezone;
    const eventDate = DateTime.fromISO(next.date, { zone }).toJSDate();
    return this.cal.tradingDaysBetween(date, eventDate);
  }

  // ── Internal ─────────────────────────────────────────────────────────────

  private toLocalDateStr(date: Date): string {
    return DateTime.fromJSDate(date, { zone: this.cal.exchange.timezone })
      .toFormat('yyyy-MM-dd');
  }
}
