import { describe, it, expect, beforeEach } from 'vitest';
import { EventEmitter } from 'node:events';
import { TypedEventBus } from '../event-bus.js';
import type { AppEventMap, SignalEvent } from '../services/event-map.js';
import { AmqpEventBridge } from './amqp-event-bridge.js';
import type { BridgeableEvent } from './redis-event-bridge.js';
import { nullLogger } from './logger.js';

interface ConsumeMessage {
  content: Buffer;
  fields: object;
  properties: object;
}

class MockAmqpChannel extends EventEmitter {
  published: Array<{ exchange: string; routingKey: string; content: Buffer; options: object }> = [];
  consumers = new Map<string, (msg: ConsumeMessage | null) => void>();
  assertedExchanges: Array<{ name: string; type: string; opts: object }> = [];
  assertedQueues: Array<{ name: string; opts: object }> = [];
  bindings: Array<{ queue: string; exchange: string; key: string }> = [];
  prefetchCount: number | null = null;
  cancelled: string[] = [];
  deletedQueues: string[] = [];

  async assertExchange(name: string, type: string, opts: object) { this.assertedExchanges.push({ name, type, opts }); return { exchange: name }; }
  async assertQueue(name: string, opts: object) { this.assertedQueues.push({ name, opts }); return { queue: name, messageCount: 0, consumerCount: 0 }; }
  async bindQueue(queue: string, exchange: string, key: string) { this.bindings.push({ queue, exchange, key }); }
  publish(exchange: string, routingKey: string, content: Buffer, options?: object) { this.published.push({ exchange, routingKey, content, options: options ?? {} }); return true; }
  async consume(queue: string, handler: (msg: ConsumeMessage | null) => void) { const tag = `tag-${queue}`; this.consumers.set(tag, handler); return { consumerTag: tag }; }
  ack(_msg: unknown) {}
  async cancel(tag: string) { this.cancelled.push(tag); }
  async deleteQueue(name: string) { this.deletedQueues.push(name); }
  async prefetch(count: number) { this.prefetchCount = count; }

  simulateMessage(content: object) {
    for (const handler of this.consumers.values()) {
      handler({ content: Buffer.from(JSON.stringify(content)), fields: {}, properties: {} });
    }
  }
}

