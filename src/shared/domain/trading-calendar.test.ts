import { describe, it, expect } from 'vitest';
import { TradingCalendar } from './trading-calendar.js';
import { NYSE } from './countries.js';

// NYSE: America/New_York, 09:30–16:00, standard US holiday calendar
const cal = new TradingCalendar(NYSE);

function utc(iso: string): Date { return new Date(iso); }

// ─────────────────────────────────────────────────────────────
// isTradingDay
// ─────────────────────────────────────────────────────────────

describe('TradingCalendar.isTradingDay', () => {
  it('regular weekday is a trading day', () => {
    expect(cal.isTradingDay(utc('2025-06-10T14:00:00Z'))).toBe(true); // Tuesday
  });

  it('Saturday is not a trading day', () => {
    expect(cal.isTradingDay(utc('2025-06-07T14:00:00Z'))).toBe(false);
  });

  it('Sunday is not a trading day', () => {
    expect(cal.isTradingDay(utc('2025-06-08T14:00:00Z'))).toBe(false);
  });

  it('full holiday (Christmas) is not a trading day', () => {
    expect(cal.isTradingDay(utc('2025-12-25T14:00:00Z'))).toBe(false);
  });

  it('half-day (Christmas Eve) IS a trading day', () => {
    expect(cal.isTradingDay(utc('2025-12-24T14:00:00Z'))).toBe(true);
  });

  it('Thanksgiving is not a trading day', () => {
    expect(cal.isTradingDay(utc('2025-11-27T14:00:00Z'))).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────
// tradingDayOfMonth
// ─────────────────────────────────────────────────────────────

describe('TradingCalendar.tradingDayOfMonth', () => {
  // June 2025: no holidays. Mon 2 = day 1, Tue 3 = day 2, Wed 4 = day 3 ...
  it('June 2, 2025 (Monday) = 1st trading day', () => {
    expect(cal.tradingDayOfMonth(utc('2025-06-02T14:00:00Z'))).toBe(1);
  });

  it('June 3, 2025 (Tuesday) = 2nd trading day', () => {
    expect(cal.tradingDayOfMonth(utc('2025-06-03T14:00:00Z'))).toBe(2);
  });

  it('June 4, 2025 (Wednesday) = 3rd trading day', () => {
    expect(cal.tradingDayOfMonth(utc('2025-06-04T14:00:00Z'))).toBe(3);
  });

  it('weekend returns 0', () => {
    // June 7 is a Saturday
    expect(cal.tradingDayOfMonth(utc('2025-06-07T14:00:00Z'))).toBe(0);
  });

  it('holiday returns 0', () => {
    expect(cal.tradingDayOfMonth(utc('2025-12-25T14:00:00Z'))).toBe(0);
  });

  // July 2025: Jul 4 (Friday) is a holiday.
  // Jul 1 (Tue)=1, Jul 2 (Wed)=2, Jul 3 (Thu)=3, Jul 4 HOLIDAY, Jul 7 (Mon)=4
  it('July 7, 2025 skips Independence Day → 4th trading day', () => {
    expect(cal.tradingDayOfMonth(utc('2025-07-07T14:00:00Z'))).toBe(4);
  });

  it('July 3, 2025 (day before July 4 holiday) = 3rd trading day', () => {
    expect(cal.tradingDayOfMonth(utc('2025-07-03T14:00:00Z'))).toBe(3);
  });
});

// ─────────────────────────────────────────────────────────────
// tradingDayOfMonthFromEnd / totalTradingDaysInMonth
// ─────────────────────────────────────────────────────────────

describe('TradingCalendar.totalTradingDaysInMonth', () => {
  it('June 2025 has 20 trading days (Juneteenth Jun 19 is a holiday)', () => {
    expect(cal.totalTradingDaysInMonth(2025, 6)).toBe(20);
  });

  it('July 2025 has 22 trading days (Jul 4 holiday, Juneteenth in June)', () => {
    expect(cal.totalTradingDaysInMonth(2025, 7)).toBe(22);
  });

  it('November 2025 has 19 trading days (Thanksgiving + day-after)', () => {
    // Nov has 30 days. Weekends remove ~8. Thanksgiving (27th) removes 1.
    // Day after (28th) is a half-day (counts as trading day).
    expect(cal.totalTradingDaysInMonth(2025, 11)).toBe(19);
  });
});

describe('TradingCalendar.tradingDayOfMonthFromEnd', () => {
  it('last trading day of June 2025 is the 30th (Monday)', () => {
    // June 30 is a Monday, no holiday → last trading day
    expect(cal.tradingDayOfMonthFromEnd(utc('2025-06-30T14:00:00Z'))).toBe(1);
  });

  it('second-to-last trading day of June 2025 is June 27 (Friday)', () => {
    expect(cal.tradingDayOfMonthFromEnd(utc('2025-06-27T14:00:00Z'))).toBe(2);
  });

  it('non-trading day returns 0', () => {
    expect(cal.tradingDayOfMonthFromEnd(utc('2025-06-07T14:00:00Z'))).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────
// nthTradingDayOfMonth / lastNthTradingDayOfMonth
// ─────────────────────────────────────────────────────────────

describe('TradingCalendar.nthTradingDayOfMonth', () => {
  it('1st trading day of June 2025 is June 2 (Monday)', () => {
    const d = cal.nthTradingDayOfMonth(1, 2025, 6)!;
    const local = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(d);
    expect(local).toBe('2025-06-02');
  });

  it('3rd trading day of June 2025 is June 4 (Wednesday)', () => {
    const d = cal.nthTradingDayOfMonth(3, 2025, 6)!;
    const local = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(d);
    expect(local).toBe('2025-06-04');
  });

  it('4th trading day of July 2025 skips July 4 → July 7 (Monday)', () => {
    const d = cal.nthTradingDayOfMonth(4, 2025, 7)!;
    const local = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(d);
    expect(local).toBe('2025-07-07');
  });

  it('returns null when n exceeds trading days in month', () => {
    expect(cal.nthTradingDayOfMonth(99, 2025, 6)).toBeNull();
  });
});

describe('TradingCalendar.lastNthTradingDayOfMonth', () => {
  it('last trading day (n=1) of June 2025 is June 30', () => {
    const d = cal.lastNthTradingDayOfMonth(1, 2025, 6)!;
    const local = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(d);
    expect(local).toBe('2025-06-30');
  });

  it('2nd-to-last trading day of June 2025 is June 27', () => {
    const d = cal.lastNthTradingDayOfMonth(2, 2025, 6)!;
    const local = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(d);
    expect(local).toBe('2025-06-27');
  });
});

// ─────────────────────────────────────────────────────────────
// Strategy trigger predicates
// ─────────────────────────────────────────────────────────────

describe('TradingCalendar.isNthTradingDayOfMonth', () => {
  it('true on the 3rd trading day', () => {
    // June 4 = 3rd trading day of June 2025
    expect(cal.isNthTradingDayOfMonth(utc('2025-06-04T14:00:00Z'), 3)).toBe(true);
  });

  it('false on a different trading day', () => {
    expect(cal.isNthTradingDayOfMonth(utc('2025-06-04T14:00:00Z'), 1)).toBe(false);
  });

  it('false on a non-trading day', () => {
    expect(cal.isNthTradingDayOfMonth(utc('2025-06-07T14:00:00Z'), 1)).toBe(false);
  });
});

describe('TradingCalendar.isLastNthTradingDayOfMonth', () => {
  it('true on the last trading day (n=1)', () => {
    expect(cal.isLastNthTradingDayOfMonth(utc('2025-06-30T14:00:00Z'), 1)).toBe(true);
  });

  it('false on a day that is not last', () => {
    expect(cal.isLastNthTradingDayOfMonth(utc('2025-06-27T14:00:00Z'), 1)).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────
// Holiday proximity
// ─────────────────────────────────────────────────────────────

describe('TradingCalendar.nextHoliday', () => {
  it('finds Thanksgiving as the next holiday from Nov 24', () => {
    const h = cal.nextHoliday(utc('2025-11-24T14:00:00Z'));
    expect(h?.name).toBe('Thanksgiving Day');
    expect(h?.date).toBe('2025-11-27');
  });

  it('skips half-days — day-after-Thanksgiving is half-day, finds Christmas', () => {
    // From Nov 28 (day after Thanksgiving, a half-day), next full holiday = Christmas
    const h = cal.nextHoliday(utc('2025-11-28T14:00:00Z'));
    expect(h?.date).toBe('2025-12-25');
  });
});

describe('TradingCalendar.tradingDaysBeforeNextHoliday', () => {
  // Thanksgiving is Nov 27 (Thursday).
  // Nov 24 (Mon) → 3 trading days before (Mon, Tue, Wed = 24, 25, 26)
  it('Mon Nov 24 is 3 trading days before Thanksgiving', () => {
    expect(cal.tradingDaysBeforeNextHoliday(utc('2025-11-24T14:00:00Z'))).toBe(3);
  });

  it('Tue Nov 25 is 2 trading days before Thanksgiving', () => {
    expect(cal.tradingDaysBeforeNextHoliday(utc('2025-11-25T14:00:00Z'))).toBe(2);
  });

  it('Wed Nov 26 is 1 trading day before Thanksgiving', () => {
    expect(cal.tradingDaysBeforeNextHoliday(utc('2025-11-26T14:00:00Z'))).toBe(1);
  });
});

describe('TradingCalendar.isTradingDaysBeforeHoliday', () => {
  it('true 2 days before Thanksgiving', () => {
    expect(cal.isTradingDaysBeforeHoliday(utc('2025-11-25T14:00:00Z'), 2)).toBe(true);
  });

  it('false on a different count', () => {
    expect(cal.isTradingDaysBeforeHoliday(utc('2025-11-25T14:00:00Z'), 1)).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────
// Trading-day arithmetic
// ─────────────────────────────────────────────────────────────

describe('TradingCalendar.tradingDaysBetween', () => {
  it('Mon to Fri (same week, no holiday) = 5 trading days', () => {
    // 2025-06-02 (Mon) to 2025-06-07 (Sat) → 5 days
    expect(cal.tradingDaysBetween(
      utc('2025-06-02T14:00:00Z'),
      utc('2025-06-07T14:00:00Z'),
    )).toBe(5);
  });

  it('from equals to → 0', () => {
    expect(cal.tradingDaysBetween(
      utc('2025-06-02T14:00:00Z'),
      utc('2025-06-02T14:00:00Z'),
    )).toBe(0);
  });

  it('skips weekend between two weeks', () => {
    // Fri Jun 6 to Mon Jun 9 = 1 trading day (only Friday itself)
    expect(cal.tradingDaysBetween(
      utc('2025-06-06T14:00:00Z'),
      utc('2025-06-09T14:00:00Z'),
    )).toBe(1);
  });
});

describe('TradingCalendar.addTradingDays', () => {
  it('+1 from Friday jumps over weekend to Monday', () => {
    const result = cal.addTradingDays(utc('2025-06-06T14:00:00Z'), 1);
    const local  = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(result);
    expect(local).toBe('2025-06-09');
  });

  it('+5 from Monday lands on following Monday', () => {
    const result = cal.addTradingDays(utc('2025-06-02T14:00:00Z'), 5);
    const local  = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(result);
    expect(local).toBe('2025-06-09');
  });

  it('-1 from Monday jumps back over weekend to Friday', () => {
    const result = cal.addTradingDays(utc('2025-06-09T14:00:00Z'), -1);
    const local  = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(result);
    expect(local).toBe('2025-06-06');
  });

  it('skips over a holiday when adding days', () => {
    // Jul 3 (Thu) + 1 → should skip Jul 4 (holiday) → Jul 7 (Mon)
    const result = cal.addTradingDays(utc('2025-07-03T14:00:00Z'), 1);
    const local  = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(result);
    expect(local).toBe('2025-07-07');
  });
});

describe('TradingCalendar.nextTradingDay / prevTradingDay', () => {
  it('nextTradingDay from Thursday = Friday', () => {
    const result = cal.nextTradingDay(utc('2025-06-05T14:00:00Z'));
    const local  = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(result);
    expect(local).toBe('2025-06-06');
  });

  it('nextTradingDay from Friday = Monday (skip weekend)', () => {
    const result = cal.nextTradingDay(utc('2025-06-06T14:00:00Z'));
    const local  = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(result);
    expect(local).toBe('2025-06-09');
  });

  it('prevTradingDay from Monday = Friday (skip weekend)', () => {
    const result = cal.prevTradingDay(utc('2025-06-09T14:00:00Z'));
    const local  = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(result);
    expect(local).toBe('2025-06-06');
  });
});
