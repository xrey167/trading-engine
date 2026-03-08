import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventEmitter } from 'node:events';
import { AuditConsumer } from './audit-consumer.js';
import { nullLogger } from '../shared/lib/logger.js';

const flushPromises = () => new Promise<void>((resolve) => setImmediate(resolve));

class MockPgClient extends EventEmitter {
  connected = false;
  ended = false;
  listenChannels: string[] = [];

  async connect() { this.connected = true; }
  async end() { this.ended = true; }
  async query(sql: string) {
    const match = sql.match(/LISTEN (\w+)/i);
    if (match) this.listenChannels.push(match[1]);
    return { rows: [] };
  }

  simulateNotification(channel: string, payload: string) {
    this.emit('notification', { channel, payload });
  }
}

let mockClient: MockPgClient;

vi.mock('pg', async () => {
  const actual = await vi.importActual<typeof import('pg')>('pg');
  return {
    default: {
      ...actual.default,
      Client: class {
        // biome-ignore lint/correctness/noConstructorReturn: mock needs to return the shared instance
        constructor() { return mockClient; }
      },
    },
  };
});

function makeMockPool(notifyQueryFn?: (text: string, values: unknown[]) => unknown) {
  return {
    query: vi.fn().mockImplementation(async (text: string, values: unknown[]) => {
      if (text.trimStart().toUpperCase().startsWith('UPDATE') && notifyQueryFn) {
        return notifyQueryFn(text, values);
      }
      return { rows: [] };
    }),
  };
}

