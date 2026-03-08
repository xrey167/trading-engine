// ─── ALL_EVENTS barrel ───────────────────────────────────────────────────────
// Combines all domain arrays into a single readonly array.
// Import this instead of individual domain files when you need the full catalog.

import { US_EVENTS } from './economic-us.js';
import { EU_EVENTS } from './economic-eu.js';
import { GB_EVENTS } from './economic-gb.js';
import { JP_EVENTS } from './economic-jp.js';
import { OTHERS_EVENTS } from './economic-others.js';
import { EQUITY_EVENTS } from './equity.js';
import { PHARMA_EVENTS } from './pharma.js';
import { COMMODITY_EVENTS } from './commodity.js';
import { FIXED_INCOME_EVENTS } from './fixed-income.js';
import { CRYPTO_EVENTS } from './crypto.js';
import { NEWS_EVENTS } from './news.js';
import type { EventDefinition } from './types.js';

export const ALL_EVENTS: readonly EventDefinition[] = [
  ...US_EVENTS,
  ...EU_EVENTS,
  ...GB_EVENTS,
  ...JP_EVENTS,
  ...OTHERS_EVENTS,
  ...EQUITY_EVENTS,
  ...PHARMA_EVENTS,
  ...COMMODITY_EVENTS,
  ...FIXED_INCOME_EVENTS,
  ...CRYPTO_EVENTS,
  ...NEWS_EVENTS,
] as const;
