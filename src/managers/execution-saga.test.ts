import { describe, it, expect } from 'vitest';
import { TypedEventBus } from '../shared/event-bus.js';
import type { AppEventMap, OrderEvent, SignalEvent } from '../shared/services/event-map.js';
import { ServiceStatus } from '../shared/services/types.js';
import { ServiceRegistry } from '../shared/services/service-registry.js';
import { BrokerService } from '../broker/broker-service.js';
import { RiskManagerService } from './risk-manager.js';
import { ExecutionSaga } from './execution-saga.js';
import { nullLogger } from '../shared/lib/logger.js';
import { CanonicalIdRegistry } from '../shared/lib/canonical-id/index.js';
import { PaperBroker } from '../broker/paper/paper-broker.js';
import { SymbolInfoForex as SymbolInfo } from '../engine/core/symbol.js';

const testSymbol = new SymbolInfo('EURUSD', 5);

function makeSignal(overrides: Partial<SignalEvent> = {}): SignalEvent {
  return {
    serviceId: 'strategy:test',
    symbol: 'EURUSD',
    timeframe: 'H1',
    action: 'BUY',
    confidence: 1.0,
    metadata: {},
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

function setupSaga(riskOverrides: Partial<{ maxOpenPositions: number; maxPositionsPerSymbol: number; maxDailyLoss: number }> = {}) {
  const bus = new TypedEventBus<AppEventMap>();
  const registry = new ServiceRegistry();

  const paperBroker = new PaperBroker(bus, nullLogger);
  const broker = new BrokerService(
    { id: 'broker:paper:primary', name: 'paper-primary', broker: paperBroker, symbol: testSymbol, hedging: true },
    bus, nullLogger,
  );
  (broker as unknown as { status: string }).status = ServiceStatus.Running;
  registry.register(broker);

  const riskManager = new RiskManagerService(
    {
      id: 'risk:primary',
      name: 'primary-risk',
      maxOpenPositions: riskOverrides.maxOpenPositions ?? 10,
      maxPositionsPerSymbol: riskOverrides.maxPositionsPerSymbol ?? 5,
      maxDailyLoss: riskOverrides.maxDailyLoss ?? 1000,
    },
    bus, nullLogger,
  );

  const saga = new ExecutionSaga('saga:test', 'Test Saga', riskManager, registry, new CanonicalIdRegistry(), bus, nullLogger);

  return { bus, registry, broker, paperBroker, riskManager, saga };
}

describe('ExecutionSaga', () => {
  it('signal → risk approved → order filled', async () => {
    const { bus, riskManager, saga } = setupSaga();
    await riskManager.start();

    const orders: OrderEvent[] = [];
    bus.on('order', (e) => orders.push(e));

    await saga.execute(makeSignal({ action: 'BUY' }));

    expect(orders).toHaveLength(1);
    expect(orders[0].action).toBe('FILLED');
    expect(orders[0].symbol).toBe('EURUSD');
    expect(orders[0].direction).toBe('BUY');

    await riskManager.stop();
  });

  it('signal → risk rejected → no order', async () => {
    const { bus, riskManager, saga } = setupSaga({ maxOpenPositions: 0 });
    await riskManager.start();

    const orders: OrderEvent[] = [];
    bus.on('order', (e) => orders.push(e));

    await saga.execute(makeSignal({ action: 'BUY' }));

    expect(orders).toHaveLength(0);

    await riskManager.stop();
  });

  it('HOLD signal is a no-op', async () => {
    const { bus, riskManager, saga } = setupSaga();
    await riskManager.start();

    const orders: OrderEvent[] = [];
    bus.on('order', (e) => orders.push(e));

    await saga.execute(makeSignal({ action: 'HOLD' }));

    expect(orders).toHaveLength(0);
    await riskManager.stop();
  });

  it('fail-closed: rejects when risk manager not running', async () => {
    const { bus, saga } = setupSaga();
    // Risk manager NOT started

    const orders: OrderEvent[] = [];
    bus.on('order', (e) => orders.push(e));

    await saga.execute(makeSignal({ action: 'BUY' }));

    expect(orders).toHaveLength(0);
  });

  it('compensation: releases risk capacity on broker failure', async () => {
    const { bus, riskManager, saga, paperBroker } = setupSaga({ maxOpenPositions: 1 });
    await riskManager.start();

    // Make broker.placeOrder throw
    paperBroker.placeOrder = async () => { throw new Error('broker down'); };

    const orders: OrderEvent[] = [];
    bus.on('order', (e) => orders.push(e));

    await saga.execute(makeSignal({ action: 'BUY' }));

    // Should emit REJECTED
    expect(orders).toHaveLength(1);
    expect(orders[0].action).toBe('REJECTED');

    // Capacity should have been released — next signal should still be approvable
    const result = riskManager.validateOrder({ symbol: 'EURUSD', direction: 'BUY', lots: 1 });
    expect(result.ok && result.value.approved).toBe(true);

    await riskManager.stop();
  });

  it('resolves custom broker from signal metadata', async () => {
    const { bus, registry, riskManager, saga } = setupSaga();
    await riskManager.start();

    // Register a second broker
    const paperBroker2 = new PaperBroker(bus, nullLogger);
    const broker2 = new BrokerService(
      { id: 'broker:paper:secondary', name: 'paper-secondary', broker: paperBroker2, symbol: testSymbol, hedging: true },
      bus, nullLogger,
    );
    (broker2 as unknown as { status: string }).status = ServiceStatus.Running;
    registry.register(broker2);

    const orders: OrderEvent[] = [];
    bus.on('order', (e) => orders.push(e));

    await saga.execute(makeSignal({ metadata: { brokerId: 'broker:paper:secondary' } }));

    expect(orders).toHaveLength(1);
    expect(orders[0].brokerId).toBe('broker:paper:secondary');

    await riskManager.stop();
  });

  it('per-symbol mutex serializes concurrent signals', async () => {
    const { bus, riskManager, saga } = setupSaga();
    await riskManager.start();

    const orders: OrderEvent[] = [];
    bus.on('order', (e) => orders.push(e));

    // Fire two signals concurrently for the same symbol
    await Promise.all([
      saga.execute(makeSignal({ action: 'BUY' })),
      saga.execute(makeSignal({ action: 'SELL' })),
    ]);

    // Both should complete (serialized, not racing)
    expect(orders).toHaveLength(2);

    await riskManager.stop();
  });
});
