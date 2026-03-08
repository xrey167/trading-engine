import { describe, it, expect } from 'vitest';
import { NYSE, NASDAQ, XETRA, TSE, US, GB, DE, JP } from './countries.js';
import { Country } from './country.js';

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

/** Build a UTC Date from a local ISO string + IANA zone offset. */
function utc(iso: string): Date { return new Date(iso); }

// ─────────────────────────────────────────────────────────────
// Exchange.localDate / localTime / localWeekday
// ─────────────────────────────────────────────────────────────

describe('Exchange — Luxon timezone helpers', () => {
  it('localDate returns YYYY-MM-DD in exchange timezone', () => {
    // 2025-06-10 02:00 UTC = 2025-06-09 22:00 ET (EDT, UTC-4)
    expect(NYSE.localDate(utc('2025-06-10T02:00:00Z'))).toBe('2025-06-09');
    // 2025-06-10 14:00 UTC = 2025-06-10 10:00 ET
    expect(NYSE.localDate(utc('2025-06-10T14:00:00Z'))).toBe('2025-06-10');
  });

  it('localTime returns HH:mm in exchange timezone', () => {
    // 14:00 UTC = 10:00 EDT (UTC-4, summer)
    expect(NYSE.localTime(utc('2025-06-10T14:00:00Z'))).toBe('10:00');
    // 14:30 UTC = 09:30 EST (UTC-5, winter)
    expect(NYSE.localTime(utc('2025-01-14T14:30:00Z'))).toBe('09:30');
  });

  it('localWeekday returns 1=Mon … 7=Sun (Luxon ISO)', () => {
    // 2025-06-09 is a Monday
    expect(NYSE.localWeekday(utc('2025-06-09T14:00:00Z'))).toBe(1);
    // 2025-06-14 is a Saturday
    expect(NYSE.localWeekday(utc('2025-06-14T14:00:00Z'))).toBe(6);
    // 2025-06-15 is a Sunday
    expect(NYSE.localWeekday(utc('2025-06-15T14:00:00Z'))).toBe(7);
  });
});

// ─────────────────────────────────────────────────────────────
// Exchange.isWeekend
// ─────────────────────────────────────────────────────────────

