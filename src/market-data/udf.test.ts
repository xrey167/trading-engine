import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../app.js';
import type { PaperBroker } from '../broker/paper/paper-broker.js';

beforeEach(() => { vi.spyOn(console, 'log').mockImplementation(() => {}); });
afterEach(() => { vi.restoreAllMocks(); });

describe('UDF routes', () => {
  let app: FastifyInstance;
  beforeEach(async () => { app = await buildApp({ logger: false }); await app.ready(); });
  afterEach(() => app.close());

  describe('GET /udf/config', () => {
    it('returns server capabilities', async () => {
      const res = await app.inject({ method: 'GET', url: '/udf/config' });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.supports_search).toBe(true);
      expect(body.supports_time).toBe(true);
      expect(body.supported_resolutions).toContain('1D');
      expect(body.supported_resolutions).toContain('60');
      expect(body.exchanges).toHaveLength(1);
      expect(body.symbols_types).toHaveLength(1);
    });
  });

  describe('GET /udf/time', () => {
    it('returns server time as Unix timestamp string', async () => {
      const before = Math.floor(Date.now() / 1000);
      const res = await app.inject({ method: 'GET', url: '/udf/time' });
      const after = Math.floor(Date.now() / 1000);
      expect(res.statusCode).toBe(200);
      const ts = Number(res.payload);
      expect(ts).toBeGreaterThanOrEqual(before);
      expect(ts).toBeLessThanOrEqual(after);
    });
  });

  describe('GET /udf/symbols', () => {
    it('returns symbol info with correct pricescale', async () => {
      const res = await app.inject({ method: 'GET', url: '/udf/symbols?symbol=EURUSD' });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.name).toBe('EURUSD');
      expect(body.type).toBe('forex');
      expect(body.pricescale).toBe(100000); // 10^5 digits
      expect(body.has_intraday).toBe(true);
      expect(body.session).toBe('24x7');
      expect(body.supported_resolutions).toContain('1');
    });
  });

  describe('GET /udf/history', () => {
    it('returns no_data when no bars are seeded', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/udf/history?symbol=EURUSD&from=0&to=9999999999&resolution=60',
      });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ s: 'no_data' });
    });

    it('returns OHLCV arrays when bars are seeded', async () => {
      const broker = app.broker as PaperBroker;
      const now = Math.floor(Date.now() / 1000);
      broker.seedBars('EURUSD', 'H1', [
        { open: 1.1, high: 1.2, low: 1.0, close: 1.15, time: new Date(now * 1000), volume: 100 },
        { open: 1.15, high: 1.25, low: 1.05, close: 1.2, time: new Date((now - 3600) * 1000), volume: 200 },
      ]);

      const res = await app.inject({
        method: 'GET',
        url: `/udf/history?symbol=EURUSD&from=${now - 7200}&to=${now + 3600}&resolution=60`,
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.s).toBe('ok');
      expect(body.t).toHaveLength(2);
      expect(body.o).toHaveLength(2);
      expect(body.h).toHaveLength(2);
      expect(body.l).toHaveLength(2);
      expect(body.c).toHaveLength(2);
      expect(body.v).toHaveLength(2);
      // Chronological order — older bar first
      expect(body.t[0]).toBeLessThan(body.t[1]);
    });

    it('filters bars by from/to range', async () => {
      const broker = app.broker as PaperBroker;
      const t1 = 1700000000;
      const t2 = 1700003600;
      const t3 = 1700007200;
      broker.seedBars('EURUSD', 'H1', [
        { open: 1.1, high: 1.2, low: 1.0, close: 1.15, time: new Date(t3 * 1000) },
        { open: 1.1, high: 1.2, low: 1.0, close: 1.15, time: new Date(t2 * 1000) },
        { open: 1.1, high: 1.2, low: 1.0, close: 1.15, time: new Date(t1 * 1000) },
      ]);

      const res = await app.inject({
        method: 'GET',
        url: `/udf/history?symbol=EURUSD&from=${t2}&to=${t2}&resolution=60`,
      });
      const body = res.json();
      expect(body.s).toBe('ok');
      expect(body.t).toHaveLength(1);
      expect(body.t[0]).toBe(t2);
    });

    it('returns error for unsupported resolution', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/udf/history?symbol=EURUSD&from=0&to=9999999999&resolution=3',
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.s).toBe('error');
      expect(body.errmsg).toContain('Unsupported resolution');
    });
  });
});
