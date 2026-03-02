/**
 * Integration tests for all Fastify routes.
 *
 * Uses Fastify's built-in inject() to exercise the full request lifecycle
 * (schema validation → handler → serialization) without opening a real socket.
 *
 * R1  GET    /orders
 * R2  POST   /orders
 * R3  DELETE /orders/:id
 * R4  GET    /positions
 * R5  DELETE /positions/:side
 * R6  POST   /bars
 * R7  PATCH  /orders/:id
 * R8  GET    /account
 * R9  PUT    /positions/:side/sl-tp
 * R10 buildApp config
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from './app.js';

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function makeBar(
  close = 1.1050,
  opts: { open?: number; high?: number; low?: number } = {},
  time = '2024-01-01T00:00:00Z',
) {
  return {
    open:  opts.open  ?? close - 0.0010,
    high:  opts.high  ?? close + 0.0010,
    low:   opts.low   ?? close - 0.0020,
    close,
    time,
  };
}

/** Minimal valid POST /bars payload. */
function barsPayload(n = 1, close = 1.1050) {
  const bars = Array.from({ length: n }, (_, i) => makeBar(close - i * 0.0001));
  return { bar: bars[0], bars };
}

// Suppress PaperBroker console noise during tests.
beforeEach(() => { vi.spyOn(console, 'log').mockImplementation(() => {}); });
afterEach(() => { vi.restoreAllMocks(); });

// ─────────────────────────────────────────────────────────────
// R1 – GET /orders
// ─────────────────────────────────────────────────────────────

