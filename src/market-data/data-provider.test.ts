import { describe, it, expect } from 'vitest';
import { TypedEventBus } from '../shared/event-bus.js';
import type { AppEventMap, NormalizedBarEvent } from '../shared/services/event-map.js';
import { ServiceStatus, ServiceKind } from '../shared/services/types.js';
import type { OHLCBody } from '../shared/schemas/common.js';
import { InMemoryBarCache } from './bar-cache.js';
import { DataProviderService, type IDataFetcher } from './data-provider-service.js';
import { InternalProvider } from './internal-provider.js';
import { nullLogger } from '../shared/lib/logger.js';

class MockFetcher implements IDataFetcher {
  private readonly bars: OHLCBody[];
  fetchCount = 0;

  constructor(bars: OHLCBody[] = []) {
    this.bars = bars;
  }

  async fetchBars(_symbol: string, _timeframe: string): Promise<OHLCBody[]> {
    this.fetchCount++;
    return [...this.bars];
  }
}

function makeBar(close: number, time = '2024-01-01T00:00:00Z'): OHLCBody {
  return { open: close, high: close + 0.005, low: close - 0.005, close, time };
}

describe('InMemoryBarCache', () => {
  it('push and getBars', () => {
    const cache = new InMemoryBarCache();
    const bar = makeBar(1.1);
    cache.push('EURUSD', 'H1', bar);
    const bars = cache.getBars('EURUSD', 'H1');
    expect(bars).toHaveLength(1);
    expect(bars[0].close).toBe(1.1);
  });

  it('respects maxBars limit', () => {
    const cache = new InMemoryBarCache(3);
    for (let i = 0; i < 5; i++) {
      cache.push('EURUSD', 'H1', makeBar(1.1 + i * 0.01));
    }
    const bars = cache.getBars('EURUSD', 'H1');
    expect(bars).toHaveLength(3);
    expect(bars[0].close).toBeCloseTo(1.12); // oldest kept
    expect(bars[2].close).toBeCloseTo(1.14); // newest
  });

  it('getBars with limit returns latest N', () => {
    const cache = new InMemoryBarCache();
    for (let i = 0; i < 5; i++) {
      cache.push('EURUSD', 'H1', makeBar(1.1 + i * 0.01));
    }
    const bars = cache.getBars('EURUSD', 'H1', 2);
    expect(bars).toHaveLength(2);
    expect(bars[0].close).toBeCloseTo(1.13);
    expect(bars[1].close).toBeCloseTo(1.14);
  });

  it('clear removes bars for symbol/timeframe', () => {
    const cache = new InMemoryBarCache();
    cache.push('EURUSD', 'H1', makeBar(1.1));
    cache.push('GBPUSD', 'H1', makeBar(1.3));
    cache.clear('EURUSD', 'H1');
    expect(cache.getBars('EURUSD', 'H1')).toHaveLength(0);
    expect(cache.getBars('GBPUSD', 'H1')).toHaveLength(1);
  });

  it('returns empty array for unknown symbol', () => {
    const cache = new InMemoryBarCache();
    expect(cache.getBars('UNKNOWN', 'H1')).toHaveLength(0);
  });
});

