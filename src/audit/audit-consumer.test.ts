import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventEmitter } from 'node:events';
import { AuditConsumer } from './audit-consumer.js';
import { nullLogger } from '../shared/lib/logger.js';

/** Flush all pending microtasks/promise continuations */
const flushPromises = () => new Promise<void>((resolve) => setImmediate(resolve));

class MockAmqpChannel extends EventEmitter {
  consumers = new Map<string, (msg: any) => void>();
  assertedExchanges: string[] = [];
  assertedQueues: string[] = [];
  bindings: string[] = [];
  prefetchCount: number | null = null;
  cancelled: string[] = [];

  async assertExchange(name: string) { this.assertedExchanges.push(name); return { exchange: name }; }
  async assertQueue(name: string) { this.assertedQueues.push(name); return { queue: name, messageCount: 0, consumerCount: 0 }; }
  async bindQueue(queue: string, exchange: string, key: string) { this.bindings.push(`${queue}->${exchange}:${key}`); }
  async consume(queue: string, handler: (msg: any) => void) { const tag = `tag-${queue}`; this.consumers.set(tag, handler); return { consumerTag: tag }; }
  ack(_msg: unknown) {}
  async cancel(tag: string) { this.cancelled.push(tag); }
  async prefetch(count: number) { this.prefetchCount = count; }

  simulateMessage(content: object) {
    for (const handler of this.consumers.values()) {
      handler({ content: Buffer.from(JSON.stringify(content)), fields: {}, properties: {} });
    }
  }
}