describe('R1 – GET /orders', () => {
  let app: FastifyInstance;
  beforeEach(async () => { app = await buildApp({ logger: false }); await app.ready(); });
  afterEach(() => app.close());

  it('returns an empty array on a fresh engine', async () => {
    const res = await app.inject({ method: 'GET', url: '/orders' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([]);
  });

  it('returns placed orders with the correct shape', async () => {
    await app.inject({ method: 'POST', url: '/orders', payload: { type: 'BUY_LIMIT', price: 1.09500 } });
    const res = await app.inject({ method: 'GET', url: '/orders' });
    const [order] = res.json();
    expect(order).toMatchObject({ type: 'BUY_LIMIT', price: 1.09500, side: 1 });
    expect(typeof order.id).toBe('string');
    expect(typeof order.time).toBe('string');
    expect(() => new Date(order.time)).not.toThrow();
  });

  it('lists all placed orders', async () => {
    await app.inject({ method: 'POST', url: '/orders', payload: { type: 'BUY_LIMIT',  price: 1.09500 } });
    await app.inject({ method: 'POST', url: '/orders', payload: { type: 'SELL_LIMIT', price: 1.11000 } });
    const res = await app.inject({ method: 'GET', url: '/orders' });
    expect(res.json()).toHaveLength(2);
  });
});

// ─────────────────────────────────────────────────────────────
// R2 – POST /orders
// ─────────────────────────────────────────────────────────────

describe('R2 – POST /orders', () => {
  let app: FastifyInstance;
  beforeEach(async () => { app = await buildApp({ logger: false }); await app.ready(); });
  afterEach(() => app.close());

  it.each([
    ['BUY_LIMIT',  1.09500],
    ['BUY_STOP',   1.11000],
    ['SELL_LIMIT', 1.11000],
    ['SELL_STOP',  1.09000],
    ['BUY_MIT',    1.09500],
    ['SELL_MIT',   1.11000],
  ] as const)('places a %s and returns an id', async (type, price) => {
    const res = await app.inject({ method: 'POST', url: '/orders', payload: { type, price } });
    expect(res.statusCode).toBe(200);
    expect(typeof res.json().id).toBe('string');
  });

  it('rejects an unknown order type with 400', async () => {
    const res = await app.inject({ method: 'POST', url: '/orders', payload: { type: 'MARKET', price: 1.09500 } });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toHaveProperty('error');
  });

  it('rejects missing price field with 400', async () => {
    const res = await app.inject({ method: 'POST', url: '/orders', payload: { type: 'BUY_LIMIT' } });
    expect(res.statusCode).toBe(400);
  });

  it('rejects missing type field with 400', async () => {
    const res = await app.inject({ method: 'POST', url: '/orders', payload: { price: 1.09500 } });
    expect(res.statusCode).toBe(400);
  });

  it('applies the size attribute to the placed order', async () => {
    await app.inject({ method: 'POST', url: '/orders', payload: { type: 'BUY_LIMIT', price: 1.09500, size: 2.5 } });
    const [order] = (await app.inject({ method: 'GET', url: '/orders' })).json();
    expect(order.size).toBe(2.5);
  });

  it('accepts oco: true attribute without error', async () => {
    const res = await app.inject({
      method: 'POST', url: '/orders',
      payload: { type: 'BUY_LIMIT', price: 1.09500, attributes: { oco: true } },
    });
    expect(res.statusCode).toBe(200);
  });

  it('accepts oco: false attribute without error (regression: false was silently ignored)', async () => {
    const res = await app.inject({
      method: 'POST', url: '/orders',
      payload: { type: 'BUY_LIMIT', price: 1.09400, attributes: { oco: false } },
    });
    expect(res.statusCode).toBe(200);
  });

  it('accepts bracket SL/TP attributes', async () => {
    const res = await app.inject({
      method: 'POST', url: '/orders',
      payload: { type: 'BUY_LIMIT', price: 1.09500, attributes: { bracketSL: 0.0050, bracketTP: 0.0100 } },
    });
    expect(res.statusCode).toBe(200);
  });

  it('accepts limitConfirm attribute', async () => {
    const res = await app.inject({
      method: 'POST', url: '/orders',
      payload: { type: 'BUY_LIMIT', price: 1.09500, attributes: { limitConfirm: 1 } },
    });
    expect(res.statusCode).toBe(200);
  });

  it('rejects invalid limitConfirm value with 400', async () => {
    const res = await app.inject({
      method: 'POST', url: '/orders',
      payload: { type: 'BUY_LIMIT', price: 1.09500, attributes: { limitConfirm: 99 } },
    });
    expect(res.statusCode).toBe(400);
  });
});

// ─────────────────────────────────────────────────────────────
// R3 – DELETE /orders/:id
// ─────────────────────────────────────────────────────────────

describe('R3 – DELETE /orders/:id', () => {
  let app: FastifyInstance;
  beforeEach(async () => { app = await buildApp({ logger: false }); await app.ready(); });
  afterEach(() => app.close());

  it('deletes an existing order and returns ok: true', async () => {
    const { id } = (await app.inject({ method: 'POST', url: '/orders', payload: { type: 'BUY_LIMIT', price: 1.09500 } })).json();
    const res = await app.inject({ method: 'DELETE', url: `/orders/${id}` });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });
  });

  it('returns 404 for an unknown order id', async () => {
    const res = await app.inject({ method: 'DELETE', url: '/orders/nonexistent-id' });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toHaveProperty('error');
  });

  it('order is absent from GET /orders after deletion', async () => {
    const { id } = (await app.inject({ method: 'POST', url: '/orders', payload: { type: 'BUY_LIMIT', price: 1.09500 } })).json();
    await app.inject({ method: 'DELETE', url: `/orders/${id}` });
    expect((await app.inject({ method: 'GET', url: '/orders' })).json()).toEqual([]);
  });

  it('second delete of the same id returns 404', async () => {
    const { id } = (await app.inject({ method: 'POST', url: '/orders', payload: { type: 'BUY_LIMIT', price: 1.09500 } })).json();
    await app.inject({ method: 'DELETE', url: `/orders/${id}` });
    const res = await app.inject({ method: 'DELETE', url: `/orders/${id}` });
    expect(res.statusCode).toBe(404);
  });

  it('deleting one order leaves others intact', async () => {
    const { id: id1 } = (await app.inject({ method: 'POST', url: '/orders', payload: { type: 'BUY_LIMIT',  price: 1.09500 } })).json();
    await app.inject({ method: 'POST', url: '/orders', payload: { type: 'SELL_LIMIT', price: 1.11000 } });
    await app.inject({ method: 'DELETE', url: `/orders/${id1}` });
    const orders = (await app.inject({ method: 'GET', url: '/orders' })).json();
    expect(orders).toHaveLength(1);
    expect(orders[0].type).toBe('SELL_LIMIT');
  });
});

// ─────────────────────────────────────────────────────────────
// R4 – GET /positions
// ─────────────────────────────────────────────────────────────