describe('DataProviderService', () => {
  it('has correct id and kind', () => {
    const bus = new TypedEventBus<AppEventMap>();
    const fetcher = new MockFetcher();
    const cache = new InMemoryBarCache();
    const svc = new DataProviderService(
      { id: 'dp:test', name: 'test-provider', symbols: ['EURUSD'], timeframe: 'H1', pollIntervalMs: 60_000 },
      fetcher, cache, bus, nullLogger,
    );
    expect(svc.id).toBe('dp:test');
    expect(svc.kind).toBe(ServiceKind.DataProvider);
  });

  it('starts and stops', async () => {
    const bus = new TypedEventBus<AppEventMap>();
    const fetcher = new MockFetcher();
    const cache = new InMemoryBarCache();
    const svc = new DataProviderService(
      { id: 'dp:test', name: 'test-provider', symbols: ['EURUSD'], timeframe: 'H1', pollIntervalMs: 60_000 },
      fetcher, cache, bus, nullLogger,
    );
    await svc.start();
    expect(svc.health().status).toBe(ServiceStatus.Running);
    await svc.stop();
    expect(svc.health().status).toBe(ServiceStatus.Stopped);
  });

  it('emits normalized_bar events on poll', async () => {
    const bus = new TypedEventBus<AppEventMap>();
    const events: NormalizedBarEvent[] = [];
    bus.on('normalized_bar', (e) => events.push(e));

    const fetcher = new MockFetcher([makeBar(1.1)]);
    const cache = new InMemoryBarCache();
    const svc = new DataProviderService(
      { id: 'dp:test', name: 'test-provider', symbols: ['EURUSD'], timeframe: 'H1', pollIntervalMs: 30 },
      fetcher, cache, bus, nullLogger,
    );
    await svc.start();

    await new Promise(r => setTimeout(r, 80));

    expect(events.length).toBeGreaterThanOrEqual(1);
    expect(events[0].providerId).toBe('dp:test');
    expect(events[0].symbol).toBe('EURUSD');
    expect(events[0].bar.close).toBe(1.1);

    await svc.stop();
  });

  it('caches bars from fetch', async () => {
    const bus = new TypedEventBus<AppEventMap>();
    const fetcher = new MockFetcher([makeBar(1.1)]);
    const cache = new InMemoryBarCache();
    const svc = new DataProviderService(
      { id: 'dp:test', name: 'test-provider', symbols: ['EURUSD'], timeframe: 'H1', pollIntervalMs: 30 },
      fetcher, cache, bus, nullLogger,
    );
    await svc.start();

    await new Promise(r => setTimeout(r, 80));

    const bars = cache.getBars('EURUSD', 'H1');
    expect(bars.length).toBeGreaterThanOrEqual(1);

    await svc.stop();
  });

  it('polls multiple symbols', async () => {
    const bus = new TypedEventBus<AppEventMap>();
    const events: NormalizedBarEvent[] = [];
    bus.on('normalized_bar', (e) => events.push(e));

    const fetcher = new MockFetcher([makeBar(1.1)]);
    const cache = new InMemoryBarCache();
    const svc = new DataProviderService(
      { id: 'dp:test', name: 'test-provider', symbols: ['EURUSD', 'GBPUSD'], timeframe: 'H1', pollIntervalMs: 30 },
      fetcher, cache, bus, nullLogger,
    );
    await svc.start();

    await new Promise(r => setTimeout(r, 80));

    const symbols = new Set(events.map(e => e.symbol));
    expect(symbols.has('EURUSD')).toBe(true);
    expect(symbols.has('GBPUSD')).toBe(true);

    await svc.stop();
  });

  it('deduplicates bars across poll cycles — same bars emitted only once', async () => {
    const bus = new TypedEventBus<AppEventMap>();
    const events: NormalizedBarEvent[] = [];
    bus.on('normalized_bar', (e) => events.push(e));

    // Fetcher always returns the same bar (rolling window behaviour)
    const fetcher = new MockFetcher([makeBar(1.1, '2024-01-01T00:00:00Z')]);
    const cache = new InMemoryBarCache();
    const svc = new DataProviderService(
      { id: 'dp:dedup', name: 'dedup-provider', symbols: ['EURUSD'], timeframe: 'H1', pollIntervalMs: 20 },
      fetcher, cache, bus, nullLogger,
    );
    await svc.start();

    // Allow at least 3 poll cycles
    await new Promise(r => setTimeout(r, 100));
    await svc.stop();

    // Despite multiple polls the bar should have been emitted exactly once
    const eurusdEvents = events.filter(e => e.symbol === 'EURUSD');
    expect(eurusdEvents).toHaveLength(1);
    expect(fetcher.fetchCount).toBeGreaterThanOrEqual(3);
  });

  it('emits new bar when a later bar appears in subsequent poll', async () => {
    const bus = new TypedEventBus<AppEventMap>();
    const events: NormalizedBarEvent[] = [];
    bus.on('normalized_bar', (e) => events.push(e));

    let callCount = 0;
    const fetcher: IDataFetcher = {
      async fetchBars(_symbol, _timeframe) {
        callCount++;
        if (callCount === 1) {
          return [makeBar(1.1, '2024-01-01T00:00:00Z')];
        }
        // Second and later polls include the original bar plus a new one
        return [
          makeBar(1.1, '2024-01-01T00:00:00Z'),
          makeBar(1.2, '2024-01-01T01:00:00Z'),
        ];
      },
    };
    const cache = new InMemoryBarCache();
    const svc = new DataProviderService(
      { id: 'dp:new-bar', name: 'new-bar-provider', symbols: ['EURUSD'], timeframe: 'H1', pollIntervalMs: 20 },
      fetcher, cache, bus, nullLogger,
    );
    await svc.start();

    // Allow at least 3 poll cycles
    await new Promise(r => setTimeout(r, 100));
    await svc.stop();

    const eurusdEvents = events.filter(e => e.symbol === 'EURUSD');
    // First bar emitted on cycle 1, second bar emitted once on cycle 2+
    expect(eurusdEvents).toHaveLength(2);
    expect(eurusdEvents[0].bar.time).toBe('2024-01-01T00:00:00Z');
    expect(eurusdEvents[1].bar.time).toBe('2024-01-01T01:00:00Z');
  });

  it('exposes cache via getCache()', () => {
    const bus = new TypedEventBus<AppEventMap>();
    const cache = new InMemoryBarCache();
    const svc = new DataProviderService(
      { id: 'dp:test', name: 'test-provider', symbols: ['EURUSD'], timeframe: 'H1', pollIntervalMs: 60_000 },
      new MockFetcher(), cache, bus, nullLogger,
    );
    expect(svc.getCache()).toBe(cache);
  });
});

