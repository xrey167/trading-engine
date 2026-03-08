// ─────────────────────────────────────────────────────────────────────────────
// Event Catalog — enums + EventDefinition interface
//
// All enums follow the project's `as const` map pattern (see enums.ts).
// Numeric values match the source @trading/event-data package exactly so
// that wire-format compatibility is preserved.
// ─────────────────────────────────────────────────────────────────────────────

export const EventDomain = {
  Economic:    0,
  Equity:      1,
  Pharma:      2,
  Commodity:   3,
  Crypto:      4,
  FixedIncome: 5,
  News:        6,
  Custom:      7,
} as const;
export type EventDomain = (typeof EventDomain)[keyof typeof EventDomain];

export const EventType = {
  Event:     0,
  Indicator: 1,
  Holiday:   2,
} as const;
export type EventType = (typeof EventType)[keyof typeof EventType];

export const EventSector = {
  None:        0,
  Market:      1,
  GDP:         2,
  Jobs:        3,
  Prices:      4,
  Money:       5,
  Trade:       6,
  Government:  7,
  Business:    8,
  Consumer:    9,
  Housing:    10,
  Taxes:      11,
  Holidays:   12,
  Elections:  13,
  Futures:    14,
  Calendar:   15,
  Equity:     16,
  Pharma:     17,
  Commodity:  18,
  FixedIncome:19,
  Crypto:     20,
  Geopolitical:21,
  Energy:     22,
  Sentiment:  23,
} as const;
export type EventSector = (typeof EventSector)[keyof typeof EventSector];

export const EventFrequency = {
  None:    0,
  Week:    1,
  Month:   2,
  Quarter: 3,
  Year:    4,
  Day:     5,
} as const;
export type EventFrequency = (typeof EventFrequency)[keyof typeof EventFrequency];

export const EventImportance = {
  None:     0,
  Low:      1,
  Moderate: 2,
  High:     3,
} as const;
export type EventImportance = (typeof EventImportance)[keyof typeof EventImportance];

export const EventImpact = {
  NA:       0,
  Positive: 1,
  Negative: 2,
} as const;
export type EventImpact = (typeof EventImpact)[keyof typeof EventImpact];

export const EventTimeMode = {
  DateTime:  0,
  Date:      1,
  NoTime:    2,
  Tentative: 3,
} as const;
export type EventTimeMode = (typeof EventTimeMode)[keyof typeof EventTimeMode];

export const EventUnit = {
  None:      0,
  Percent:   1,
  Currency:  2,
  Hour:      3,
  Job:       4,
  Rig:       5,
  USD:       6,
  People:    7,
  Mortgage:  8,
  Vote:      9,
  Barrel:   10,
  CubicFeet:11,
  Position: 12,
  Building: 13,
} as const;
export type EventUnit = (typeof EventUnit)[keyof typeof EventUnit];

export const EventMultiplier = {
  None:      0,
  Thousands: 1,
  Millions:  2,
  Billions:  3,
  Trillions: 4,
} as const;
export type EventMultiplier = (typeof EventMultiplier)[keyof typeof EventMultiplier];

// ─── EventDefinition ─────────────────────────────────────────────────────────

export interface EventDefinition {
  /** Dot-separated identifier, e.g. 'US.JOBS.NFP' */
  id: string;
  name: string;
  type: EventType;
  sector: EventSector;
  domain: EventDomain;
  importance: EventImportance;
  frequency: EventFrequency;
  timeMode: EventTimeMode;
  /** ISO 4217 currency code, or 'ALL' for multi-currency / instrument-agnostic events */
  currency: string;
  unit: EventUnit;
  multiplier: EventMultiplier;
  /** Decimal places for the numeric value */
  digits: number;
  /** ISO 3166-1 alpha-2 country code, or 'WW' for worldwide */
  countryCode?: string;
  /** ISO 3166-1 numeric country id */
  countryId?: number;
  description?: string;
  externalIds?: {
    numericId?: number;
    slug?: string;
    eventCode?: string;
  };
}
