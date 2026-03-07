import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PostgresBarCache } from './pg-bar-cache.js';
import { nullLogger } from '../shared/lib/logger.js';
import type { OHLCBody } from '../shared/schemas/common.js';

// Mock drizzle-orm — provides the operator functions used by PostgresBarCache
vi.mock('drizzle-orm', () => ({
  eq: vi.fn((_col, val) => ({ op: 'eq', val })),
  and: vi.fn((...args: unknown[]) => ({ op: 'and', args })),
  desc: vi.fn((col) => ({ op: 'desc', col })),
}));

// Mock the DB schema — provides the `bars` table reference
vi.mock('../shared/db/schema.js', () => ({
  bars: {
    symbol: 'symbol',
    timeframe: 'timeframe',
    time: 'time',
  },
}));

function createMockDb() {
  const insertChain = {
    values: vi.fn().mockReturnThis(),
    onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
  };
  const selectChain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
  };
  const deleteChain = {
    where: vi.fn().mockResolvedValue(undefined),
  };
  return {
    insert: vi.fn().mockReturnValue(insertChain),
    select: vi.fn().mockReturnValue(selectChain),
    delete: vi.fn().mockReturnValue(deleteChain),
    _insertChain: insertChain,
    _selectChain: selectChain,
    _deleteChain: deleteChain,
  };
}

const testBar: OHLCBody = {
  open: 1.1,
  high: 1.2,
  low: 1.0,
  close: 1.15,
  time: '2024-01-01T00:00:00Z',
};

describe('PostgresBarCache', () => {
  let db: ReturnType<typeof createMockDb>;
  let cache: PostgresBarCache;

  beforeEach(() => {
    db = createMockDb();
    cache = new PostgresBarCache(db as any, nullLogger);
  });

  it('push stores in memory and writes to PG', () => {
    cache.push('EURUSD', 'M1', testBar);
    expect(cache.getBars('EURUSD', 'M1')).toEqual([testBar]);
    expect(db.insert).toHaveBeenCalled();
  });

  it('getBars reads from memory only', () => {
    cache.push('EURUSD', 'M1', testBar);
    const bars = cache.getBars('EURUSD', 'M1');
    expect(bars).toHaveLength(1);
    expect(db.select).not.toHaveBeenCalled();
  });

  it('latest returns the most recent bar from memory', () => {
    expect(cache.latest('EURUSD', 'M1')).toBeUndefined();
    cache.push('EURUSD', 'M1', testBar);
    expect(cache.latest('EURUSD', 'M1')).toEqual(testBar);
  });

  it('clear removes from memory and PG', () => {
    cache.push('EURUSD', 'M1', testBar);
    cache.clear('EURUSD', 'M1');
    expect(cache.getBars('EURUSD', 'M1')).toEqual([]);
    expect(db.delete).toHaveBeenCalled();
  });

  it('hydrate loads bars from PG into memory', async () => {
    const pgRows = [
      {
        id: 2,
        symbol: 'EURUSD',
        timeframe: 'M1',
        time: new Date('2024-01-01T00:01:00Z'),
        open: 1.11,
        high: 1.21,
        low: 1.01,
        close: 1.16,
        volume: null,
      },
      {
        id: 1,
        symbol: 'EURUSD',
        timeframe: 'M1',
        time: new Date('2024-01-01T00:00:00Z'),
        open: 1.1,
        high: 1.2,
        low: 1.0,
        close: 1.15,
        volume: 100,
      },
    ];
    db._selectChain.limit.mockResolvedValue(pgRows);

    const count = await cache.hydrate('EURUSD', 'M1');
    expect(count).toBe(2);
    // Reversed: oldest first
    const bars = cache.getBars('EURUSD', 'M1');
    expect(bars).toHaveLength(2);
    expect(bars[0].close).toBe(1.15);
    expect(bars[1].close).toBe(1.16);
  });

  it('hydrate returns 0 on error', async () => {
    db._selectChain.limit.mockRejectedValue(new Error('connection refused'));
    const count = await cache.hydrate('EURUSD', 'M1');
    expect(count).toBe(0);
  });

  it('hydrate converts volume null to undefined', async () => {
    const pgRows = [
      {
        id: 1,
        symbol: 'EURUSD',
        timeframe: 'M1',
        time: new Date('2024-01-01T00:00:00Z'),
        open: 1.1,
        high: 1.2,
        low: 1.0,
        close: 1.15,
        volume: null,
      },
    ];
    db._selectChain.limit.mockResolvedValue(pgRows);

    await cache.hydrate('EURUSD', 'M1');
    const bars = cache.getBars('EURUSD', 'M1');
    expect(bars[0].volume).toBeUndefined();
  });

  it('push sends volume null when bar has no volume', () => {
    cache.push('EURUSD', 'M1', testBar);
    expect(db._insertChain.values).toHaveBeenCalledWith(
      expect.objectContaining({ volume: null }),
    );
  });
});
