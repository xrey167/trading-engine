import { describe, it, expect } from 'vitest';
import {
  getEventById,
  queryEvents,
  highImpactEvents,
  eventsByDomain,
  eventsByCountry,
} from './catalog.js';
import { ALL_EVENTS } from './definitions.js';
import { EventDomain, EventImportance, EventSector, EventType } from './types.js';

describe('EventCatalog', () => {
  describe('ALL_EVENTS', () => {
    it('contains more than 200 event definitions', () => {
      expect(ALL_EVENTS.length).toBeGreaterThan(200);
    });

    it('has no duplicate IDs', () => {
      const ids = ALL_EVENTS.map(e => e.id);
      const unique = new Set(ids);
      expect(unique.size).toBe(ids.length);
    });

    it('every event has required fields', () => {
      for (const e of ALL_EVENTS) {
        expect(e.id).toBeTruthy();
        expect(e.name).toBeTruthy();
        expect(typeof e.type).toBe('number');
        expect(typeof e.domain).toBe('number');
        expect(typeof e.importance).toBe('number');
        expect(typeof e.frequency).toBe('number');
      }
    });
  });

  describe('getEventById', () => {
    it('returns NFP by id', () => {
      const e = getEventById('US.JOBS.NFP');
      expect(e).toBeDefined();
      expect(e?.name).toBe('Non-Farm Payrolls');
      expect(e?.importance).toBe(EventImportance.High);
      expect(e?.domain).toBe(EventDomain.Economic);
    });

    it('returns undefined for unknown id', () => {
      expect(getEventById('DOES.NOT.EXIST')).toBeUndefined();
    });

    it('returns ECB rate decision', () => {
      const e = getEventById('EU.MONEY.ECB_RATE');
      expect(e).toBeDefined();
      expect(e?.currency).toBe('EUR');
    });
  });

  describe('queryEvents', () => {
    it('filters by domain', () => {
      const results = queryEvents({ domain: EventDomain.Economic });
      expect(results.length).toBeGreaterThan(50);
      expect(results.every(e => e.domain === EventDomain.Economic)).toBe(true);
    });

    it('filters by multiple domains', () => {
      const results = queryEvents({ domain: [EventDomain.Equity, EventDomain.Pharma] });
      expect(results.length).toBeGreaterThan(0);
      expect(results.every(e =>
        e.domain === EventDomain.Equity || e.domain === EventDomain.Pharma
      )).toBe(true);
    });

    it('filters by minimum importance (>=)', () => {
      const results = queryEvents({ importance: EventImportance.High });
      expect(results.length).toBeGreaterThan(0);
      expect(results.every(e => e.importance >= EventImportance.High)).toBe(true);
    });

    it('filters by country code', () => {
      const us = queryEvents({ countryCode: 'US' });
      expect(us.length).toBeGreaterThan(30);
      expect(us.every(e => e.countryCode === 'US')).toBe(true);
    });

    it('filters by sector', () => {
      const money = queryEvents({ sector: EventSector.Money });
      expect(money.length).toBeGreaterThan(5);
      expect(money.every(e => e.sector === EventSector.Money)).toBe(true);
    });

    it('text search is case-insensitive', () => {
      const results = queryEvents({ search: 'non-farm' });
      expect(results.some(e => e.id === 'US.JOBS.NFP')).toBe(true);
    });

    it('text search on description', () => {
      const results = queryEvents({ search: 'Federal Open Market' });
      expect(results.length).toBeGreaterThan(0);
    });

    it('returns empty array when no match', () => {
      expect(queryEvents({ countryCode: 'ZZ' })).toHaveLength(0);
    });

    it('filters by type', () => {
      const holidays = queryEvents({ type: EventType.Holiday });
      expect(holidays.length).toBeGreaterThan(0);
      expect(holidays.every(e => e.type === EventType.Holiday)).toBe(true);
    });

    it('filters by currency', () => {
      const usd = queryEvents({ currency: 'USD' });
      expect(usd.every(e => e.currency === 'USD')).toBe(true);
    });

    it('combined filters are ANDed', () => {
      const results = queryEvents({
        domain: EventDomain.Economic,
        importance: EventImportance.High,
        countryCode: 'US',
      });
      expect(results.length).toBeGreaterThan(0);
      expect(results.every(e =>
        e.domain === EventDomain.Economic &&
        e.importance >= EventImportance.High &&
        e.countryCode === 'US'
      )).toBe(true);
    });
  });

  describe('highImpactEvents', () => {
    it('returns only HIGH importance events', () => {
      const results = highImpactEvents();
      expect(results.length).toBeGreaterThan(20);
      expect(results.every(e => e.importance >= EventImportance.High)).toBe(true);
    });
  });

  describe('eventsByDomain', () => {
    it('returns all crypto events', () => {
      const results = eventsByDomain(EventDomain.Crypto);
      expect(results.length).toBeGreaterThan(5);
      expect(results.every(e => e.domain === EventDomain.Crypto)).toBe(true);
    });

    it('returns pharma events', () => {
      const results = eventsByDomain(EventDomain.Pharma);
      expect(results.length).toBeGreaterThan(10);
    });
  });

  describe('eventsByCountry', () => {
    it('returns GB events', () => {
      const results = eventsByCountry('GB');
      expect(results.some(e => e.id === 'GB.MONEY.BOE_RATE')).toBe(true);
    });

    it('returns JP events', () => {
      const results = eventsByCountry('JP');
      expect(results.some(e => e.id === 'JP.MONEY.BOJ_RATE')).toBe(true);
    });
  });
});