describe('R4 – GET /positions', () => {
  let app: FastifyInstance;
  beforeEach(async () => { app = await buildApp({ logger: false }); await app.ready(); });
  afterEach(() => app.close());

  it('returns both long and short slots', async () => {
    const body = (await app.inject({ method: 'GET', url: '/positions' })).json();
    expect(body).toHaveProperty('long');
    expect(body).toHaveProperty('short');
  });

  it('flat position has size 0', async () => {
    const { long, short } = (await app.inject({ method: 'GET', url: '/positions' })).json();
    expect(long.size).toBe(0);
    expect(short.size).toBe(0);
  });

  it('trailState.plhRef is a finite number — not null (regression: Infinity was serialised as null)', async () => {
    const { long, short } = (await app.inject({ method: 'GET', url: '/positions' })).json();
    expect(typeof long.trailState.plhRef).toBe('number');
    expect(typeof short.trailState.plhRef).toBe('number');
    expect(Number.isFinite(long.trailState.plhRef)).toBe(true);
    expect(Number.isFinite(short.trailState.plhRef)).toBe(true);
  });

  it('reflects slOffsetPts and slActive after engine setter calls', async () => {
    app.engine.slBuy(20);
    app.engine.slActivateBuy(true);
    const { long } = (await app.inject({ method: 'GET', url: '/positions' })).json();
    expect(long.slOffsetPts).toBe(20);
    expect(long.slActive).toBe(true);
  });

  it('reflects trailBeginPts and beActive after engine setter calls', async () => {
    app.engine.trailBeginBuy(50);
    app.engine.beActivateBuy(true);
    const { long } = (await app.inject({ method: 'GET', url: '/positions' })).json();
    expect(long.trailBeginPts).toBe(50);
    expect(long.beActive).toBe(true);
  });

  it('openTime is a parseable ISO date string', async () => {
    const { long, short } = (await app.inject({ method: 'GET', url: '/positions' })).json();
    expect(Number.isNaN(new Date(long.openTime).getTime())).toBe(false);
    expect(Number.isNaN(new Date(short.openTime).getTime())).toBe(false);
  });

  it('long position shows correct size after a fill via POST /bars', async () => {
    // BUY_LIMIT at 1.1050 — triggers when bar.low <= 1.1050
    await app.inject({ method: 'POST', url: '/orders', payload: { type: 'BUY_LIMIT', price: 1.1050 } });
    const bar = makeBar(1.1040, { low: 1.1030 }); // low 1.1030 <= 1.1050 → triggers
    await app.inject({ method: 'POST', url: '/bars', payload: { bar, bars: [bar] } });
    const { long } = (await app.inject({ method: 'GET', url: '/positions' })).json();
    expect(long.size).toBeGreaterThan(0);
  });

  it('long openPrice equals the order price after a limit fill', async () => {
    // Non-MIT orders (BUY_LIMIT, BUY_STOP…) fill at the ORDER price, not bar.close.
    // The engine calls _applyFill(slot, o.price, …) directly without touching the broker.
    await app.inject({ method: 'POST', url: '/orders', payload: { type: 'BUY_LIMIT', price: 1.1050 } });
    const bar = makeBar(1.1040, { low: 1.1030 }); // low 1.1030 <= 1.1050 → triggered
    await app.inject({ method: 'POST', url: '/bars', payload: { bar, bars: [bar] } });
    const { long } = (await app.inject({ method: 'GET', url: '/positions' })).json();
    expect(long.openPrice).toBeCloseTo(1.1050, 4); // fills AT the limit price, not bar.close
  });
});

// ─────────────────────────────────────────────────────────────
// R5 – DELETE /positions/:side
// ─────────────────────────────────────────────────────────────