describe('Exchange.isWeekend', () => {
  it('weekday (Mon–Fri) returns false', () => {
    expect(NYSE.isWeekend(utc('2025-06-10T14:00:00Z'))).toBe(false); // Tuesday
  });

  it('Saturday returns true', () => {
    expect(NYSE.isWeekend(utc('2025-06-14T14:00:00Z'))).toBe(true);
  });

  it('Sunday returns true', () => {
    expect(NYSE.isWeekend(utc('2025-06-15T14:00:00Z'))).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────
// Exchange.isOpen — NYSE
// ─────────────────────────────────────────────────────────────

describe('Exchange.isOpen — NYSE (America/New_York)', () => {
  it('opens at 09:30 ET — open at 09:30', () => {
    // 2025-06-10 13:30 UTC = 09:30 EDT → exactly open
    expect(NYSE.isOpen(utc('2025-06-10T13:30:00Z'))).toBe(true);
  });

  it('open during session — 10:00 ET', () => {
    // 2025-06-10 14:00 UTC = 10:00 EDT
    expect(NYSE.isOpen(utc('2025-06-10T14:00:00Z'))).toBe(true);
  });

  it('closed before session — 09:29 ET', () => {
    // 2025-06-10 13:29 UTC = 09:29 EDT
    expect(NYSE.isOpen(utc('2025-06-10T13:29:00Z'))).toBe(false);
  });

  it('closed at 16:00 ET (close is exclusive)', () => {
    // 2025-06-10 20:00 UTC = 16:00 EDT
    expect(NYSE.isOpen(utc('2025-06-10T20:00:00Z'))).toBe(false);
  });

  it('closed after session — 17:00 ET', () => {
    // 2025-06-10 21:00 UTC = 17:00 EDT
    expect(NYSE.isOpen(utc('2025-06-10T21:00:00Z'))).toBe(false);
  });

  it('closed on Saturday', () => {
    expect(NYSE.isOpen(utc('2025-06-14T15:00:00Z'))).toBe(false);
  });

  it('closed on Sunday', () => {
    expect(NYSE.isOpen(utc('2025-06-15T15:00:00Z'))).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────
// Exchange.isOpen — DST transition awareness
// ─────────────────────────────────────────────────────────────

describe('Exchange.isOpen — DST (summer EDT vs winter EST)', () => {
  it('summer: 09:30 ET (EDT, UTC-4) = 13:30 UTC → open', () => {
    expect(NYSE.isOpen(utc('2025-06-10T13:30:00Z'))).toBe(true);
  });

  it('winter: 09:30 ET (EST, UTC-5) = 14:30 UTC → open', () => {
    expect(NYSE.isOpen(utc('2025-01-14T14:30:00Z'))).toBe(true);
  });

  it('winter: 13:30 UTC (08:30 EST) → closed (pre-market)', () => {
    expect(NYSE.isOpen(utc('2025-01-14T13:30:00Z'))).toBe(false);
  });

  it('Japan: no DST — same UTC offset year-round', () => {
    // 09:00 JST = 00:00 UTC all year
    expect(TSE.isOpen(utc('2025-06-10T00:00:00Z'))).toBe(true);  // summer
    expect(TSE.isOpen(utc('2025-01-14T00:00:00Z'))).toBe(true);  // winter
  });
});

// ─────────────────────────────────────────────────────────────
// Exchange.isOpen — holidays
// ─────────────────────────────────────────────────────────────

describe('Exchange.isOpen — holidays', () => {
  it('Thanksgiving (full day) → closed', () => {
    // 2025-11-27 14:00 UTC = 09:00 EST (would normally be open)
    expect(NYSE.isOpen(utc('2025-11-27T14:00:00Z'))).toBe(false);
  });

  it('Day After Thanksgiving (half-day, earlyClose 13:00) → open at 11:00 ET', () => {
    // 2025-11-28 16:00 UTC = 11:00 EST
    expect(NYSE.isOpen(utc('2025-11-28T16:00:00Z'))).toBe(true);
  });

  it('Day After Thanksgiving (half-day) → closed at 13:00 ET', () => {
    // 2025-11-28 18:00 UTC = 13:00 EST
    expect(NYSE.isOpen(utc('2025-11-28T18:00:00Z'))).toBe(false);
  });

  it('Christmas Eve (half-day) → open at 11:00 ET', () => {
    // 2025-12-24 16:00 UTC = 11:00 EST
    expect(NYSE.isOpen(utc('2025-12-24T16:00:00Z'))).toBe(true);
  });

  it('Christmas Eve (half-day) → closed at 13:00 ET', () => {
    // 2025-12-24 18:00 UTC = 13:00 EST
    expect(NYSE.isOpen(utc('2025-12-24T18:00:00Z'))).toBe(false);
  });

  it('Christmas Day → closed', () => {
    expect(NYSE.isOpen(utc('2025-12-25T14:00:00Z'))).toBe(false);
  });

  it('Xetra Christmas Eve early close at 14:00 CET', () => {
    // 2025-12-24 12:00 UTC = 13:00 CET → open
    expect(XETRA.isOpen(utc('2025-12-24T12:00:00Z'))).toBe(true);
    // 2025-12-24 13:00 UTC = 14:00 CET → closed (earlyClose)
    expect(XETRA.isOpen(utc('2025-12-24T13:00:00Z'))).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────
// Exchange.getHoliday / isHoliday
// ─────────────────────────────────────────────────────────────

describe('Exchange.getHoliday / isHoliday', () => {
  it('returns the holiday entry for a known date', () => {
    const h = NYSE.getHoliday(utc('2025-12-25T14:00:00Z'));
    expect(h).toBeDefined();
    expect(h?.name).toBe('Christmas Day');
  });

  it('returns undefined for a normal trading day', () => {
    expect(NYSE.getHoliday(utc('2025-06-10T14:00:00Z'))).toBeUndefined();
  });

  it('isHoliday is false for a half-day (market still opens)', () => {
    expect(NYSE.isHoliday(utc('2025-11-28T14:00:00Z'))).toBe(false);
  });

  it('isHoliday is true for a full-day holiday', () => {
    expect(NYSE.isHoliday(utc('2025-12-25T14:00:00Z'))).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────
// Exchange.sessionInfo
// ─────────────────────────────────────────────────────────────

describe('Exchange.sessionInfo', () => {
  it('returns OPEN during session', () => {
    const info = NYSE.sessionInfo(utc('2025-06-10T14:00:00Z'));
    expect(info).toMatch(/XNYS/);
    expect(info).toMatch(/OPEN/);
    expect(info).toMatch(/10:00/);
  });

  it('returns CLOSED outside session', () => {
    const info = NYSE.sessionInfo(utc('2025-06-10T21:00:00Z'));
    expect(info).toMatch(/CLOSED/);
  });
});

// ─────────────────────────────────────────────────────────────
// Country helpers
// ─────────────────────────────────────────────────────────────

describe('Country.isNationalHoliday', () => {
  it('German Unity Day is a national holiday', () => {
    // 2025-10-03 09:00 CEST = 07:00 UTC
    expect(DE.isNationalHoliday(utc('2025-10-03T07:00:00Z'))).toBe(true);
  });

  it('normal trading day is not a national holiday', () => {
    expect(DE.isNationalHoliday(utc('2025-06-10T07:00:00Z'))).toBe(false);
  });
});

describe('Country.isMarketOpen', () => {
  it('US NYSE open on a normal Tuesday morning', () => {
    expect(US.isMarketOpen(utc('2025-06-10T14:00:00Z'), 'XNYS')).toBe(true);
  });

  it('US NYSE closed on Independence Day (holiday on exchange calendar)', () => {
    // 2025-07-04 is a Friday; 14:00 UTC = 10:00 ET — would normally be open.
    // US folds national holidays into each exchange's own holiday list, so
    // isMarketOpen delegates to NYSE.isOpen which finds the holiday entry.
    expect(US.isMarketOpen(utc('2025-07-04T14:00:00Z'), 'XNYS')).toBe(false);
    expect(NYSE.isOpen(utc('2025-07-04T14:00:00Z'))).toBe(false);
  });

  it('DE Xetra closed on German Unity Day (country-level holiday)', () => {
    // 2025-10-03 09:00 CEST = 07:00 UTC — in session otherwise
    expect(DE.isMarketOpen(utc('2025-10-03T07:00:00Z'), 'XETR')).toBe(false);
  });

  it('returns false for unknown MIC', () => {
    expect(US.isMarketOpen(utc('2025-06-10T14:00:00Z'), 'XXXX')).toBe(false);
  });

  it('GB LSE open on a normal Tuesday morning', () => {
    // 2025-06-10 09:00 BST = 08:00 UTC
    expect(GB.isMarketOpen(utc('2025-06-10T08:00:00Z'), 'XLON')).toBe(true);
  });

  it('JP TSE closed on Coming of Age Day', () => {
    // 2025-01-13 00:00 UTC = 09:00 JST
    expect(JP.isMarketOpen(utc('2025-01-13T00:00:00Z'), 'XTKS')).toBe(false);
  });
});

describe('Country.isHoliday', () => {
  it('Xetra Good Friday is an exchange holiday in DE → isHoliday returns true', () => {
    // 2025-04-18 09:00 CEST = 07:00 UTC
    expect(DE.isHoliday(utc('2025-04-18T07:00:00Z'), 'XETR')).toBe(true);
  });
});

describe('Country.getExchange / exchangeCodes', () => {
  it('getExchange returns the correct exchange', () => {
    expect(US.getExchange('XNYS')).toBe(NYSE);
    expect(US.getExchange('XNAS')).toBe(NASDAQ);
  });

  it('getExchange returns undefined for unknown MIC', () => {
    expect(US.getExchange('XXXX')).toBeUndefined();
  });

  it('exchangeCodes returns all MICs', () => {
    expect(US.exchangeCodes).toEqual(['XNYS', 'XNAS']);
    expect(GB.exchangeCodes).toEqual(['XLON']);
  });
});

// ─────────────────────────────────────────────────────────────
// Registry
// ─────────────────────────────────────────────────────────────

describe('Country registry (Country.all / Country.get)', () => {
  it('all four countries are in the registry', () => {
    expect(Country.all.US).toBe(US);
    expect(Country.all.GB).toBe(GB);
    expect(Country.all.DE).toBe(DE);
    expect(Country.all.JP).toBe(JP);
  });

  it('Country.get is case-insensitive', () => {
    expect(Country.get('us')).toBe(US);
    expect(Country.get('GB')).toBe(GB);
  });

  it('Country.get returns undefined for unknown code', () => {
    expect(Country.get('ZZ')).toBeUndefined();
  });

  it('DST flags are correct', () => {
    expect(US.dst).toBe(true);
    expect(GB.dst).toBe(true);
    expect(DE.dst).toBe(true);
    expect(JP.dst).toBe(false);   // Japan does not observe DST
  });

  it('currencies are correct', () => {
    expect(US.currency).toBe('USD');
    expect(GB.currency).toBe('GBP');
    expect(DE.currency).toBe('EUR');
    expect(JP.currency).toBe('JPY');
  });
});
