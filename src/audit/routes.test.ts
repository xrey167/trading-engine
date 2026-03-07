import { describe, it, expect, afterEach } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import auditModule from './index.js';

describe('Audit routes', () => {
  let app: FastifyInstance;

  afterEach(async () => {
    await app.close();
  });

  it('returns 503 when auditConsumer is null', async () => {
    app = Fastify();
    app.decorate('auditConsumer', null);
    await app.register(auditModule);
    await app.ready();

    const res = await app.inject({ method: 'GET', url: '/audit/events' });
    expect(res.statusCode).toBe(503);
    const body = res.json();
    expect(body.error).toBe('Service Unavailable');
  });

  it('returns 200 with events when auditConsumer is available', async () => {
    app = Fastify();
    const mockEntries = [
      { id: 1, instanceId: 'i1', type: 'signal', payload: {}, timestamp: '2026-01-01T00:00:00.000Z', receivedAt: '2026-01-01T00:00:01.000Z' },
    ];
    app.decorate('auditConsumer', {
      query: () => mockEntries,
    } as any);
    await app.register(auditModule);
    await app.ready();

    const res = await app.inject({ method: 'GET', url: '/audit/events' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.total).toBe(1);
    expect(body.events).toHaveLength(1);
    expect(body.events[0].type).toBe('signal');
  });

  it('passes query params to consumer.query()', async () => {
    app = Fastify();
    let capturedOpts: any = null;
    app.decorate('auditConsumer', {
      query: (opts: any) => { capturedOpts = opts; return []; },
    } as any);
    await app.register(auditModule);
    await app.ready();

    await app.inject({
      method: 'GET',
      url: '/audit/events?type=order&since=2026-01-01T00:00:00.000Z&limit=10',
    });

    expect(capturedOpts).toEqual({
      type: 'order',
      since: '2026-01-01T00:00:00.000Z',
      limit: 10,
    });
  });
});
