// ─────────────────────────────────────────────────────────────
// TradingCalendar — trading-day arithmetic for a single Exchange
// ─────────────────────────────────────────────────────────────
//
// All dates are expressed as UTC JS Date objects; local-timezone
// resolution is handled internally by Luxon using the exchange's
// IANA zone so DST transitions are transparent to callers.
//
// Strategy trigger examples:
//   const cal = new TradingCalendar(NYSE);
//   cal.isNthTradingDayOfMonth(today, 3)       // 3rd trading day of month
//   cal.isTradingDaysBeforeHoliday(today, 2)   // 2 days before next holiday
//   cal.isLastNthTradingDayOfMonth(today, 1)   // last trading day of month

import { DateTime } from 'luxon';
import type { Exchange, TradingHoliday } from './country.js';

export class TradingCalendar {
  constructor(public readonly exchange: Exchange) {}

  // ── Core predicate ───────────────────────────────────────────

  /**
   * `true` when the market is open at any point during the calendar day
   * that contains `date` (in the exchange's local timezone).
   *
   * Half-days count as trading days. Weekends and full holidays return `false`.
   */
  isTradingDay(date: Date): boolean {
    const dt = DateTime.fromJSDate(date, { zone: this.exchange.timezone }).startOf('day');
    if (dt.weekday >= 6) return false;   // Sat=6, Sun=7 (Luxon ISO)
    const h = this.exchange.getHoliday(dt.toJSDate());
    return h === undefined || h.halfDay === true;
  }

  // ── Month position ───────────────────────────────────────────

  /**
   * Returns the 1-indexed trading day number for `date` within its month.
   * Returns `0` if `date` is not itself a trading day.
   *
   * @example
   * cal.tradingDayOfMonth(new Date('2025-06-03T14:00:00Z')); // 3 (if Tue after Mon holiday)
   */
  tradingDayOfMonth(date: Date): number {
    if (!this.isTradingDay(date)) return 0;
    const dt     = DateTime.fromJSDate(date, { zone: this.exchange.timezone });
    let   cursor = dt.startOf('month');
    const target = dt.startOf('day');
    let   count  = 0;
    while (cursor <= target) {
      if (this.isTradingDay(cursor.toJSDate())) count++;
      cursor = cursor.plus({ days: 1 });
    }
    return count;
  }

  /**
   * Returns the 1-indexed trading day number counting backwards from the
   * last trading day of the month.
   *
   * `1` = last trading day, `2` = second-to-last, etc.
   * Returns `0` if `date` is not a trading day.
   *
   * @example
   * cal.tradingDayOfMonthFromEnd(lastFriday); // 1
   */
  tradingDayOfMonthFromEnd(date: Date): number {
    if (!this.isTradingDay(date)) return 0;
    const dt   = DateTime.fromJSDate(date, { zone: this.exchange.timezone });
    const total = this.totalTradingDaysInMonth(dt.year, dt.month);
    const pos   = this.tradingDayOfMonth(date);
    return total - pos + 1;
  }

  /**
   * Returns the total number of trading days in the given month.
   * @example cal.totalTradingDaysInMonth(2025, 6); // ~21
   */
  totalTradingDaysInMonth(year: number, month: number): number {
    let cursor = DateTime.fromObject({ year, month, day: 1 }, { zone: this.exchange.timezone });
    let count  = 0;
    while (cursor.month === month) {
      if (this.isTradingDay(cursor.toJSDate())) count++;
      cursor = cursor.plus({ days: 1 });
    }
    return count;
  }

  // ── Nth trading day lookup ───────────────────────────────────

  /**
   * Returns the UTC `Date` of the Nth trading day in the given month.
   * Returns `null` if `n` exceeds the number of trading days in that month.
   *
   * @example
   * cal.nthTradingDayOfMonth(3, 2025, 6); // Date for 3rd trading day of June 2025
   */
  nthTradingDayOfMonth(n: number, year: number, month: number): Date | null {
    let cursor = DateTime.fromObject({ year, month, day: 1 }, { zone: this.exchange.timezone });
    let count  = 0;
    while (cursor.month === month) {
      if (this.isTradingDay(cursor.toJSDate())) {
        count++;
        if (count === n) return cursor.toJSDate();
      }
      cursor = cursor.plus({ days: 1 });
    }
    return null;
  }

  /**
   * Returns the UTC `Date` of the Nth-from-last trading day in the given month.
   * `n = 1` returns the last trading day.
   *
   * @example
   * cal.lastNthTradingDayOfMonth(1, 2025, 6); // last trading day of June 2025
   */
  lastNthTradingDayOfMonth(n: number, year: number, month: number): Date | null {
    const total = this.totalTradingDaysInMonth(year, month);
    return this.nthTradingDayOfMonth(total - n + 1, year, month);
  }

