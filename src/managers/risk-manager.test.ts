import { describe, it, expect } from 'vitest';
import { TypedEventBus } from '../shared/event-bus.js';
import type { AppEventMap, RiskEvent } from '../shared/services/event-map.js';
import { ServiceStatus, ServiceKind } from '../shared/services/types.js';
import { RiskManagerService } from './risk-manager.js';
import { nullLogger } from '../shared/lib/logger.js';

function makeRiskManager(overrides: Partial<{ maxOpenPositions: number; maxPositionsPerSymbol: number; maxDailyLoss: number }> = {}) {
  const bus = new TypedEventBus<AppEventMap>();
  const svc = new RiskManagerService(
    {
      id: 'risk:test',
      name: 'test-risk',
      maxOpenPositions: overrides.maxOpenPositions ?? 10,
      maxPositionsPerSymbol: overrides.maxPositionsPerSymbol ?? 5,
      maxDailyLoss: overrides.maxDailyLoss ?? 1000,
    },
    bus, nullLogger,
  );
  return { bus, svc };
}

describe('RiskManagerService', () => {
  it('has correct id and kind', () => {
    const { svc } = makeRiskManager();
    expect(svc.id).toBe('risk:test');
    expect(svc.kind).toBe(ServiceKind.RiskManager);
  });

  it('starts and stops', async () => {
    const { svc } = makeRiskManager();
    await svc.start();
    expect(svc.health().status).toBe(ServiceStatus.Running);
    await svc.stop();
    expect(svc.health().status).toBe(ServiceStatus.Stopped);
  });

  it('approves order when within limits', async () => {
    const { svc } = makeRiskManager();
    await svc.start();
    const result = svc.validateOrder({ symbol: 'EURUSD', direction: 'BUY', lots: 1 });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.approved).toBe(true);
    }
    await svc.stop();
  });

  it('rejects when not running (fail-closed)', () => {
    const { svc } = makeRiskManager();
    // Not started — status is STOPPED
    const result = svc.validateOrder({ symbol: 'EURUSD', direction: 'BUY', lots: 1 });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.approved).toBe(false);
      expect(result.value.reason).toContain('fail-closed');
    }
  });

  it('rejects when max open positions reached', async () => {
    const { bus, svc } = makeRiskManager({ maxOpenPositions: 2 });
    await svc.start();

    // Simulate 2 filled orders
    bus.emit('order', { action: 'FILLED', orderId: 0, orderType: 'UNKNOWN', brokerId: 'b', symbol: 'EURUSD', direction: 'BUY', lots: 1, price: 1.1, metadata: {}, timestamp: new Date().toISOString() });
    bus.emit('order', { action: 'FILLED', orderId: 0, orderType: 'UNKNOWN', brokerId: 'b', symbol: 'GBPUSD', direction: 'BUY', lots: 1, price: 1.3, metadata: {}, timestamp: new Date().toISOString() });

    const result = svc.validateOrder({ symbol: 'USDJPY', direction: 'BUY', lots: 1 });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.approved).toBe(false);
      expect(result.value.reason).toContain('Max open positions');
    }
    await svc.stop();
  });

  it('rejects when max positions per symbol reached', async () => {
    const { bus, svc } = makeRiskManager({ maxPositionsPerSymbol: 1 });
    await svc.start();

    bus.emit('order', { action: 'FILLED', orderId: 0, orderType: 'UNKNOWN', brokerId: 'b', symbol: 'EURUSD', direction: 'BUY', lots: 1, price: 1.1, metadata: {}, timestamp: new Date().toISOString() });

    const result = svc.validateOrder({ symbol: 'EURUSD', direction: 'BUY', lots: 1 });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.approved).toBe(false);
      expect(result.value.reason).toContain('Max positions per symbol');
    }
    await svc.stop();
  });

  it('rejects when max daily loss reached', async () => {
    const { svc } = makeRiskManager({ maxDailyLoss: 100 });
    await svc.start();

    svc.recordLoss(100);
    const result = svc.validateOrder({ symbol: 'EURUSD', direction: 'BUY', lots: 1 });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.approved).toBe(false);
      expect(result.value.reason).toContain('Max daily loss');
    }
    await svc.stop();
  });

  it('emits risk events on approval and rejection', async () => {
    const { bus, svc } = makeRiskManager({ maxOpenPositions: 1 });
    await svc.start();

    const events: RiskEvent[] = [];
    bus.on('risk', (e) => events.push(e));

    // First order — approved
    svc.validateOrder({ symbol: 'EURUSD', direction: 'BUY', lots: 1 });
    expect(events).toHaveLength(1);
    expect(events[0].action).toBe('APPROVED');

    // Simulate fill
    bus.emit('order', { action: 'FILLED', orderId: 0, orderType: 'UNKNOWN', brokerId: 'b', symbol: 'EURUSD', direction: 'BUY', lots: 1, price: 1.1, metadata: {}, timestamp: new Date().toISOString() });

    // Second order — rejected
    svc.validateOrder({ symbol: 'GBPUSD', direction: 'BUY', lots: 1 });
    expect(events).toHaveLength(2);
    expect(events[1].action).toBe('REJECTED');

    await svc.stop();
  });

  it('releaseCapacity decrements counters', async () => {
    const { bus, svc } = makeRiskManager({ maxOpenPositions: 1 });
    await svc.start();

    bus.emit('order', { action: 'FILLED', orderId: 0, orderType: 'UNKNOWN', brokerId: 'b', symbol: 'EURUSD', direction: 'BUY', lots: 1, price: 1.1, metadata: {}, timestamp: new Date().toISOString() });

    // Should be rejected
    let result = svc.validateOrder({ symbol: 'GBPUSD', direction: 'BUY', lots: 1 });
    expect(result.ok && !result.value.approved).toBe(true);

    // Release capacity
    svc.releaseCapacity('EURUSD');

    // Should now be approved
    result = svc.validateOrder({ symbol: 'GBPUSD', direction: 'BUY', lots: 1 });
    expect(result.ok && result.value.approved).toBe(true);

    await svc.stop();
  });

  it('open → close → open cycle: second open is not blocked by symbolPositions', async () => {
    const { bus, svc } = makeRiskManager({ maxPositionsPerSymbol: 1 });
    await svc.start();

    // Open a position for EURUSD
    bus.emit('order', { action: 'FILLED', orderId: 1, orderType: 'MARKET', brokerId: 'b', symbol: 'EURUSD', direction: 'BUY', lots: 1, price: 1.1, metadata: {}, timestamp: new Date().toISOString() });

    // Should be blocked now
    let result = svc.validateOrder({ symbol: 'EURUSD', direction: 'BUY', lots: 1 });
    expect(result.ok && !result.value.approved).toBe(true);

    // Close the position — symbolPositions should decrement
    bus.emit('close', { side: 1, size: 1, price: 1.1, time: new Date(), symbol: 'EURUSD' });

    // Second open for same symbol should now be approved
    result = svc.validateOrder({ symbol: 'EURUSD', direction: 'BUY', lots: 1 });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.approved).toBe(true);
    }

    await svc.stop();
  });

  it('resetDailyLoss clears the counter', async () => {
    const { svc } = makeRiskManager({ maxDailyLoss: 100 });
    await svc.start();

    svc.recordLoss(100);
    let result = svc.validateOrder({ symbol: 'EURUSD', direction: 'BUY', lots: 1 });
    expect(result.ok && !result.value.approved).toBe(true);

    svc.resetDailyLoss();
    result = svc.validateOrder({ symbol: 'EURUSD', direction: 'BUY', lots: 1 });
    expect(result.ok && result.value.approved).toBe(true);

    await svc.stop();
  });

  it('health metadata includes position count and daily loss', async () => {
    const { svc } = makeRiskManager();
    await svc.start();
    svc.recordLoss(50);
    const health = svc.health();
    expect(health.metadata).toEqual({ openPositionCount: 0, dailyLoss: 50 });
    await svc.stop();
  });
});
