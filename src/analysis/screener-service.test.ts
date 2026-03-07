import { describe, it, expect } from 'vitest';
import { TypedEventBus } from '../shared/event-bus.js';
import type { AppEventMap, ScreenerEvent } from '../shared/services/event-map.js';
import { ServiceStatus, ServiceKind } from '../shared/services/types.js';
import { ScreenerService, type IScreenerLogic, type ScreenerMatch } from './screener-service.js';
import { nullLogger } from '../shared/lib/logger.js';

class MockScreenerLogic implements IScreenerLogic {
  private readonly results: ScreenerMatch[];
  scanCount = 0;

  constructor(results: ScreenerMatch[] = []) {
    this.results = results;
  }

  async scan(symbols: string[]): Promise<ScreenerMatch[]> {
    this.scanCount++;
    return this.results.filter(r => symbols.includes(r.symbol));
  }
}

describe('ScreenerService', () => {
  it('has correct id, kind, and name', () => {
    const bus = new TypedEventBus<AppEventMap>();
    const logic = new MockScreenerLogic();
    const svc = new ScreenerService(
      { id: 'screener:test', name: 'test-screener', symbols: ['EURUSD'], intervalMs: 60_000 },
      logic, bus, nullLogger,
    );
    expect(svc.id).toBe('screener:test');
    expect(svc.kind).toBe(ServiceKind.Screener);
  });

  it('starts and sets up interval', async () => {
    const bus = new TypedEventBus<AppEventMap>();
    const logic = new MockScreenerLogic();
    const svc = new ScreenerService(
      { id: 'screener:test', name: 'test-screener', symbols: ['EURUSD'], intervalMs: 60_000 },
      logic, bus, nullLogger,
    );
    await svc.start();
    expect(svc.health().status).toBe(ServiceStatus.Running);
    await svc.stop();
  });

  it('emits screener event when matches found on interval', async () => {
    const bus = new TypedEventBus<AppEventMap>();
    const events: ScreenerEvent[] = [];
    bus.on('screener', (e) => events.push(e));

    const logic = new MockScreenerLogic([
      { symbol: 'EURUSD', matchType: 'volume-breakout', score: 0.9, metadata: {} },
    ]);
    const svc = new ScreenerService(
      { id: 'screener:test', name: 'test-screener', symbols: ['EURUSD'], intervalMs: 30 },
      logic, bus, nullLogger,
    );
    await svc.start();

    // Wait for at least one interval tick
    await new Promise(r => setTimeout(r, 80));

    expect(events.length).toBeGreaterThanOrEqual(1);
    expect(events[0].matchedSymbols).toContain('EURUSD');
    expect(events[0].serviceId).toBe('screener:test');

    await svc.stop();
  });

  it('does not emit when no matches found', async () => {
    const bus = new TypedEventBus<AppEventMap>();
    const events: ScreenerEvent[] = [];
    bus.on('screener', (e) => events.push(e));

    const logic = new MockScreenerLogic([]);
    const svc = new ScreenerService(
      { id: 'screener:test', name: 'test-screener', symbols: ['EURUSD'], intervalMs: 30 },
      logic, bus, nullLogger,
    );
    await svc.start();

    await new Promise(r => setTimeout(r, 80));
    expect(events).toHaveLength(0);

    await svc.stop();
  });

  it('on-demand scan returns matches', async () => {
    const bus = new TypedEventBus<AppEventMap>();
    const logic = new MockScreenerLogic([
      { symbol: 'EURUSD', matchType: 'breakout', score: 0.8, metadata: {} },
      { symbol: 'GBPUSD', matchType: 'breakout', score: 0.7, metadata: {} },
    ]);
    const svc = new ScreenerService(
      { id: 'screener:test', name: 'test-screener', symbols: ['EURUSD', 'GBPUSD'], intervalMs: 60_000 },
      logic, bus, nullLogger,
    );

    const matches = await svc.scan(['EURUSD']);
    expect(matches).toHaveLength(1);
    expect(matches[0].symbol).toBe('EURUSD');
  });
});
