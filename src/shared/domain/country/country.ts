// ─────────────────────────────────────────────────────────────
// Country domain value objects
// ─────────────────────────────────────────────────────────────

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
// Country
// ─────────────────────────────────────────────────────────────

/**
 * A country as a domain value object, bundling ISO metadata, currency,
 * DST observance, regulated exchanges, and national holidays.
 *
 * National holidays close **all** exchanges in the country, independently
 * of each exchange's own holiday calendar.  The `isMarketOpen()` method
 * checks both layers.
 *
 * @example
 * const us = new Country('US', 'United States', 'USD', 'America/New_York', true,
 *   [nyse, nasdaq],
 *   [{ date: '2025-07-04', name: 'Independence Day' }],
 * );
 *
 * us.isMarketOpen(new Date('2025-06-10T14:00:00Z'), 'XNYS'); // true
 * us.isNationalHoliday(new Date('2025-07-04T12:00:00Z'));     // true
 */
export class Country {
  private static readonly _registry: Record<string, Country> = {};

  /** Register a country into the global registry. Called by `countries.ts` at module init. */
  static register(country: Country): void {
    Country._registry[country.isoCode] = country;
  }

  /** All registered countries, keyed by ISO 3166-1 alpha-2 code. */
  static get all(): Readonly<Record<string, Country>> {
    return Country._registry;
  }

  /**
   * Returns the `Country` for a given ISO 3166-1 alpha-2 code, or `undefined`.
   * @example Country.get('US')?.isMarketOpen(new Date(), 'XNYS')
   */
  static get(isoCode: string): Country | undefined {
    return Country._registry[isoCode.toUpperCase()];
  }

  constructor(
    /** ISO 3166-1 alpha-2 code, e.g. `'US'`, `'DE'`, `'JP'`. */
    public readonly isoCode:   string,
    /** Full English country name. */
    public readonly name:      string,
    /** ISO 4217 currency code, e.g. `'USD'`, `'EUR'`, `'JPY'`. */
    public readonly currency:  string,
    /**
     * Primary IANA timezone, e.g. `'America/New_York'`.
     * Used for national holiday date resolution via Luxon.
     * Individual exchanges may operate in a different timezone.
     */
    public readonly timezone:  string,
    /**
     * Whether this country observes Daylight Saving Time.
     * Luxon handles the actual DST offset switching via the IANA database —
     * this flag is informational metadata only.
     */
    public readonly dst:       boolean,
    /** Regulated exchanges domiciled in this country. */
    public readonly exchanges: Exchange[]        = [],
    /**
     * National / bank holidays that close all exchanges in this country,
     * independent of each exchange's own holiday calendar.
     */
    public readonly holidays:  TradingHoliday[] = [],
  ) {}

  // ── Exchange lookup ──────────────────────────────────────────

  /** Returns the exchange with the given MIC, or `undefined`. */
  getExchange(mic: string): Exchange | undefined {
    return this.exchanges.find(e => e.mic === mic);
  }

  /** All MIC codes registered for this country. */
  get exchangeCodes(): string[] {
    return this.exchanges.map(e => e.mic);
  }

  // ── Holiday helpers ──────────────────────────────────────────

  private localDate(date: Date): string {
    return DateTime.fromJSDate(date, { zone: this.timezone }).toFormat('yyyy-MM-dd');
  }

  /**
   * `true` when `date` falls on a national holiday in this country's
   * primary timezone (resolved via Luxon).
   */
  isNationalHoliday(date: Date): boolean {
    return this.holidays.some(h => h.date === this.localDate(date));
  }

  /**
   * `true` when `date` is a national holiday **or** a holiday on the
   * exchange identified by `mic`.
   */
  isHoliday(date: Date, mic: string): boolean {
    if (this.isNationalHoliday(date)) return true;
    return this.getExchange(mic)?.isHoliday(date) ?? false;
  }

  /**
   * `true` when the exchange identified by `mic` is actively trading at `date`.
   *
   * Checks national holidays first; falls back to `Exchange.isOpen()` which
   * handles weekends, exchange holidays, and half-days.
   *
   * Returns `false` if the MIC is not found.
   */
  isMarketOpen(date: Date, mic: string): boolean {
    if (this.isNationalHoliday(date)) return false;
    return this.getExchange(mic)?.isOpen(date) ?? false;
  }
}
