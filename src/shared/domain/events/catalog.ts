// ─── Event Catalog — plain query functions ────────────────────────────────────
// Static data never changes at runtime — plain functions match the pattern used
// elsewhere in the project for static domain operations.

import { ALL_EVENTS } from './definitions.js';
import type { EventDefinition } from './types.js';
import { EventDomain, EventImportance, EventSector, EventType, EventFrequency } from './types.js';

export interface EventQuery {
  domain?: EventDomain | EventDomain[];
  sector?: EventSector | EventSector[];
  /** Minimum importance (>=) */
  importance?: EventImportance;
  currency?: string | string[];
  countryCode?: string | string[];
  type?: EventType | EventType[];
  frequency?: EventFrequency;
  /** Case-insensitive substring match against name + description */
  search?: string;
}

// ─── Core queries ─────────────────────────────────────────────────────────────

export function getEventById(id: string): EventDefinition | undefined {
  return ALL_EVENTS.find(e => e.id === id);
}

export function queryEvents(filter: EventQuery): EventDefinition[] {
  return ALL_EVENTS.filter(e => {
    if (filter.domain !== undefined) {
      const domains = Array.isArray(filter.domain) ? filter.domain : [filter.domain];
      if (!domains.includes(e.domain)) return false;
    }
    if (filter.sector !== undefined) {
      const sectors = Array.isArray(filter.sector) ? filter.sector : [filter.sector];
      if (!sectors.includes(e.sector)) return false;
    }
    if (filter.importance !== undefined && e.importance < filter.importance) return false;
    if (filter.currency !== undefined) {
      const currencies = Array.isArray(filter.currency) ? filter.currency : [filter.currency];
      if (!currencies.includes(e.currency)) return false;
    }
    if (filter.countryCode !== undefined) {
      const codes = Array.isArray(filter.countryCode) ? filter.countryCode : [filter.countryCode];
      if (!e.countryCode || !codes.includes(e.countryCode)) return false;
    }
    if (filter.type !== undefined) {
      const types = Array.isArray(filter.type) ? filter.type : [filter.type];
      if (!types.includes(e.type)) return false;
    }
    if (filter.frequency !== undefined && e.frequency !== filter.frequency) return false;
    if (filter.search !== undefined) {
      const q = filter.search.toLowerCase();
      const match = e.name.toLowerCase().includes(q)
        || (e.description?.toLowerCase().includes(q) ?? false);
      if (!match) return false;
    }
    return true;
  });
}

// ─── Convenience helpers ─────────────────────────────────────────────────────

export function highImpactEvents(): EventDefinition[] {
  return queryEvents({ importance: EventImportance.High });
}

export function eventsByDomain(domain: EventDomain): EventDefinition[] {
  return queryEvents({ domain });
}

export function eventsByCountry(code: string): EventDefinition[] {
  return queryEvents({ countryCode: code });
}
