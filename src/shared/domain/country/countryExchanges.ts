// ─────────────────────────────────────────────────────────────
// Exchange domain — class + pre-populated instances
// ─────────────────────────────────────────────────────────────
//
// Holidays listed for 2025–2026. Update annually or replace with
// a data feed (e.g. OpenBB, Trading Economics API).
//
// Tokyo Stock Exchange note: TSE has a lunch break (11:30–12:30 JST)
// that the current single-session Exchange model does not represent.
// Use isOpen() for morning/afternoon sessions only, or extend Exchange
// with a multi-session array when needed.

import { DateTime } from 'luxon';

/**
 * Open and close times for a market session expressed as local `'HH:MM'`
 * strings (24-hour). Timezone resolution is handled by the owning `Exchange`.
 *
 * @example
 * const nyse: MarketSession = { open: '09:30', close: '16:00' };
 */
export interface MarketSession {
  /** Local open time, e.g. `'09:30'`. */
  open:  string;
  /** Local close time, e.g. `'16:00'`. */
  close: string;
}

/**
 * A single non-trading day for an exchange or country.
 *
 * Set `halfDay: true` and supply `earlyClose` for short sessions
 * (e.g. Christmas Eve on US exchanges closes at `'13:00'`).
 */
export interface TradingHoliday {
  /** `'YYYY-MM-DD'` in the exchange's or country's local timezone. */
  date:        string;
  /** Human-readable name, e.g. `'Christmas Day'`. */
  name:        string;
  /** True when the market closes early rather than being fully closed. */
  halfDay?:    boolean;
  /** Early close time as `'HH:MM'` — only meaningful when `halfDay` is true. */
  earlyClose?: string;
}

// ─────────────────────────────────────────────────────────────
// Exchange
// ─────────────────────────────────────────────────────────────

/**
 * A regulated trading venue identified by its ISO 10383 MIC code.
 *
 * All timezone math delegates to **Luxon** (`DateTime.fromJSDate` with an
 * IANA zone), which resolves DST transitions automatically via the
 * platform's `Intl` implementation.
 *
 * Luxon weekday convention: `1` = Monday … `7` = Sunday (ISO 8601).
 *
 * @example
 * const nyse = new Exchange('XNYS', 'New York Stock Exchange', 'America/New_York',
 *   { open: '09:30', close: '16:00' },
 *   [{ date: '2025-12-25', name: 'Christmas Day' }],
 * );
 *
 * nyse.isOpen(new Date('2025-06-10T14:00:00Z')); // true  (10:00 ET, in session)
 * nyse.isOpen(new Date('2025-06-10T21:00:00Z')); // false (17:00 ET, after close)
 */
export class Exchange {
  constructor(
    /** ISO 10383 Market Identifier Code, e.g. `'XNYS'`, `'XNAS'`, `'XLON'`. */
    public readonly mic:      string,
    /** Full exchange name. */
    public readonly name:     string,
    /**
     * IANA timezone for this exchange, e.g. `'America/New_York'`.
     * Luxon resolves DST automatically using this zone.
     */
    public readonly timezone: string,
    /** Regular trading session hours in local time. */
    public readonly session:  MarketSession,
    /** Exchange-specific non-trading days (overrides country-level holidays). */
    public readonly holidays: TradingHoliday[] = [],
  ) {}

  // ── Luxon helpers ────────────────────────────────────────────

  /**
   * Returns a Luxon `DateTime` for `date` expressed in this exchange's timezone.
   * All DST offsets are resolved by Luxon via the IANA database.
   */
  private dt(date: Date): DateTime {
    return DateTime.fromJSDate(date, { zone: this.timezone });
  }

  /**
   * Returns the local date as `'YYYY-MM-DD'` in this exchange's timezone.
   * @example exchange.localDate(new Date('2025-06-10T14:00:00Z')) // '2025-06-10'
   */
  localDate(date: Date): string {
    return this.dt(date).toFormat('yyyy-MM-dd');
  }

  /**
   * Returns the local time as `'HH:MM'` (24-hour) in this exchange's timezone.
   * @example exchange.localTime(new Date('2025-06-10T14:00:00Z')) // '10:00' (ET)
   */
  localTime(date: Date): string {
    return this.dt(date).toFormat('HH:mm');
  }

  /**
   * Returns the ISO weekday in this exchange's timezone.
   * Luxon convention: `1` = Monday, `7` = Sunday.
   */
  localWeekday(date: Date): number {
    return this.dt(date).weekday;
  }

  /**
   * `true` when `date` falls on a Saturday (6) or Sunday (7) in this
   * exchange's timezone. Override in a subclass for 24/7 venues (e.g. crypto).
   */
  isWeekend(date: Date): boolean {
    const wd = this.localWeekday(date);
    return wd === 6 || wd === 7;
  }

