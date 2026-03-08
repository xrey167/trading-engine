import { describe, it, expect, beforeEach } from 'vitest';
import { TradingCalendar } from '../calendar/trading-calendar.js';
import { NYSE } from '../country/countries.js';
import { ScheduledEventCalendar } from './scheduled.js';
import type { ScheduledEvent } from './scheduled.js';

// NFP is the first Friday of each month.
// 2025-08-01 is a Friday — use as a canonical NFP date in tests.
const NFP_DATE = '2025-08-01';
const NFP_DEF_ID = 'US.JOBS.NFP';

// ECB rate decision — 2025-09-11 (hypothetical)
const ECB_DATE = '2025-09-11';
const ECB_DEF_ID = 'EU.MONEY.ECB_RATE';

function makeNFP(overrides: Partial<ScheduledEvent> = {}): ScheduledEvent {
  return {
    id: 'nfp-2025-08-01',
    definitionId: NFP_DEF_ID,
    date: NFP_DATE,
    timeUtc: '12:30',
    ticker: 'EURUSD',
    currency: 'USD',
    ...overrides,
  };
}

describe('ScheduledEventCalendar', () => {
  let cal: ScheduledEventCalendar;
  const tradingCal = new TradingCalendar(NYSE);

  beforeEach(() => {
    cal = new ScheduledEventCalendar(tradingCal);
    cal.add(makeNFP());
  });

  // ── Mutation ────────────────────────────────────────────────────────────

  it('add + onDate finds an event', () => {
    const results = cal.onDate(new Date('2025-08-01T14:00:00Z'));
    expect(results).toHaveLength(1);
    expect(results[0].definitionId).toBe(NFP_DEF_ID);
  });

  it('remove deletes an event', () => {
    cal.remove('nfp-2025-08-01');
    expect(cal.onDate(new Date('2025-08-01T14:00:00Z'))).toHaveLength(0);
  });

  it('bulkAdd inserts multiple events', () => {
    cal.bulkAdd([
      { id: 'ecb-1', definitionId: ECB_DEF_ID, date: ECB_DATE, currency: 'EUR' },
      { id: 'ecb-2', definitionId: ECB_DEF_ID, date: '2025-12-11', currency: 'EUR' },
    ]);
    expect(cal.between(
      new Date('2025-09-01T00:00:00Z'),
      new Date('2025-12-31T00:00:00Z'),
    )).toHaveLength(2);
  });

  // ── Queries ─────────────────────────────────────────────────────────────

  it('onDate returns nothing for a different date', () => {
    expect(cal.onDate(new Date('2025-08-02T14:00:00Z'))).toHaveLength(0);
  });

  it('between returns events in range', () => {
    cal.add({ id: 'nfp-sept', definitionId: NFP_DEF_ID, date: '2025-09-05' });
    const results = cal.between(
      new Date('2025-07-01T00:00:00Z'),
      new Date('2025-09-30T00:00:00Z'),
    );
    expect(results).toHaveLength(2);
    // sorted ascending
    expect(results[0].date).toBe(NFP_DATE);
  });

  it('upcoming respects n limit', () => {
    cal.bulkAdd([
      { id: 'a1', definitionId: ECB_DEF_ID, date: '2025-09-11' },
      { id: 'a2', definitionId: ECB_DEF_ID, date: '2025-10-11' },
      { id: 'a3', definitionId: ECB_DEF_ID, date: '2025-11-11' },
    ]);
    const results = cal.upcoming(new Date('2025-08-01T00:00:00Z'), 2);
    expect(results).toHaveLength(2);
  });

  it('forTicker filters by ticker', () => {
    cal.add({ id: 'gbpusd-event', definitionId: 'GB.MONEY.BOE_RATE', date: '2025-08-07', ticker: 'GBPUSD' });
    expect(cal.forTicker('EURUSD')).toHaveLength(1);
    expect(cal.forTicker('GBPUSD')).toHaveLength(1);
    expect(cal.forTicker('USDJPY')).toHaveLength(0);
  });

  it('forDefinition filters by definitionId', () => {
    cal.add({ id: 'ecb-sept', definitionId: ECB_DEF_ID, date: ECB_DATE });
    expect(cal.forDefinition(NFP_DEF_ID)).toHaveLength(1);
    expect(cal.forDefinition(ECB_DEF_ID)).toHaveLength(1);
  });

  // ── Strategy predicates ─────────────────────────────────────────────────

  describe('isEventToday', () => {
    it('returns true on the event date', () => {
      expect(cal.isEventToday(new Date('2025-08-01T14:00:00Z'), NFP_DEF_ID)).toBe(true);
    });

    it('returns false the day before', () => {
      expect(cal.isEventToday(new Date('2025-07-31T14:00:00Z'), NFP_DEF_ID)).toBe(false);
    });

    it('returns false for unknown definitionId', () => {
      expect(cal.isEventToday(new Date('2025-08-01T14:00:00Z'), 'DOES.NOT.EXIST')).toBe(false);
    });
  });

  describe('isTradingDaysBeforeEvent', () => {
    it('returns true 2 trading days before NFP (Wed 2025-07-30)', () => {
      // 2025-07-30 Wed, 2025-07-31 Thu, 2025-08-01 Fri (NFP) → 2 trading days
      expect(
        cal.isTradingDaysBeforeEvent(new Date('2025-07-30T14:00:00Z'), NFP_DEF_ID, 2),
      ).toBe(true);
    });

    it('returns true 1 trading day before NFP (Thu 2025-07-31)', () => {
      expect(
        cal.isTradingDaysBeforeEvent(new Date('2025-07-31T14:00:00Z'), NFP_DEF_ID, 1),
      ).toBe(true);
    });

    it('returns false for wrong n', () => {
      expect(
        cal.isTradingDaysBeforeEvent(new Date('2025-07-30T14:00:00Z'), NFP_DEF_ID, 3),
      ).toBe(false);
    });
  });

  describe('isEventTomorrow', () => {
    it('true on 2025-07-31 (day before NFP)', () => {
      expect(cal.isEventTomorrow(new Date('2025-07-31T14:00:00Z'), NFP_DEF_ID)).toBe(true);
    });

    it('false on 2025-07-30 (two days before)', () => {
      expect(cal.isEventTomorrow(new Date('2025-07-30T14:00:00Z'), NFP_DEF_ID)).toBe(false);
    });
  });

  describe('isEventWeek', () => {
    it('true 3 trading days before', () => {
      // Mon 2025-07-28 → Mon, Tue, Wed, Thu, Fri(NFP) = 4 trading days? Let's check: 2025-07-28 Mon, 07-29 Tue, 07-30 Wed, 07-31 Thu, 08-01 Fri
      // tradingDaysBetween(07-28, 08-01) = 4 (Mon, Tue, Wed, Thu)
      expect(cal.isEventWeek(new Date('2025-07-28T14:00:00Z'), NFP_DEF_ID)).toBe(true);
    });

    it('false when no event found', () => {
      expect(cal.isEventWeek(new Date('2025-08-05T14:00:00Z'), 'NO.EVENT')).toBe(false);
    });
  });

  describe('hasHighImpactEventToday', () => {
    it('returns true on NFP day (NFP is HIGH importance)', () => {
      expect(
        cal.hasHighImpactEventToday(new Date('2025-08-01T14:00:00Z')),
      ).toBe(true);
    });

    it('returns true when filtered by matching currency', () => {
      expect(
        cal.hasHighImpactEventToday(new Date('2025-08-01T14:00:00Z'), { currency: 'USD' }),
      ).toBe(true);
    });

    it('returns false when filtered by non-matching currency', () => {
      expect(
        cal.hasHighImpactEventToday(new Date('2025-08-01T14:00:00Z'), { currency: 'JPY' }),
      ).toBe(false);
    });

    it('returns false when filtered by non-matching ticker', () => {
      expect(
        cal.hasHighImpactEventToday(new Date('2025-08-01T14:00:00Z'), { ticker: 'USDJPY' }),
      ).toBe(false);
    });

    it('returns false on a day with no events', () => {
      expect(
        cal.hasHighImpactEventToday(new Date('2025-08-02T14:00:00Z')),
      ).toBe(false);
    });
  });

  describe('tradingDaysBeforeEvent', () => {
    it('returns 0 on event day', () => {
      expect(cal.tradingDaysBeforeEvent(new Date('2025-08-01T14:00:00Z'), NFP_DEF_ID)).toBe(0);
    });

    it('returns Infinity when no event scheduled', () => {
      expect(cal.tradingDaysBeforeEvent(new Date('2025-08-01T14:00:00Z'), 'NO.EVENT')).toBe(Infinity);
    });

    it('returns Infinity when only past events exist', () => {
      expect(cal.tradingDaysBeforeEvent(new Date('2025-08-02T14:00:00Z'), NFP_DEF_ID)).toBe(Infinity);
    });
  });
});