  // ── Strategy trigger predicates ──────────────────────────────

  /**
   * `true` when `date` is the Nth trading day of its month.
   *
   * @example
   * if (cal.isNthTradingDayOfMonth(today, 3)) engine.buy(); // breakout on 3rd day
   */
  isNthTradingDayOfMonth(date: Date, n: number): boolean {
    return this.tradingDayOfMonth(date) === n;
  }

  /**
   * `true` when `date` is the Nth-from-last trading day of its month.
   *
   * @example
   * if (cal.isLastNthTradingDayOfMonth(today, 1)) engine.buy(); // last trading day
   */
  isLastNthTradingDayOfMonth(date: Date, n: number): boolean {
    return this.tradingDayOfMonthFromEnd(date) === n;
  }

  // ── Holiday proximity ────────────────────────────────────────

  /**
   * Returns the next upcoming **full-day** holiday on or after `date`.
   * Half-days are excluded (the market is still open).
   *
   * Searches the exchange's own holiday list only. Combine with
   * `Country.isNationalHoliday()` for country-level holidays if needed.
   */
  nextHoliday(date: Date): TradingHoliday | undefined {
    const from = DateTime.fromJSDate(date, { zone: this.exchange.timezone })
      .toFormat('yyyy-MM-dd');
    return this.exchange.holidays
      .filter(h => !h.halfDay && h.date >= from)
      .sort((a, b) => a.date.localeCompare(b.date))[0];
  }

  /**
   * Returns the number of trading days between `date` (inclusive) and the
   * next full-day holiday (exclusive).
   *
   * Returns `Infinity` when no upcoming holiday is found in the list.
   *
   * @example
   * cal.tradingDaysBeforeNextHoliday(new Date('2025-11-25T14:00:00Z')); // 2 (before Thanksgiving)
   */
  tradingDaysBeforeNextHoliday(date: Date): number {
    const next = this.nextHoliday(date);
    if (!next) return Infinity;
    const holidayStart = DateTime.fromISO(next.date, { zone: this.exchange.timezone }).toJSDate();
    return this.tradingDaysBetween(date, holidayStart);
  }

  /**
   * `true` when `date` is exactly `n` trading days before the next holiday.
   *
   * @example
   * if (cal.isTradingDaysBeforeHoliday(today, 2)) engine.buy(); // 2 days before holiday long
   */
  isTradingDaysBeforeHoliday(date: Date, n: number): boolean {
    return this.tradingDaysBeforeNextHoliday(date) === n;
  }

  // ── Trading-day arithmetic ───────────────────────────────────

  /**
   * Counts trading days from `from` (inclusive) to `to` (exclusive).
   *
   * @example
   * cal.tradingDaysBetween(new Date('2025-06-02'), new Date('2025-06-06')); // 4
   */
  tradingDaysBetween(from: Date, to: Date): number {
    let cursor = DateTime.fromJSDate(from, { zone: this.exchange.timezone }).startOf('day');
    const end  = DateTime.fromJSDate(to,   { zone: this.exchange.timezone }).startOf('day');
    let count  = 0;
    if (cursor >= end) return 0;
    while (cursor < end) {
      if (this.isTradingDay(cursor.toJSDate())) count++;
      cursor = cursor.plus({ days: 1 });
    }
    return count;
  }

  /**
   * Returns a new UTC `Date` that is `n` trading days after (or before, if
   * `n < 0`) the calendar day containing `date`.
   *
   * The returned date is set to midnight of the resulting trading day in the
   * exchange's local timezone, expressed as UTC.
   *
   * @example
   * cal.addTradingDays(new Date('2025-06-06T12:00:00Z'), -2);
   * // → Thursday 2025-06-05 (skip weekend going back)
   */
  addTradingDays(date: Date, n: number): Date {
    let cursor   = DateTime.fromJSDate(date, { zone: this.exchange.timezone }).startOf('day');
    const step   = n >= 0 ? 1 : -1;
    let remaining = Math.abs(n);
    while (remaining > 0) {
      cursor = cursor.plus({ days: step });
      if (this.isTradingDay(cursor.toJSDate())) remaining--;
    }
    return cursor.toJSDate();
  }

  /**
   * Returns the next trading day strictly after `date`.
   * If `date` is itself a trading day, this still returns the following one.
   */
  nextTradingDay(date: Date): Date {
    return this.addTradingDays(date, 1);
  }

  /**
   * Returns the previous trading day strictly before `date`.
   */
  prevTradingDay(date: Date): Date {
    return this.addTradingDays(date, -1);
  }
}