describe('R5 – DELETE /positions/:side', () => {
  let app: FastifyInstance;
  beforeEach(async () => { app = await buildApp({ logger: false }); await app.ready(); });
  afterEach(() => app.close());

  it.each(['long', 'short', 'all'])('closing %s on a flat engine returns ok: true', async (side) => {
    const res = await app.inject({ method: 'DELETE', url: `/positions/${side}` });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });
  });

  it('returns 400 for an unknown side', async () => {
    const res = await app.inject({ method: 'DELETE', url: '/positions/neither' });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toHaveProperty('error');
  });

  it('closing long resets long size to 0', async () => {
    // Open a long via limit fill
    await app.inject({ method: 'POST', url: '/orders', payload: { type: 'BUY_LIMIT', price: 1.1050 } });
    const bar = makeBar(1.1040, { low: 1.1030 });
    await app.inject({ method: 'POST', url: '/bars', payload: { bar, bars: [bar] } });
    // Close it
    await app.inject({ method: 'DELETE', url: '/positions/long' });
    const { long } = (await app.inject({ method: 'GET', url: '/positions' })).json();
    expect(long.size).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────
// R6 – POST /bars
// ─────────────────────────────────────────────────────────────

describe('R6 – POST /bars', () => {
  let app: FastifyInstance;
  beforeEach(async () => { app = await buildApp({ logger: false }); await app.ready(); });
  afterEach(() => app.close());

  it('accepts a valid bar and returns ok: true', async () => {
    const res = await app.inject({ method: 'POST', url: '/bars', payload: barsPayload() });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });
  });

  it('accepts a bars array of many candles', async () => {
    const res = await app.inject({ method: 'POST', url: '/bars', payload: barsPayload(50) });
    expect(res.statusCode).toBe(200);
  });

  it('rejects a body missing the bar field', async () => {
    const res = await app.inject({
      method: 'POST', url: '/bars',
      payload: { bars: [makeBar()] },
    });
    expect(res.statusCode).toBe(400);
  });

  it('rejects a body missing the bars array', async () => {
    const res = await app.inject({
      method: 'POST', url: '/bars',
      payload: { bar: makeBar() },
    });
    expect(res.statusCode).toBe(400);
  });

  it('rejects a bar with an invalid time format', async () => {
    const badBar = { open: 1.1, high: 1.11, low: 1.09, close: 1.105, time: 'not-a-date' };
    const res = await app.inject({
      method: 'POST', url: '/bars',
      payload: { bar: badBar, bars: [badBar] },
    });
    expect(res.statusCode).toBe(400);
  });

  it('emits a bar event on the shared emitter', async () => {
    const events: unknown[] = [];
    app.emitter.on('bar', (e) => events.push(e));
    await app.inject({ method: 'POST', url: '/bars', payload: barsPayload() });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ type: 'bar' });
  });

  it('emits a fill event when a BUY_MIT order is triggered', async () => {
    // Only MIT orders call broker.marketOrder (which emits 'fill').
    // BUY_LIMIT / BUY_STOP fill at o.price via _applyFill without a broker call.
    const fills: unknown[] = [];
    app.emitter.on('fill', (e) => fills.push(e));
    // BUY_MIT triggers when bar.low <= price
    await app.inject({ method: 'POST', url: '/orders', payload: { type: 'BUY_MIT', price: 1.1050 } });
    const bar = makeBar(1.1040, { low: 1.1030 }); // low 1.1030 <= 1.1050 → triggered
    await app.inject({ method: 'POST', url: '/bars', payload: { bar, bars: [bar] } });
    expect(fills).toHaveLength(1);
    expect(fills[0]).toMatchObject({ side: 1, size: 1 }); // Side.Long = 1, default size = 1
  });

  it('triggered BUY_STOP removes the order from GET /orders', async () => {
    await app.inject({ method: 'POST', url: '/orders', payload: { type: 'BUY_STOP', price: 1.1050 } });
    const bar = makeBar(1.1060, { high: 1.1070 });
    await app.inject({ method: 'POST', url: '/bars', payload: { bar, bars: [bar] } });
    expect((await app.inject({ method: 'GET', url: '/orders' })).json()).toEqual([]);
  });

  it('emits a close event when DELETE /positions/long closes an open position', async () => {
    // Open long via BUY_MIT (MIT uses broker.marketOrder, which sets position size).
    // BUY_MIT triggers when bar.low <= price.
    await app.inject({ method: 'POST', url: '/orders', payload: { type: 'BUY_MIT', price: 1.1050 } });
    const entryBar = makeBar(1.1040, { low: 1.1030 }); // low 1.1030 <= 1.1050 → triggered
    await app.inject({ method: 'POST', url: '/bars', payload: { bar: entryBar, bars: [entryBar] } });
    // Listen for close AFTER position is confirmed open
    const closes: unknown[] = [];
    app.emitter.on('close', (e) => closes.push(e));
    await app.inject({ method: 'DELETE', url: '/positions/long' });
    expect(closes).toHaveLength(1);
    expect(closes[0]).toMatchObject({ side: 1 }); // Side.Long = 1
  });
});

// ─────────────────────────────────────────────────────────────
// R7 – PATCH /orders/:id
// ─────────────────────────────────────────────────────────────

