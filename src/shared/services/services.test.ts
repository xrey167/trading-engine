import { describe, it, expect } from 'vitest';
import { TypedEventBus } from '../event-bus.js';
import type { AppEventMap } from './event-map.js';
import { BaseService } from './base-service.js';
import { ServiceRegistry } from './service-registry.js';
import { ServiceStatus, ServiceKind, } from './types.js';
import { nullLogger } from '../lib/logger.js';
import { isOk, isErr } from '../lib/result.js';
import { FailingService, makeMockService } from '../testing/mock-services.js';

// ── TypedEventBus (generic) ──────────────────────────

describe('TypedEventBus — generic', () => {
  it('emits and receives EngineEventMap events (backward compat)', () => {
    const bus = new TypedEventBus(); // defaults to EngineEventMap
    const received: unknown[] = [];
    bus.on('bar', (e) => received.push(e));
    bus.emit('bar', { type: 'bar', bar: { open: 1, high: 2, low: 0.5, close: 1.5, time: '2024-01-01T00:00:00Z' } });
    expect(received).toHaveLength(1);
  });

  it('emits and receives AppEventMap events', () => {
    const bus = new TypedEventBus<AppEventMap>();
    const signals: unknown[] = [];
    bus.on('signal', (e) => signals.push(e));
    bus.emit('signal', {
      serviceId: 'test', symbol: 'EURUSD', timeframe: 'H1',
      action: 'BUY', confidence: 0.9, metadata: {}, timestamp: new Date().toISOString(),
    });
    expect(signals).toHaveLength(1);
  });

  it('AppEventMap bus also supports legacy bar/fill/close', () => {
    const bus = new TypedEventBus<AppEventMap>();
    const bars: unknown[] = [];
    bus.on('bar', (e) => bars.push(e));
    bus.emit('bar', { type: 'bar', bar: { open: 1, high: 2, low: 0.5, close: 1.5, time: '2024-01-01T00:00:00Z' } });
    expect(bars).toHaveLength(1);
  });

  it('once fires only once', () => {
    const bus = new TypedEventBus<AppEventMap>();
    let count = 0;
    bus.once('signal', () => { count++; });
    const sig = { serviceId: 'x', symbol: 'X', timeframe: 'H1', action: 'BUY' as const, confidence: 1, metadata: {}, timestamp: '' };
    bus.emit('signal', sig);
    bus.emit('signal', sig);
    expect(count).toBe(1);
  });

  it('off removes listener', () => {
    const bus = new TypedEventBus<AppEventMap>();
    let count = 0;
    const fn = () => { count++; };
    bus.on('signal', fn);
    bus.emit('signal', { serviceId: 'x', symbol: 'X', timeframe: 'H1', action: 'BUY', confidence: 1, metadata: {}, timestamp: '' });
    bus.off('signal', fn);
    bus.emit('signal', { serviceId: 'x', symbol: 'X', timeframe: 'H1', action: 'BUY', confidence: 1, metadata: {}, timestamp: '' });
    expect(count).toBe(1);
  });
});

// ── BaseService ──────────────────────────────────────

class StubService extends BaseService {
  readonly id = 'stub:test';
  readonly kind = ServiceKind.Broker;
  readonly name = 'stub-test';
  onStartCalled = false;
  onStopCalled = false;

  protected async onStart(): Promise<void> { this.onStartCalled = true; }
  protected async onStop(): Promise<void> { this.onStopCalled = true; }
  protected getHealthMetadata() { return { custom: true }; }
}

class FailingBaseService extends BaseService {
  readonly id = 'fail:test';
  readonly kind = ServiceKind.Broker;
  readonly name = 'fail-test';

  protected async onStart(): Promise<void> { throw new Error('boom'); }
  protected async onStop(): Promise<void> {}
}

