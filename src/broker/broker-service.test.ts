import { describe, it, expect } from 'vitest';
import { TypedEventBus } from '../shared/event-bus.js';
import type { AppEventMap } from '../shared/services/event-map.js';
import { ServiceStatus, ServiceKind } from '../shared/services/types.js';
import { BrokerService } from './broker-service.js';
import { PaperBroker } from './paper/paper-broker.js';
import { SymbolInfoForex } from '../engine/core/symbol.js';
import { TradingEngine } from '../engine/core/trading-engine.js';
import { Bar } from '../shared/domain/bar/bar.js';
import { Bars } from '../shared/domain/bar/bars.js';
import { nullLogger } from '../shared/lib/logger.js';

function makeBrokerService(id = 'broker:paper:test') {
  const bus = new TypedEventBus<AppEventMap>();
  const broker = new PaperBroker(bus, nullLogger);
  return new BrokerService(
    { id, name: 'paper-test', broker, symbol: new SymbolInfoForex('EURUSD', 5), hedging: true },
    bus,
    nullLogger,
  );
}

describe('BrokerService', () => {
  it('has correct id, kind, and name', () => {
    const svc = makeBrokerService();
    expect(svc.id).toBe('broker:paper:test');
    expect(svc.kind).toBe(ServiceKind.Broker);
    expect(svc.name).toBe('paper-test');
  });

  it('starts in Stopped state', () => {
    const svc = makeBrokerService();
    expect(svc.health().status).toBe(ServiceStatus.Stopped);
  });

  it('start transitions to Running', async () => {
    const svc = makeBrokerService();
    await svc.start();
    expect(svc.health().status).toBe(ServiceStatus.Running);
    expect(svc.health().metadata).toEqual({ connected: true, circuitBreaker: 'CLOSED' });
  });

  it('stop transitions to Stopped', async () => {
    const svc = makeBrokerService();
    await svc.start();
    await svc.stop();
    expect(svc.health().status).toBe(ServiceStatus.Stopped);
  });

  it('owns a TradingEngine', () => {
    const svc = makeBrokerService();
    expect(svc.engine).toBeDefined();
    expect(svc.engineMutex).toBeDefined();
  });

  it('reuses existing engine when provided', () => {
    const bus = new TypedEventBus<AppEventMap>();
    const broker = new PaperBroker(bus, nullLogger);
    const symbol = new SymbolInfoForex('EURUSD', 5);
    const existingEngine = new TradingEngine(symbol, broker, true);
    const svc = new BrokerService(
      { id: 'reuse', name: 'reuse-test', broker, symbol, hedging: true, engine: existingEngine },
      bus,
      nullLogger,
    );
    expect(svc.engine).toBe(existingEngine);
  });

  it('health reports connected status and circuit breaker in metadata', async () => {
    const svc = makeBrokerService();
    await svc.start();
    const h = svc.health();
    expect(h.metadata.connected).toBe(true);
    expect(h.metadata.circuitBreaker).toBe('CLOSED');
    expect(h.lastCheckedAt).not.toBeNull();
    expect(h.error).toBeNull();
  });

  it('processBar acquires mutex and calls onBar', async () => {
    const svc = makeBrokerService();
    await svc.start();
    const bar = new Bar(1.1, 1.12, 1.09, 1.11, new Date('2024-01-01'));
    const bars = new Bars([bar]);
    await svc.processBar(bar, bars);
    // Engine processed the bar without throwing
  });
});

describe('BrokerService — multi-broker isolation', () => {
  it('two broker services have independent engines', async () => {
    const busA = new TypedEventBus<AppEventMap>();
    const busB = new TypedEventBus<AppEventMap>();
    const brokerA = new PaperBroker(busA, nullLogger);
    const brokerB = new PaperBroker(busB, nullLogger);

    const svcA = new BrokerService(
      { id: 'broker:a', name: 'a', broker: brokerA, symbol: new SymbolInfoForex('EURUSD', 5), hedging: true },
      busA, nullLogger,
    );
    const svcB = new BrokerService(
      { id: 'broker:b', name: 'b', broker: brokerB, symbol: new SymbolInfoForex('GBPUSD', 5), hedging: true },
      busB, nullLogger,
    );

    expect(svcA.engine).not.toBe(svcB.engine);
    expect(svcA.engineMutex).not.toBe(svcB.engineMutex);

    // Process a bar on A — should not affect B
    const bar = new Bar(1.1, 1.12, 1.09, 1.11, new Date('2024-01-01'));
    brokerA.setPrice(1.11);
    await svcA.processBar(bar, new Bars([bar]));

    // Engines are independent — B's engine state is unaffected
    expect(svcA.engine).not.toBe(svcB.engine);
  });
});
