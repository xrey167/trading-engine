// ─────────────────────────────────────────────────────────────
// Country domain — class + pre-populated instances
// ─────────────────────────────────────────────────────────────

import { DateTime } from 'luxon';
import { Exchange, NYSE, NASDAQ, LSE, XETRA, TSE } from './countryExchanges.js';
import type { TradingHoliday } from './countryExchanges.js';
export type { MarketSession, TradingHoliday } from './countryExchanges.js';
export { Exchange, NYSE, NASDAQ, LSE, XETRA, TSE } from './countryExchanges.js';

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

  /** Register a country into the global registry. Called at module init below. */
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

  /**
   * Returns the local date as `'YYYY-MM-DD'` in this country's primary timezone.
   * @example country.localDate(new Date('2025-10-03T07:00:00Z')) // '2025-10-03' (CEST)
   */
  localDate(date: Date): string {
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

// ─────────────────────────────────────────────────────────────
// Pre-populated country instances
// ─────────────────────────────────────────────────────────────

export const US = new Country(
  'US',
  'United States',
  'USD',
  'America/New_York',
  true,              // observes DST (ET: EST/EDT)
  [NYSE, NASDAQ],
  [],                // national holidays folded into exchange calendars for the US
);

export const GB = new Country(
  'GB',
  'United Kingdom',
  'GBP',
  'Europe/London',
  true,    // observes BST (British Summer Time)
  [LSE],
  [],
);

export const DE = new Country(
  'DE',
  'Germany',
  'EUR',
  'Europe/Berlin',
  true,    // observes CET/CEST
  [XETRA],
  [
    // German national holidays not always on exchange calendar
    { date: '2025-10-03', name: 'German Unity Day' },
    { date: '2026-10-03', name: 'German Unity Day' },
  ],
);

export const JP = new Country(
  'JP',
  'Japan',
  'JPY',
  'Asia/Tokyo',
  false,   // Japan does NOT observe DST
  [TSE],
  [],
);

// ─────────────────────────────────────────────────────────────
// Register all countries
// ─────────────────────────────────────────────────────────────

Country.register(US);
Country.register(GB);
Country.register(DE);
Country.register(JP);
