import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../app.js';

let app: FastifyInstance;

beforeEach(async () => {
  app = await buildApp({ logger: false });
  await app.ready();
});

afterEach(() => app.close());

describe('/services routes', () => {
  describe('GET /services', () => {
    it('returns list of registered services', async () => {
      const res = await app.inject({ method: 'GET', url: '/services' });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(Array.isArray(body)).toBe(true);
      expect(body.length).toBeGreaterThanOrEqual(1);
      expect(body[0]).toMatchObject({
        id: 'broker:paper:primary',
        kind: 'BROKER',
        name: 'paper-primary',
      });
    });
  });

  describe('GET /services/health', () => {
    it('returns aggregate health', async () => {
      const res = await app.inject({ method: 'GET', url: '/services/health' });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.total).toBeGreaterThanOrEqual(1);
      expect(body.running).toBeGreaterThanOrEqual(1);
      expect(body.services).toBeDefined();
      expect(Array.isArray(body.services)).toBe(true);
    });
  });

  describe('GET /services/:id', () => {
    it('returns service detail for existing service', async () => {
      const res = await app.inject({ method: 'GET', url: '/services/broker:paper:primary' });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.id).toBe('broker:paper:primary');
      expect(body.kind).toBe('BROKER');
      expect(body.health).toBeDefined();
      expect(body.health.status).toBe('RUNNING');
    });

    it('returns 404 for unknown service', async () => {
      const res = await app.inject({ method: 'GET', url: '/services/nope' });
      expect(res.statusCode).toBe(404);
    });
  });

  describe('POST /services/:id/stop', () => {
    it('stops a running service', async () => {
      const res = await app.inject({ method: 'POST', url: '/services/broker:paper:primary/stop' });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.health.status).toBe('STOPPED');
    });

    it('returns 404 for unknown service', async () => {
      const res = await app.inject({ method: 'POST', url: '/services/nope/stop' });
      expect(res.statusCode).toBe(404);
    });
  });

  describe('POST /services/:id/start', () => {
    it('starts a stopped service', async () => {
      // Stop first
      await app.inject({ method: 'POST', url: '/services/broker:paper:primary/stop' });
      // Start
      const res = await app.inject({ method: 'POST', url: '/services/broker:paper:primary/start' });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.health.status).toBe('RUNNING');
    });
  });
});