describe('AuditConsumer', () => {
  let pool: ReturnType<typeof makeMockPool>;
  let consumer: AuditConsumer;

  beforeEach(() => {
    mockClient = new MockPgClient();
    pool = makeMockPool();
    consumer = new AuditConsumer(pool as any, nullLogger, { bufferSize: 5 });
  });

  it('start() connects listen client and issues LISTEN', async () => {
    await consumer.start();

    expect(mockClient.connected).toBe(true);
    expect(mockClient.listenChannels).toContain('te_events');
    expect(consumer.isStarted).toBe(true);
  });

  it('stores incoming NOTIFY row in buffer', async () => {
    const row = { id: 1, type: 'signal', payload: { symbol: 'EURUSD' }, instance_id: 'inst-1', created_at: new Date('2026-01-01T00:00:00.000Z') };
    pool = makeMockPool(() => ({ rows: [row] }));
    consumer = new AuditConsumer(pool as any, nullLogger, { bufferSize: 5 });

    await consumer.start();
    mockClient.simulateNotification('te_events', '42');
    await flushPromises();

    expect(consumer.size).toBe(1);
    const entries = consumer.query();
    expect(entries[0].instanceId).toBe('inst-1');
    expect(entries[0].type).toBe('signal');
    expect(entries[0].payload).toEqual({ symbol: 'EURUSD' });
  });

  it('ring buffer drops oldest entry when full', async () => {
    let callCount = 0;
    pool = makeMockPool(() => {
      callCount++;
      const row = { id: callCount, type: 'order', payload: { i: callCount }, instance_id: `inst-${callCount}`, created_at: new Date(`2026-01-01T00:00:0${callCount}.000Z`) };
      return { rows: [row] };
    });
    consumer = new AuditConsumer(pool as any, nullLogger, { bufferSize: 5 });
    await consumer.start();

    for (let i = 1; i <= 7; i++) {
      mockClient.simulateNotification('te_events', String(i));
    }
    await flushPromises();

    expect(consumer.size).toBe(5);
    const entries = consumer.query();
    expect(entries[0].instanceId).toBe('inst-3');
    expect(entries[4].instanceId).toBe('inst-7');
  });

  it('query() filters by type', async () => {
    let callCount = 0;
    const types = ['signal', 'order', 'signal'];
    pool = makeMockPool(() => {
      const t = types[callCount++];
      return { rows: [{ id: callCount, type: t, payload: {}, instance_id: 'inst', created_at: new Date() }] };
    });
    consumer = new AuditConsumer(pool as any, nullLogger, { bufferSize: 5 });
    await consumer.start();

    for (let i = 0; i < 3; i++) mockClient.simulateNotification('te_events', String(i + 1));
    await flushPromises();

    const signals = consumer.query({ type: 'signal' });
    expect(signals).toHaveLength(2);
    expect(signals.every((e) => e.type === 'signal')).toBe(true);
  });

  it('query() filters by since', async () => {
    const dates = ['2026-01-01T00:00:00.000Z', '2026-01-02T00:00:00.000Z', '2026-01-03T00:00:00.000Z'];
    let callCount = 0;
    pool = makeMockPool(() => {
      const d = dates[callCount++];
      return { rows: [{ id: callCount, type: 'x', payload: {}, instance_id: 'inst', created_at: new Date(d) }] };
    });
    consumer = new AuditConsumer(pool as any, nullLogger, { bufferSize: 5 });
    await consumer.start();

    for (let i = 0; i < 3; i++) mockClient.simulateNotification('te_events', String(i + 1));
    await flushPromises();

    const result = consumer.query({ since: '2026-01-02T00:00:00.000Z' });
    expect(result).toHaveLength(2);
  });

  it('query() respects limit (returns most recent)', async () => {
    let callCount = 0;
    pool = makeMockPool(() => {
      callCount++;
      return { rows: [{ id: callCount, type: 'x', payload: { i: callCount }, instance_id: 'inst', created_at: new Date() }] };
    });
    consumer = new AuditConsumer(pool as any, nullLogger, { bufferSize: 10 });
    await consumer.start();

    for (let i = 0; i < 4; i++) mockClient.simulateNotification('te_events', String(i + 1));
    await flushPromises();

    const result = consumer.query({ limit: 2 });
    expect(result).toHaveLength(2);
    expect((result[0].payload as any).i).toBe(3);
    expect((result[1].payload as any).i).toBe(4);
  });

  it('stop() ends the listen client', async () => {
    await consumer.start();
    await consumer.stop();

    expect(mockClient.ended).toBe(true);
    expect(consumer.isStarted).toBe(false);
  });

  it('writes to Postgres when db is provided', async () => {
    const row = { id: 1, type: 'order', payload: { symbol: 'EURUSD' }, instance_id: 'inst-1', created_at: new Date('2026-01-01T00:00:00.000Z') };
    pool = makeMockPool(() => ({ rows: [row] }));

    const mockValues = vi.fn().mockResolvedValue(undefined);
    const mockInsert = vi.fn().mockReturnValue({ values: mockValues });
    const mockDb = { insert: mockInsert } as any;

    const dbConsumer = new AuditConsumer(pool as any, nullLogger, { bufferSize: 5, db: mockDb });
    await dbConsumer.start();

    mockClient.simulateNotification('te_events', '1');
    await flushPromises();

    expect(dbConsumer.size).toBe(1);
    expect(mockInsert).toHaveBeenCalledTimes(1);
    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({ instanceId: 'inst-1', type: 'order' }),
    );
  });

  it('continues when Postgres write fails', async () => {
    const row = { id: 1, type: 'order', payload: {}, instance_id: 'inst-1', created_at: new Date() };
    pool = makeMockPool(() => ({ rows: [row] }));

    const mockValues = vi.fn().mockRejectedValue(new Error('DB connection lost'));
    const mockInsert = vi.fn().mockReturnValue({ values: mockValues });
    const mockDb = { insert: mockInsert } as any;

    const dbConsumer = new AuditConsumer(pool as any, nullLogger, { bufferSize: 5, db: mockDb });
    await dbConsumer.start();

    mockClient.simulateNotification('te_events', '1');
    await flushPromises();

    expect(dbConsumer.size).toBe(1);
  });

  it('works without db (no Postgres write)', async () => {
    await consumer.start();

    mockClient.simulateNotification('te_events', '1');
    await flushPromises();

    expect(consumer.size).toBe(0);
  });
});