describe('InMemoryBarCache.latest', () => {
  it('returns the most recent bar', () => {
    const cache = new InMemoryBarCache();
    cache.push('EURUSD', 'M1', makeBar(1.10));
    cache.push('EURUSD', 'M1', makeBar(1.11));
    cache.push('EURUSD', 'M1', makeBar(1.12));
    expect(cache.latest('EURUSD', 'M1')?.close).toBe(1.12);
  });

  it('returns undefined when no bars exist', () => {
    const cache = new InMemoryBarCache();
    expect(cache.latest('EURUSD', 'M1')).toBeUndefined();
  });
});

describe('InternalProvider', () => {
  it('bridges bar event to normalized_bar', async () => {
    const bus = new TypedEventBus<AppEventMap>();
    const cache = new InMemoryBarCache();
    const provider = new InternalProvider('EURUSD', 'M1', cache, bus, nullLogger);

    const events: NormalizedBarEvent[] = [];
    bus.on('normalized_bar', (e) => events.push(e));

    await provider.start();

    const bar = makeBar(1.1050);
    bus.emit('bar', { type: 'bar', bar });

    expect(events).toHaveLength(1);
    expect(events[0].providerId).toBe('dp:internal');
    expect(events[0].symbol).toBe('EURUSD');
    expect(events[0].timeframe).toBe('M1');
    expect(events[0].bar.close).toBe(1.1050);

    await provider.stop();
  });

  it('pushes bars to the cache', async () => {
    const bus = new TypedEventBus<AppEventMap>();
    const cache = new InMemoryBarCache();
    const provider = new InternalProvider('EURUSD', 'M1', cache, bus, nullLogger);

    await provider.start();

    bus.emit('bar', { type: 'bar', bar: makeBar(1.10) });
    bus.emit('bar', { type: 'bar', bar: makeBar(1.11) });

    expect(cache.getBars('EURUSD', 'M1')).toHaveLength(2);
    expect(cache.latest('EURUSD', 'M1')?.close).toBe(1.11);

    await provider.stop();
  });

  it('stops listening after stop()', async () => {
    const bus = new TypedEventBus<AppEventMap>();
    const cache = new InMemoryBarCache();
    const provider = new InternalProvider('EURUSD', 'M1', cache, bus, nullLogger);

    await provider.start();
    bus.emit('bar', { type: 'bar', bar: makeBar(1.10) });
    expect(cache.getBars('EURUSD', 'M1')).toHaveLength(1);

    await provider.stop();
    bus.emit('bar', { type: 'bar', bar: makeBar(1.11) });
    expect(cache.getBars('EURUSD', 'M1')).toHaveLength(1); // no new bar added
  });

  it('has correct service metadata', () => {
    const bus = new TypedEventBus<AppEventMap>();
    const cache = new InMemoryBarCache();
    const provider = new InternalProvider('EURUSD', 'M1', cache, bus, nullLogger);
    expect(provider.id).toBe('dp:internal');
    expect(provider.kind).toBe(ServiceKind.DataProvider);
    expect(provider.name).toBe('internal');
  });
});
