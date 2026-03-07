import { describe, it, expect } from 'vitest';
import { TypedEventBus } from '../shared/event-bus.js';
import type { AppEventMap, NormalizedBarEvent } from '../shared/services/event-map.js';
import { ServiceStatus, ServiceKind } from '../shared/services/types.js';
import type { OHLCBody } from '../shared/schemas/common.js';
import { InMemoryBarCache } from './bar-cache.js';
import { DataProviderService, type IDataFetcher } from './data-provider-service.js';
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
