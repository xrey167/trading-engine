// ─────────────────────────────────────────────────────────────
// Pre-populated country & exchange registry
// ─────────────────────────────────────────────────────────────
//
// Holidays listed for 2025–2026. Update annually or replace with
// a data feed (e.g. OpenBB, Trading Economics API).
//
// Tokyo Stock Exchange note: TSE has a lunch break (11:30–12:30 JST)
// that the current single-session Exchange model does not represent.
// Use isOpen() for morning/afternoon sessions only, or extend Exchange
// with a multi-session array when needed.

import { Country, Exchange } from './country.js';

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

export const US = new Country(
  'US',
  'United States',
  'USD',
  'America/New_York',
  true,              // observes DST (ET: EST/EDT)
  [NYSE, NASDAQ],
  [],                // national holidays folded into exchange calendars for the US
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

export const GB = new Country(
  'GB',
  'United Kingdom',
  'GBP',
  'Europe/London',
  true,    // observes BST (British Summer Time)
  [LSE],
  [],
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
// Register all countries into Country.all / Country.get()
// ─────────────────────────────────────────────────────────────

Country.register(US);
Country.register(GB);
Country.register(DE);
Country.register(JP);