  // ── Holiday checks ───────────────────────────────────────────

  /**
   * Returns the holiday entry for `date` if one exists, otherwise `undefined`.
   * Date comparison uses the exchange's local timezone via Luxon.
   */
  getHoliday(date: Date): TradingHoliday | undefined {
    const d = this.localDate(date);
    return this.holidays.find(h => h.date === d);
  }

  /**
   * `true` when `date` falls on a full (non-half-day) exchange holiday.
   */
  isHoliday(date: Date): boolean {
    const h = this.getHoliday(date);
    return h !== undefined && !h.halfDay;
  }

  // ── Session check ────────────────────────────────────────────

  /**
   * `true` when the exchange is actively trading at the given UTC `date`.
   *
   * Rules applied in order:
   * 1. Weekend (Sat/Sun in local timezone) → closed
   * 2. Full holiday → closed
   * 3. Half-day holiday → open only until `earlyClose`
   * 4. Otherwise → open when `session.open ≤ localTime < closeTime`
   *
   * Time comparison uses `'HH:MM'` strings which sort correctly
   * lexicographically for 24-hour zero-padded values.
   */
  isOpen(date: Date): boolean {
    if (this.isWeekend(date)) return false;

    const holiday = this.getHoliday(date);
    if (holiday && !holiday.halfDay) return false;

    const time      = this.localTime(date);
    const closeTime = holiday?.halfDay && holiday.earlyClose
      ? holiday.earlyClose
      : this.session.close;

    return time >= this.session.open && time < closeTime;
  }

  /**
   * Returns a human-readable description of the current session status
   * and the local time at this exchange.
   *
   * @example exchange.sessionInfo(new Date()) // 'XNYS 10:32 ET — OPEN'
   */
  sessionInfo(date: Date): string {
    const local  = this.dt(date);
    const time   = local.toFormat('HH:mm');
    const offset = local.toFormat('ZZZZ');   // e.g. 'EDT', 'EST'
    const status = this.isOpen(date) ? 'OPEN' : 'CLOSED';
    return `${this.mic} ${time} ${offset} — ${status}`;
  }
}

// ─────────────────────────────────────────────────────────────
// United States
// ─────────────────────────────────────────────────────────────

const US_HOLIDAYS_2025_2026 = [
  // 2025
  { date: '2025-01-01', name: "New Year's Day" },
  { date: '2025-01-20', name: 'Martin Luther King Jr. Day' },
  { date: '2025-02-17', name: "Presidents' Day" },
  { date: '2025-04-18', name: 'Good Friday' },
  { date: '2025-05-26', name: 'Memorial Day' },
  { date: '2025-06-19', name: 'Juneteenth' },
  { date: '2025-07-04', name: 'Independence Day' },
  { date: '2025-09-01', name: 'Labor Day' },
  { date: '2025-11-27', name: 'Thanksgiving Day' },
  { date: '2025-11-28', name: 'Day After Thanksgiving', halfDay: true, earlyClose: '13:00' },
  { date: '2025-12-24', name: 'Christmas Eve',          halfDay: true, earlyClose: '13:00' },
  { date: '2025-12-25', name: 'Christmas Day' },
  // 2026
  { date: '2026-01-01', name: "New Year's Day" },
  { date: '2026-01-19', name: 'Martin Luther King Jr. Day' },
  { date: '2026-02-16', name: "Presidents' Day" },
  { date: '2026-04-03', name: 'Good Friday' },
  { date: '2026-05-25', name: 'Memorial Day' },
  { date: '2026-06-19', name: 'Juneteenth' },
  { date: '2026-07-03', name: 'Independence Day (observed)' },
  { date: '2026-09-07', name: 'Labor Day' },
  { date: '2026-11-26', name: 'Thanksgiving Day' },
  { date: '2026-11-27', name: 'Day After Thanksgiving', halfDay: true, earlyClose: '13:00' },
  { date: '2026-12-24', name: 'Christmas Eve',          halfDay: true, earlyClose: '13:00' },
  { date: '2026-12-25', name: 'Christmas Day' },
];

export const NYSE = new Exchange(
  'XNYS',
  'New York Stock Exchange',
  'America/New_York',
  { open: '09:30', close: '16:00' },
  US_HOLIDAYS_2025_2026,
);

export const NASDAQ = new Exchange(
  'XNAS',
  'NASDAQ',
  'America/New_York',
  { open: '09:30', close: '16:00' },
  US_HOLIDAYS_2025_2026,
);

// ─────────────────────────────────────────────────────────────
// United Kingdom
// ─────────────────────────────────────────────────────────────

