// ─── Event Catalog barrel ──────────────────────────────────────────────────

export * from './types.js';
export * from './definitions.js';
export * from './catalog.js';
export * from './scheduled.js';

// Domain arrays (for consumers that want a specific subset)
export { US_EVENTS } from './economic-us.js';
export { EU_EVENTS } from './economic-eu.js';
export { GB_EVENTS } from './economic-gb.js';
export { JP_EVENTS } from './economic-jp.js';
export { OTHERS_EVENTS } from './economic-others.js';
export { EQUITY_EVENTS } from './equity.js';
export { PHARMA_EVENTS } from './pharma.js';
export { COMMODITY_EVENTS } from './commodity.js';
export { FIXED_INCOME_EVENTS } from './fixed-income.js';
export { CRYPTO_EVENTS } from './crypto.js';
export { NEWS_EVENTS } from './news.js';
