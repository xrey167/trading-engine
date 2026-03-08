import { describe, it, expect, vi, beforeEach } from 'vitest';
import type Redis from 'ioredis';
import type { OHLCBody } from '../shared/schemas/common.js';
import { RedisBarCache } from './redis-bar-cache.js';
import { nullLogger } from '../shared/lib/logger.js';

function makeBar(close: number, time = '2024-01-01T00:00:00Z'): OHLCBody {
  return { open: close, high: close + 0.005, low: close - 0.005, close, time };
}

function mockRedis(): Redis {
  const store = new Map<string, string[]>();

  return {
    rpush: vi.fn(async (key: string, ...values: string[]) => {
      const list = store.get(key) ?? [];
      list.push(...values);
      store.set(key, list);
      return list.length;
    }),
    ltrim: vi.fn(async (key: string, start: number, stop: number) => {
      const list = store.get(key) ?? [];
      // Normalize negative indices
      const len = list.length;
      const s = start < 0 ? Math.max(len + start, 0) : start;
      const e = stop < 0 ? len + stop : stop;
      store.set(key, list.slice(s, e + 1));
      return 'OK';
    }),
    lrange: vi.fn(async (key: string, _start: number, _stop: number) => {
      return store.get(key) ?? [];
    }),
    del: vi.fn(async (key: string) => {
      store.delete(key);
      return 1;
    }),
    // Expose internal store for test assertions
    _store: store,
  } as unknown as Redis;
}

describe('RedisBarCache', () => {
  let redis: Redis & { _store: Map<string, string[]> };
  let cache: RedisBarCache;

  beforeEach(() => {
    redis = mockRedis() as Redis & { _store: Map<string, string[]> };
    cache = new RedisBarCache(redis, nullLogger, 5);
  });

  it('push writes to local and Redis', async () => {
    const bar = makeBar(1.1);
    cache.push('EURUSD', 'M1', bar);

    // Local read works immediately (sync)
    expect(cache.getBars('EURUSD', 'M1')).toHaveLength(1);
    expect(cache.latest('EURUSD', 'M1')?.close).toBe(1.1);

    // Redis write is fire-and-forget, wait for microtask
    await new Promise(r => setTimeout(r, 10));
    expect(redis.rpush).toHaveBeenCalledWith('bars:EURUSD:M1', JSON.stringify(bar));
    expect(redis.ltrim).toHaveBeenCalled();
  });

  it('getBars returns bars from local mirror', () => {
    cache.push('EURUSD', 'M1', makeBar(1.10));
    cache.push('EURUSD', 'M1', makeBar(1.11));
    cache.push('EURUSD', 'M1', makeBar(1.12));

    const bars = cache.getBars('EURUSD', 'M1', 2);
    expect(bars).toHaveLength(2);
    expect(bars[0].close).toBeCloseTo(1.11);
    expect(bars[1].close).toBeCloseTo(1.12);
  });

  it('respects maxBars in local mirror', () => {
    for (let i = 0; i < 8; i++) {
      cache.push('EURUSD', 'M1', makeBar(1.1 + i * 0.01));
    }
    // maxBars = 5
    expect(cache.getBars('EURUSD', 'M1')).toHaveLength(5);
  });

  it('clear removes from local and Redis', async () => {
    cache.push('EURUSD', 'M1', makeBar(1.1));
    cache.clear('EURUSD', 'M1');

    expect(cache.getBars('EURUSD', 'M1')).toHaveLength(0);

    await new Promise(r => setTimeout(r, 10));
    expect(redis.del).toHaveBeenCalledWith('bars:EURUSD:M1');
  });

  it('hydrate loads bars from Redis into local', async () => {
    // Pre-populate Redis store
    const bars = [makeBar(1.10), makeBar(1.11), makeBar(1.12)];
    redis._store.set('bars:EURUSD:M1', bars.map(b => JSON.stringify(b)));

    const count = await cache.hydrate('EURUSD', 'M1');
    expect(count).toBe(3);
    expect(cache.getBars('EURUSD', 'M1')).toHaveLength(3);
    expect(cache.latest('EURUSD', 'M1')?.close).toBe(1.12);
  });

  it('hydrate returns 0 for empty key', async () => {
    const count = await cache.hydrate('UNKNOWN', 'M1');
    expect(count).toBe(0);
    expect(cache.getBars('UNKNOWN', 'M1')).toHaveLength(0);
  });

  it('survives Redis push error gracefully', async () => {
    const errorRedis = {
      ...mockRedis(),
      rpush: vi.fn(async () => { throw new Error('connection refused'); }),
    } as unknown as Redis;
    const errorCache = new RedisBarCache(errorRedis, nullLogger, 5);

    // Should not throw — local write succeeds, Redis error is caught
    errorCache.push('EURUSD', 'M1', makeBar(1.1));
    await new Promise(r => setTimeout(r, 10));

    expect(errorCache.getBars('EURUSD', 'M1')).toHaveLength(1);
  });
});