describe('AmqpEventBridge', () => {
  let bus: TypedEventBus<AppEventMap>;
  let channel: MockAmqpChannel;
  const events: BridgeableEvent[] = ['signal', 'order', 'normalized_bar'];

  function createBridge(overrideEvents?: BridgeableEvent[]) {
    return new AmqpEventBridge(
      bus,
      channel as unknown as import('amqplib').ConfirmChannel,
      overrideEvents ?? events,
      nullLogger,
    );
  }

  beforeEach(() => {
    bus = new TypedEventBus<AppEventMap>();
    channel = new MockAmqpChannel();
  });

  it('echo prevention — ignores own messages', async () => {
    const bridge = createBridge(['signal']);
    await bridge.start();

    const received: SignalEvent[] = [];
    bus.on('signal', (e) => received.push(e));

    // Grab the instanceId from a published message
    const signal: SignalEvent = {
      serviceId: 'test', symbol: 'EURUSD', timeframe: 'H1',
      action: 'BUY', confidence: 0.9, metadata: {}, timestamp: new Date().toISOString(),
    };
    bus.emit('signal', signal);

    // Wait for async publish via circuit breaker
    await new Promise((r) => setTimeout(r, 10));

    const published = channel.published[0];
    const envelope = JSON.parse(published.content.toString());

    // Clear received from the local emit
    received.length = 0;

    // Simulate receiving own message back — should be ignored
    channel.simulateMessage(envelope);
    expect(received).toHaveLength(0);

    // Foreign message should be re-emitted
    channel.simulateMessage({ ...envelope, instanceId: 'foreign-id' });
    expect(received).toHaveLength(1);

    await bridge.stop();
  });

  it('type validation — rejects unknown event types', async () => {
    const bridge = createBridge(['signal']);
    await bridge.start();

    const received: unknown[] = [];
    bus.on('signal', (e) => received.push(e));

    // Send message with unknown type
    channel.simulateMessage({
      instanceId: 'foreign',
      type: 'malicious_event',
      payload: { bad: true },
      timestamp: new Date().toISOString(),
    });
    expect(received).toHaveLength(0);

    // Send message with valid type
    channel.simulateMessage({
      instanceId: 'foreign',
      type: 'signal',
      payload: { action: 'BUY' },
      timestamp: new Date().toISOString(),
    });
    expect(received).toHaveLength(1);

    await bridge.stop();
  });

  it('envelope round-trip serialization includes timestamp', async () => {
    const bridge = createBridge(['signal']);
    await bridge.start();

    const signal: SignalEvent = {
      serviceId: 'test', symbol: 'EURUSD', timeframe: 'H1',
      action: 'SELL', confidence: 0.75, metadata: {}, timestamp: '2024-06-01T00:00:00Z',
    };
    bus.emit('signal', signal);

    await new Promise((r) => setTimeout(r, 10));

    expect(channel.published).toHaveLength(1);
    const envelope = JSON.parse(channel.published[0].content.toString());
    expect(envelope.type).toBe('signal');
    expect(envelope.payload.action).toBe('SELL');
    expect(envelope.payload.symbol).toBe('EURUSD');
    expect(typeof envelope.timestamp).toBe('string');
    expect(typeof envelope.instanceId).toBe('string');

    await bridge.stop();
  });

  it('local bus event triggers publish with correct routing key', async () => {
    const bridge = createBridge(['signal', 'order']);
    await bridge.start();

    bus.emit('signal', {
      serviceId: 'test', symbol: 'EURUSD', timeframe: 'H1',
      action: 'BUY', confidence: 1, metadata: {}, timestamp: new Date().toISOString(),
    });
    bus.emit('order', {
      action: 'PLACED', brokerId: 'paper', symbol: 'EURUSD',
      direction: 'BUY', lots: 0.1, price: 1.1, metadata: {}, timestamp: new Date().toISOString(),
    });

    await new Promise((r) => setTimeout(r, 10));

    expect(channel.published).toHaveLength(2);
    expect(channel.published[0].routingKey).toBe('event.signal');
    expect(channel.published[0].exchange).toBe('te.events');
    expect(channel.published[1].routingKey).toBe('event.order');

    await bridge.stop();
  });

  it('persistent delivery mode for order/risk events', async () => {
    const bridge = createBridge(['order', 'risk']);
    await bridge.start();

    bus.emit('order', {
      action: 'FILLED', brokerId: 'paper', symbol: 'EURUSD',
      direction: 'BUY', lots: 0.1, price: 1.1, metadata: {}, timestamp: new Date().toISOString(),
    });
    bus.emit('risk', {
      action: 'APPROVED', symbol: 'EURUSD', reason: 'ok',
      metadata: {}, timestamp: new Date().toISOString(),
    });

    await new Promise((r) => setTimeout(r, 10));

    expect(channel.published).toHaveLength(2);
    expect((channel.published[0].options as Record<string, unknown>).deliveryMode).toBe(2);
    expect((channel.published[1].options as Record<string, unknown>).deliveryMode).toBe(2);

    await bridge.stop();
  });

  it('non-persistent for signal and normalized_bar events', async () => {
    const bridge = createBridge(['signal', 'normalized_bar']);
    await bridge.start();

    bus.emit('signal', {
      serviceId: 'test', symbol: 'EURUSD', timeframe: 'H1',
      action: 'BUY', confidence: 1, metadata: {}, timestamp: new Date().toISOString(),
    });
    bus.emit('normalized_bar', {
      providerId: 'test', symbol: 'EURUSD', timeframe: 'H1',
      bar: { time: '2024-01-01T00:00:00Z', open: 1, high: 2, low: 0.5, close: 1.5, volume: 100 },
      timestamp: new Date().toISOString(),
    });

    await new Promise((r) => setTimeout(r, 10));

    expect(channel.published).toHaveLength(2);
    expect((channel.published[0].options as Record<string, unknown>).deliveryMode).toBeUndefined();
    expect((channel.published[1].options as Record<string, unknown>).deliveryMode).toBeUndefined();

    await bridge.stop();
  });

  it('circuit breaker wraps publish calls', async () => {
    // Use a very low threshold so the CB opens quickly
    const bridge = new AmqpEventBridge(
      bus,
      channel as unknown as import('amqplib').ConfirmChannel,
      ['signal'],
      nullLogger,
      { failureThreshold: 1, resetTimeoutMs: 60_000 },
    );
    await bridge.start();

    // Make publish throw to trip the circuit breaker
    channel.publish = () => { throw new Error('publish failed'); };

    bus.emit('signal', {
      serviceId: 'test', symbol: 'EURUSD', timeframe: 'H1',
      action: 'BUY', confidence: 1, metadata: {}, timestamp: new Date().toISOString(),
    });

    await new Promise((r) => setTimeout(r, 10));

    // Restore publish to verify CB is now open
    const publishCalls: unknown[] = [];
    channel.publish = (...args: unknown[]) => { publishCalls.push(args); return true; };

    bus.emit('signal', {
      serviceId: 'test', symbol: 'EURUSD', timeframe: 'H1',
      action: 'BUY', confidence: 1, metadata: {}, timestamp: new Date().toISOString(),
    });

    await new Promise((r) => setTimeout(r, 10));

    // CB should be open, so no publish calls go through
    expect(publishCalls).toHaveLength(0);

    await bridge.stop();
  });

  it('stop() removes local handlers and cancels consumer', async () => {
    const bridge = createBridge(['signal', 'order']);
    await bridge.start();
    expect(bridge.isStarted).toBe(true);

    await bridge.stop();
    expect(bridge.isStarted).toBe(false);

    // Consumer should have been cancelled
    expect(channel.cancelled.length).toBeGreaterThan(0);

    // Queue should have been deleted
    expect(channel.deletedQueues.length).toBeGreaterThan(0);

    // Local handlers should be removed — emitting should not trigger publish
    channel.published.length = 0;
    bus.emit('signal', {
      serviceId: 'test', symbol: 'EURUSD', timeframe: 'H1',
      action: 'BUY', confidence: 1, metadata: {}, timestamp: new Date().toISOString(),
    });

    await new Promise((r) => setTimeout(r, 10));
    expect(channel.published).toHaveLength(0);
  });
});