export const LSE = new Exchange(
  'XLON',
  'London Stock Exchange',
  'Europe/London',
  { open: '08:00', close: '16:30' },
  [
    // 2025
    { date: '2025-01-01', name: "New Year's Day" },
    { date: '2025-04-18', name: 'Good Friday' },
    { date: '2025-04-21', name: 'Easter Monday' },
    { date: '2025-05-05', name: 'Early May Bank Holiday' },
    { date: '2025-05-26', name: 'Spring Bank Holiday' },
    { date: '2025-08-25', name: 'Summer Bank Holiday' },
    { date: '2025-12-25', name: 'Christmas Day' },
    { date: '2025-12-26', name: 'Boxing Day' },
    // 2026
    { date: '2026-01-01', name: "New Year's Day" },
    { date: '2026-04-03', name: 'Good Friday' },
    { date: '2026-04-06', name: 'Easter Monday' },
    { date: '2026-05-04', name: 'Early May Bank Holiday' },
    { date: '2026-05-25', name: 'Spring Bank Holiday' },
    { date: '2026-08-31', name: 'Summer Bank Holiday' },
    { date: '2026-12-25', name: 'Christmas Day' },
    { date: '2026-12-28', name: 'Boxing Day (observed)' },
  ],
);

// ─────────────────────────────────────────────────────────────
// Germany
// ─────────────────────────────────────────────────────────────

export const XETRA = new Exchange(
  'XETR',
  'Xetra (Frankfurt)',
  'Europe/Berlin',
  { open: '09:00', close: '17:30' },
  [
    // 2025
    { date: '2025-01-01', name: "New Year's Day" },
    { date: '2025-04-18', name: 'Good Friday' },
    { date: '2025-04-21', name: 'Easter Monday' },
    { date: '2025-05-01', name: 'Labour Day' },
    { date: '2025-12-24', name: 'Christmas Eve',  halfDay: true, earlyClose: '14:00' },
    { date: '2025-12-25', name: 'Christmas Day' },
    { date: '2025-12-26', name: 'Boxing Day' },
    { date: '2025-12-31', name: "New Year's Eve", halfDay: true, earlyClose: '14:00' },
    // 2026
    { date: '2026-01-01', name: "New Year's Day" },
    { date: '2026-04-03', name: 'Good Friday' },
    { date: '2026-04-06', name: 'Easter Monday' },
    { date: '2026-05-01', name: 'Labour Day' },
    { date: '2026-12-24', name: 'Christmas Eve',  halfDay: true, earlyClose: '14:00' },
    { date: '2026-12-25', name: 'Christmas Day' },
    { date: '2026-12-28', name: 'Boxing Day (observed)' },
    { date: '2026-12-31', name: "New Year's Eve", halfDay: true, earlyClose: '14:00' },
  ],
);

// ─────────────────────────────────────────────────────────────
// Japan
// ─────────────────────────────────────────────────────────────

export const TSE = new Exchange(
  'XTKS',
  'Tokyo Stock Exchange',
  'Asia/Tokyo',
  // Afternoon session only (09:00–11:30 + 12:30–15:30).
  // Model limitation: single-session — use { open: '09:00', close: '15:30' }
  // and filter out the 11:30–12:30 window manually if needed.
  { open: '09:00', close: '15:30' },
  [
    // 2025
    { date: '2025-01-01', name: "New Year's Day" },
    { date: '2025-01-02', name: 'Bank Holiday' },
    { date: '2025-01-03', name: 'Bank Holiday' },
    { date: '2025-01-13', name: 'Coming of Age Day' },
    { date: '2025-02-11', name: 'National Foundation Day' },
    { date: '2025-02-24', name: 'Emperor Birthday (observed)' },
    { date: '2025-03-20', name: 'Vernal Equinox Day' },
    { date: '2025-04-29', name: 'Showa Day' },
    { date: '2025-05-03', name: 'Constitution Memorial Day' },
    { date: '2025-05-04', name: "Greenery Day" },
    { date: '2025-05-05', name: "Children's Day" },
    { date: '2025-07-21', name: 'Marine Day' },
    { date: '2025-08-11', name: 'Mountain Day' },
    { date: '2025-09-15', name: 'Respect for the Aged Day' },
    { date: '2025-09-23', name: 'Autumnal Equinox Day' },
    { date: '2025-10-13', name: 'Sports Day' },
    { date: '2025-11-03', name: 'Culture Day' },
    { date: '2025-11-24', name: 'Labour Thanksgiving Day (observed)' },
    { date: '2025-12-31', name: 'Bank Holiday' },
    // 2026
    { date: '2026-01-01', name: "New Year's Day" },
    { date: '2026-01-02', name: 'Bank Holiday' },
    { date: '2026-01-03', name: 'Bank Holiday' },
    { date: '2026-12-31', name: 'Bank Holiday' },
  ],
);
