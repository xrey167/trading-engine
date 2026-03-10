import { describe, it, expect } from 'vitest';
import { TypedEventBus } from '../shared/event-bus.js';
import type { AppEventMap, OrderEvent } from '../shared/services/event-map.js';
import { ServiceStatus, ServiceKind } from '../shared/services/types.js';
import { ServiceRegistry } from '../shared/services/service-registry.js';
import { BrokerService } from '../broker/broker-service.js';
import { RiskManagerService } from './risk-manager.js';
import { ExecutionSaga } from './execution-saga.js';
import { OrderManagerService } from './order-manager.js';
import { nullLogger } from '../shared/lib/logger.js';
import { CanonicalIdRegistry } from '../shared/lib/canonical-id/index.js';
import { PaperBroker } from '../broker/paper/paper-broker.js';
import { SymbolInfoForex as SymbolInfo } from '../engine/core/symbol.js';

const testSymbol = new SymbolInfo('EURUSD', 5);

describe('OrderManagerService', () => {
  it('has correct id and kind', () => {
    const bus = new TypedEventBus<AppEventMap>();
    const riskManager = new RiskManagerService(
      { id: 'risk:test', name: 'test-risk', maxOpenPositions: 10, maxPositionsPerSymbol: 5, maxDailyLoss: 1000 },
      bus, nullLogger,
    );
    const saga = new ExecutionSaga('saga:test', 'Test Saga', riskManager, new ServiceRegistry(), new CanonicalIdRegistry(), bus, nullLogger);
    const svc = new OrderManagerService({ id: 'order-mgr:test', name: 'test-order-mgr' }, saga, bus, nullLogger);

    expect(svc.id).toBe('order-mgr:test');
    expect(svc.kind).toBe(ServiceKind.OrderManager);
  });

  it('subscribes to signal events and delegates to saga', async () => {
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
      { id: 'risk:test', name: 'test-risk', maxOpenPositions: 10, maxPositionsPerSymbol: 5, maxDailyLoss: 1000 },
      bus, nullLogger,
    );
    await riskManager.start();

    const saga = new ExecutionSaga('saga:test', 'Test Saga', riskManager, registry, new CanonicalIdRegistry(), bus, nullLogger);
    const orderMgr = new OrderManagerService({ id: 'order-mgr:test', name: 'test-order-mgr' }, saga, bus, nullLogger);
    await orderMgr.start();

    const orders: OrderEvent[] = [];
    bus.on('order', (e) => orders.push(e));

    // Emit a signal event — OrderManager should pick it up and delegate to saga
    bus.emit('signal', {
      serviceId: 'strategy:test',
      symbol: 'EURUSD',
      timeframe: 'H1',
      action: 'BUY',
      confidence: 1.0,
      metadata: {},
      timestamp: new Date().toISOString(),
    });

    // Wait for async handler
    await new Promise(r => setTimeout(r, 50));

    expect(orders).toHaveLength(1);
    expect(orders[0].action).toBe('FILLED');

    await orderMgr.stop();
    await riskManager.stop();
  });

  it('does NOT handle signals after stop', async () => {
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
      { id: 'risk:test', name: 'test-risk', maxOpenPositions: 10, maxPositionsPerSymbol: 5, maxDailyLoss: 1000 },
      bus, nullLogger,
    );
    await riskManager.start();

    const saga = new ExecutionSaga('saga:test', 'Test Saga', riskManager, registry, new CanonicalIdRegistry(), bus, nullLogger);
    const orderMgr = new OrderManagerService({ id: 'order-mgr:test', name: 'test-order-mgr' }, saga, bus, nullLogger);
    await orderMgr.start();
    await orderMgr.stop();

    const orders: OrderEvent[] = [];
    bus.on('order', (e) => orders.push(e));

    bus.emit('signal', {
      serviceId: 'strategy:test',
      symbol: 'EURUSD',
      timeframe: 'H1',
      action: 'BUY',
      confidence: 1.0,
      metadata: {},
      timestamp: new Date().toISOString(),
    });

    await new Promise(r => setTimeout(r, 50));
    expect(orders).toHaveLength(0);

    await riskManager.stop();
  });
});
