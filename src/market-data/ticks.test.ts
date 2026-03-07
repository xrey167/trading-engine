import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { buildApp } from '../app.js';
import type { FastifyInstance } from 'fastify';

describe('POST /ticks', () => {
  let app: FastifyInstance;
  beforeEach(async () => { app = await buildApp(); });
  afterEach(async () => { await app.close(); });

  it('accepts valid tick and returns 204', async () => {
    const res = await app.inject({
      method: 'POST', url: '/ticks',
      payload: { bid: 1.1050, ask: 1.1052, time: new Date().toISOString() },
    });
    expect(res.statusCode).toBe(204);
  });

  it('accepts tick without time field (defaults to now)', async () => {
    const res = await app.inject({
      method: 'POST', url: '/ticks',
      payload: { bid: 1.1050, ask: 1.1052 },
    });
    expect(res.statusCode).toBe(204);
  });

  it('emits tick event with correct shape', async () => {
    const ticks: unknown[] = [];
    app.emitter.on('tick', (e) => ticks.push(e));

    await app.inject({
      method: 'POST', url: '/ticks',
      payload: { bid: 1.2000, ask: 1.2002, time: '2025-01-15T12:00:00Z' },
    });

    expect(ticks).toHaveLength(1);
    expect(ticks[0]).toMatchObject({
      providerId: 'http',
      bid: 1.2000,
      ask: 1.2002,
      timestamp: '2025-01-15T12:00:00Z',
    });
  });

  it('rejects missing bid with 400', async () => {
    const res = await app.inject({
      method: 'POST', url: '/ticks',
      payload: { ask: 1.1052 },
    });
    expect(res.statusCode).toBe(400);
  });

  it('rejects missing ask with 400', async () => {
    const res = await app.inject({
      method: 'POST', url: '/ticks',
      payload: { bid: 1.1050 },
    });
    expect(res.statusCode).toBe(400);
  });

  it('rejects zero bid with 400', async () => {
    const res = await app.inject({
      method: 'POST', url: '/ticks',
      payload: { bid: 0, ask: 1.1052 },
    });
    expect(res.statusCode).toBe(400);
  });

  it('rejects negative ask with 400', async () => {
    const res = await app.inject({
      method: 'POST', url: '/ticks',
      payload: { bid: 1.1050, ask: -1 },
    });
    expect(res.statusCode).toBe(400);
  });
});