describe('BaseService', () => {
  it('starts and transitions to Running', async () => {
    const bus = new TypedEventBus<AppEventMap>();
    const svc = new StubService(bus, nullLogger);
    expect(svc.health().status).toBe(ServiceStatus.Stopped);
    await svc.start();
    expect(svc.health().status).toBe(ServiceStatus.Running);
    expect(svc.onStartCalled).toBe(true);
    expect(svc.health().lastCheckedAt).not.toBeNull();
    expect(svc.health().metadata).toEqual({ custom: true });
  });

  it('stops and transitions to Stopped', async () => {
    const bus = new TypedEventBus<AppEventMap>();
    const svc = new StubService(bus, nullLogger);
    await svc.start();
    await svc.stop();
    expect(svc.health().status).toBe(ServiceStatus.Stopped);
    expect(svc.onStopCalled).toBe(true);
  });

  it('transitions to Error on start failure', async () => {
    const bus = new TypedEventBus<AppEventMap>();
    const svc = new FailingBaseService(bus, nullLogger);
    await expect(svc.start()).rejects.toThrow('boom');
    expect(svc.health().status).toBe(ServiceStatus.Error);
    expect(svc.health().error).toBe('boom');
  });
});

// ── ServiceRegistry ──────────────────────────────────

describe('ServiceRegistry', () => {
  it('registers and retrieves by id', () => {
    const reg = new ServiceRegistry();
    const svc = makeMockService('broker:test', ServiceKind.Broker);
    reg.register(svc);
    const result = reg.get('broker:test');
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value.id).toBe('broker:test');
    }
  });

  it('returns error for unknown id', () => {
    const reg = new ServiceRegistry();
    const result = reg.get('nope');
    expect(isErr(result)).toBe(true);
  });

  it('throws on duplicate registration', () => {
    const reg = new ServiceRegistry();
    const svc = makeMockService('dup', ServiceKind.Broker);
    reg.register(svc);
    expect(() => reg.register(svc)).toThrow("Service 'dup' is already registered");
  });

  it('filters by kind', () => {
    const reg = new ServiceRegistry();
    reg.register(makeMockService('broker:a', ServiceKind.Broker));
    reg.register(makeMockService('strategy:a', ServiceKind.Strategy));
    reg.register(makeMockService('broker:b', ServiceKind.Broker));

    const brokers = reg.getByKind(ServiceKind.Broker);
    expect(brokers).toHaveLength(2);

    const strategies = reg.getByKind(ServiceKind.Strategy);
    expect(strategies).toHaveLength(1);
  });

  it('lists all services with status', () => {
    const reg = new ServiceRegistry();
    reg.register(makeMockService('a', ServiceKind.Broker));
    reg.register(makeMockService('b', ServiceKind.Strategy));

    const list = reg.list();
    expect(list).toHaveLength(2);
    expect(list[0]).toMatchObject({ id: 'a', kind: 'BROKER', status: 'STOPPED' });
  });

  it('startAll starts all services', async () => {
    const reg = new ServiceRegistry();
    const a = makeMockService('a', ServiceKind.Broker);
    const b = makeMockService('b', ServiceKind.Strategy);
    reg.register(a);
    reg.register(b);

    await reg.startAll();
    expect(a.startCalls).toBe(1);
    expect(b.startCalls).toBe(1);
  });

  it('startAll continues if one service fails', async () => {
    const reg = new ServiceRegistry();
    const fail = new FailingService('fail', ServiceKind.Broker);
    const ok = makeMockService('ok', ServiceKind.Strategy);
    reg.register(fail);
    reg.register(ok);

    await reg.startAll(); // should not throw
    expect(ok.startCalls).toBe(1);
  });

  it('stopAll stops in reverse order', async () => {
    const reg = new ServiceRegistry();
    const a = makeMockService('a', ServiceKind.Broker);
    const b = makeMockService('b', ServiceKind.Strategy);
    reg.register(a);
    reg.register(b);

    await a.start();
    await b.start();
    await reg.stopAll();
    expect(a.stopCalls).toBe(1);
    expect(b.stopCalls).toBe(1);
  });

  it('unregister removes a service', () => {
    const reg = new ServiceRegistry();
    reg.register(makeMockService('x', ServiceKind.Broker));
    expect(reg.size).toBe(1);
    reg.unregister('x');
    expect(reg.size).toBe(0);
  });

  it('healthAll returns health for all services', () => {
    const reg = new ServiceRegistry();
    reg.register(makeMockService('a', ServiceKind.Broker));
    reg.register(makeMockService('b', ServiceKind.Strategy));
    const health = reg.healthAll();
    expect(health).toHaveLength(2);
    expect(health[0].status).toBe('STOPPED');
  });
});