describe('AuditConsumer', () => {
  let channel: MockAmqpChannel;
  let consumer: AuditConsumer;

  beforeEach(() => {
    channel = new MockAmqpChannel();
    consumer = new AuditConsumer(channel as any, nullLogger, { bufferSize: 5 });
  });

  it('start() asserts exchange, queue, binding, prefetch', async () => {
    await consumer.start();

    expect(channel.assertedExchanges).toContain('te.events');
    expect(channel.assertedQueues).toContain('te.audit');
    expect(channel.bindings).toContain('te.audit->te.events:event.#');
    expect(channel.prefetchCount).toBe(50);
    expect(consumer.isStarted).toBe(true);
  });

  it('stores incoming message in buffer', async () => {
    await consumer.start();

    channel.simulateMessage({
      instanceId: 'inst-1',
      type: 'signal',
      payload: { symbol: 'EURUSD' },
      timestamp: '2026-01-01T00:00:00.000Z',
    });
    await flushPromises();

    expect(consumer.size).toBe(1);
    const entries = consumer.query();
    expect(entries[0].instanceId).toBe('inst-1');
    expect(entries[0].type).toBe('signal');
    expect(entries[0].payload).toEqual({ symbol: 'EURUSD' });
  });

  it('ring buffer drops oldest entry when full', async () => {
    await consumer.start();

    for (let i = 1; i <= 7; i++) {
      channel.simulateMessage({
        instanceId: `inst-${i}`,
        type: 'order',
        payload: { i },
        timestamp: `2026-01-01T00:00:0${i}.000Z`,
      });
    }
    await flushPromises();

    // Buffer size is 5, so oldest 2 should be dropped
    expect(consumer.size).toBe(5);
    const entries = consumer.query();
    expect(entries[0].instanceId).toBe('inst-3');
    expect(entries[4].instanceId).toBe('inst-7');
  });

  it('query() filters by type', async () => {
    await consumer.start();

    channel.simulateMessage({ type: 'signal', payload: {}, timestamp: '2026-01-01T00:00:00.000Z' });
    channel.simulateMessage({ type: 'order', payload: {}, timestamp: '2026-01-01T00:00:01.000Z' });
    channel.simulateMessage({ type: 'signal', payload: {}, timestamp: '2026-01-01T00:00:02.000Z' });
    await flushPromises();

    const signals = consumer.query({ type: 'signal' });
    expect(signals).toHaveLength(2);
    expect(signals.every((e) => e.type === 'signal')).toBe(true);
  });

  it('query() filters by since (ISO string comparison)', async () => {
    await consumer.start();

    channel.simulateMessage({ type: 'a', payload: {}, timestamp: '2026-01-01T00:00:00.000Z' });
    channel.simulateMessage({ type: 'b', payload: {}, timestamp: '2026-01-02T00:00:00.000Z' });
    channel.simulateMessage({ type: 'c', payload: {}, timestamp: '2026-01-03T00:00:00.000Z' });
    await flushPromises();

    const result = consumer.query({ since: '2026-01-02T00:00:00.000Z' });
    expect(result).toHaveLength(2);
    expect(result[0].type).toBe('b');
    expect(result[1].type).toBe('c');
  });

  it('query() respects limit (returns most recent)', async () => {
    await consumer.start();

    for (let i = 1; i <= 4; i++) {
      channel.simulateMessage({ type: 'x', payload: { i }, timestamp: `2026-01-0${i}T00:00:00.000Z` });
    }
    await flushPromises();

    const result = consumer.query({ limit: 2 });
    expect(result).toHaveLength(2);
    expect((result[0].payload as any).i).toBe(3);
    expect((result[1].payload as any).i).toBe(4);
  });

  it('stop() cancels consumer', async () => {
    await consumer.start();
    await consumer.stop();

    expect(channel.cancelled).toContain('tag-te.audit');
    expect(consumer.isStarted).toBe(false);
  });

  it('writes to Postgres when db is provided and acks after insert resolves', async () => {
    const mockValues = vi.fn().mockResolvedValue(undefined);
    const mockInsert = vi.fn().mockReturnValue({ values: mockValues });
    const mockDb = { insert: mockInsert } as any;
    const ackSpy = vi.spyOn(channel, 'ack');

    const dbConsumer = new AuditConsumer(channel as any, nullLogger, { bufferSize: 5, db: mockDb });
    await dbConsumer.start();

    channel.simulateMessage({
      instanceId: 'inst-1',
      type: 'order',
      payload: { symbol: 'EURUSD' },
      timestamp: '2026-01-01T00:00:00.000Z',
    });

    // Before promises flush: insert may still be pending — ack should NOT have been called yet
    expect(ackSpy).not.toHaveBeenCalled();

    await flushPromises();

    // Ring buffer still works
    expect(dbConsumer.size).toBe(1);

    // Postgres write was called
    expect(mockInsert).toHaveBeenCalledTimes(1);
    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({ instanceId: 'inst-1', type: 'order' }),
    );

    // Ack happens after the insert resolves
    expect(ackSpy).toHaveBeenCalledTimes(1);
  });

  it('still acks when Postgres insert throws (prevents infinite requeue)', async () => {
    const mockValues = vi.fn().mockRejectedValue(new Error('DB connection lost'));
    const mockInsert = vi.fn().mockReturnValue({ values: mockValues });
    const mockDb = { insert: mockInsert } as any;
    const ackSpy = vi.spyOn(channel, 'ack');

    const dbConsumer = new AuditConsumer(channel as any, nullLogger, { bufferSize: 5, db: mockDb });
    await dbConsumer.start();

    channel.simulateMessage({
      instanceId: 'inst-1',
      type: 'order',
      payload: { symbol: 'EURUSD' },
      timestamp: '2026-01-01T00:00:00.000Z',
    });
    await flushPromises();

    // Message is still acked even though DB write failed
    expect(ackSpy).toHaveBeenCalledTimes(1);
    // Entry was still pushed to the ring buffer before the failed DB write
    expect(dbConsumer.size).toBe(1);
  });

  it('works without db (no Postgres write)', async () => {
    const noPgConsumer = new AuditConsumer(channel as any, nullLogger, { bufferSize: 5 });
    await noPgConsumer.start();

    channel.simulateMessage({
      type: 'signal',
      payload: {},
      timestamp: '2026-01-01T00:00:00.000Z',
    });
    await flushPromises();

    expect(noPgConsumer.size).toBe(1);
    // No error, no crash — just ring buffer
  });
});