describe('R7 – PATCH /orders/:id', () => {
  let app: FastifyInstance;
  beforeEach(async () => { app = await buildApp({ logger: false }); await app.ready(); });
  afterEach(() => app.close());

  it('moves an existing order and returns ok: true', async () => {
    const { id } = (await app.inject({ method: 'POST', url: '/orders', payload: { type: 'BUY_LIMIT', price: 1.09500 } })).json();
    const res = await app.inject({ method: 'PATCH', url: `/orders/${id}`, payload: { price: 1.09600 } });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });
  });

  it('price is updated in subsequent GET /orders', async () => {
    const { id } = (await app.inject({ method: 'POST', url: '/orders', payload: { type: 'BUY_LIMIT', price: 1.09500 } })).json();
    await app.inject({ method: 'PATCH', url: `/orders/${id}`, payload: { price: 1.09600 } });
    const [order] = (await app.inject({ method: 'GET', url: '/orders' })).json();
    expect(order.price).toBeCloseTo(1.09600, 5);
  });

  it('returns 404 for an unknown order id', async () => {
    const res = await app.inject({ method: 'PATCH', url: '/orders/nonexistent-id', payload: { price: 1.09600 } });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toHaveProperty('error');
  });

  it('rejects a body missing the price field with 400', async () => {
    const { id } = (await app.inject({ method: 'POST', url: '/orders', payload: { type: 'BUY_LIMIT', price: 1.09500 } })).json();
    const res = await app.inject({ method: 'PATCH', url: `/orders/${id}`, payload: {} });
    expect(res.statusCode).toBe(400);
  });
});

// ─────────────────────────────────────────────────────────────
// R8 – GET /account
// ─────────────────────────────────────────────────────────────

describe('R8 – GET /account', () => {
  let app: FastifyInstance;
  beforeEach(async () => { app = await buildApp({ logger: false }); await app.ready(); });
  afterEach(() => app.close());

  it('returns equity and balance from the paper broker', async () => {
    const res = await app.inject({ method: 'GET', url: '/account' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ equity: 10000, balance: 10000 });
  });
});

// ─────────────────────────────────────────────────────────────
// R9 – PUT /positions/:side/sl-tp
// ─────────────────────────────────────────────────────────────

describe('R9 – PUT /positions/:side/sl-tp', () => {
  let app: FastifyInstance;
  beforeEach(async () => { app = await buildApp({ logger: false }); await app.ready(); });
  afterEach(() => app.close());

  it('returns ok: true on a valid request', async () => {
    const res = await app.inject({
      method: 'PUT', url: '/positions/long/sl-tp',
      payload: { sl: 20, slActive: true },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });
  });

  it('updated slOffsetPts and slActive are visible in GET /positions', async () => {
    await app.inject({ method: 'PUT', url: '/positions/long/sl-tp', payload: { sl: 30, slActive: true } });
    const { long } = (await app.inject({ method: 'GET', url: '/positions' })).json();
    expect(long.slOffsetPts).toBe(30);
    expect(long.slActive).toBe(true);
  });

  it('updated trailBeginPts is visible in GET /positions', async () => {
    await app.inject({ method: 'PUT', url: '/positions/short/sl-tp', payload: { trailBeginPts: 75 } });
    const { short } = (await app.inject({ method: 'GET', url: '/positions' })).json();
    expect(short.trailBeginPts).toBe(75);
  });

  it('returns 400 for an unknown side', async () => {
    const res = await app.inject({
      method: 'PUT', url: '/positions/neither/sl-tp',
      payload: { sl: 20 },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toHaveProperty('error');
  });

  it('accepts an empty body (all fields optional)', async () => {
    const res = await app.inject({ method: 'PUT', url: '/positions/long/sl-tp', payload: {} });
    expect(res.statusCode).toBe(200);
  });
});

// ─────────────────────────────────────────────────────────────
// R10 – buildApp config
// ─────────────────────────────────────────────────────────────

describe('R10 – buildApp config', () => {
  it('boots with a custom symbol without error', async () => {
    const app = await buildApp({ logger: false }, { symbol: { pair: 'GBPUSD', digits: 5 } });
    await app.ready();
    const res = await app.inject({ method: 'GET', url: '/positions' });
    expect(res.statusCode).toBe(200);
    await app.close();
  });

  it('boots with hedging: false without error', async () => {
    const app = await buildApp({ logger: false }, { hedging: false });
    await app.ready();
    const res = await app.inject({ method: 'GET', url: '/positions' });
    expect(res.statusCode).toBe(200);
    await app.close();
  });
});
