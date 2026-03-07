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
 * R11 POST   /positions/long|short|hedge  (Unit 1)
 * R12 POST   /positions/flat variants     (Unit 2)
 * R13 DELETE /orders?side=               (Unit 2)
 * R14 POST   /orders (trailing types)    (Unit 3)
 * R15 POST   /orders/bracket             (Unit 4)
 * R16 PUT    /positions/:side/sl-tp ext  (Unit 5)
 * R17 GET /positions pl field            (Unit 6)
 * R18 PUT    /engine/config              (Unit 6)
 * R19 POST   /scaled-orders              (Unit 7)
 * R20 PUT    /atr/config + /bars         (Unit 8)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from './app.js';
import type { PaperBroker } from './broker/paper/paper-broker.js';

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
      payload: { type: 'BUY_LIMIT', price: 1.09500, attributes: { limitConfirm: 'LIMIT_CONFIRM_WICK' } },
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

// ─────────────────────────────────────────────────────────────
// R11 – POST /positions/long|short|hedge  (Unit 1)
// ─────────────────────────────────────────────────────────────

describe('R11 – POST /positions/long (market buy)', () => {
  let app: FastifyInstance;
  beforeEach(async () => { app = await buildApp({ logger: false }); await app.ready(); });
  afterEach(() => app.close());

  it('market buy opens a long position', async () => {
    // Feed a bar so broker has a price reference for the fill
    await app.inject({ method: 'POST', url: '/bars', payload: barsPayload(1, 1.1050) });
    const res = await app.inject({ method: 'POST', url: '/positions/long', payload: {} });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });
    const { long } = (await app.inject({ method: 'GET', url: '/positions' })).json();
    expect(long.size).toBeGreaterThan(0);
  });

  it('accepts an explicit size', async () => {
    await app.inject({ method: 'POST', url: '/bars', payload: barsPayload(1, 1.1050) });
    await app.inject({ method: 'POST', url: '/positions/long', payload: { size: 2 } });
    const { long } = (await app.inject({ method: 'GET', url: '/positions' })).json();
    expect(long.size).toBe(2);
  });

  it('rejects a non-number size with 400', async () => {
    const res = await app.inject({ method: 'POST', url: '/positions/long', payload: { size: 'big' } });
    expect(res.statusCode).toBe(400);
  });
});

describe('R11b – POST /positions/short (market sell)', () => {
  let app: FastifyInstance;
  beforeEach(async () => { app = await buildApp({ logger: false }); await app.ready(); });
  afterEach(() => app.close());

  it('market sell opens a short position', async () => {
    await app.inject({ method: 'POST', url: '/bars', payload: barsPayload(1, 1.1050) });
    const res = await app.inject({ method: 'POST', url: '/positions/short', payload: {} });
    expect(res.statusCode).toBe(200);
    const { short } = (await app.inject({ method: 'GET', url: '/positions' })).json();
    expect(short.size).toBeGreaterThan(0);
  });
});

describe('R11c – POST /positions/hedge', () => {
  let app: FastifyInstance;
  beforeEach(async () => { app = await buildApp({ logger: false }); await app.ready(); });
  afterEach(() => app.close());

  it('hedge opens both long and short when hedging=true', async () => {
    await app.inject({ method: 'POST', url: '/bars', payload: barsPayload(1, 1.1050) });
    // Open a long first, then hedge (which opens the opposite side)
    await app.inject({ method: 'POST', url: '/positions/long', payload: {} });
    const res = await app.inject({ method: 'POST', url: '/positions/hedge', payload: {} });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });
  });
});

// ─────────────────────────────────────────────────────────────
// R12 – POST /positions/flat variants  (Unit 2)
// ─────────────────────────────────────────────────────────────

describe('R12 – POST /positions/flat variants', () => {
  let app: FastifyInstance;
  beforeEach(async () => { app = await buildApp({ logger: false }); await app.ready(); });
  afterEach(() => app.close());

  it('POST /positions/flat returns ok: true on a flat engine', async () => {
    const res = await app.inject({ method: 'POST', url: '/positions/flat', payload: {} });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });
  });

  it('POST /positions/long/flat closes long position AND removes buy orders', async () => {
    await app.inject({ method: 'POST', url: '/bars', payload: barsPayload(1, 1.1050) });
    await app.inject({ method: 'POST', url: '/positions/long', payload: {} });
    await app.inject({ method: 'POST', url: '/orders', payload: { type: 'BUY_LIMIT', price: 1.0900 } });
    await app.inject({ method: 'POST', url: '/positions/long/flat', payload: {} });
    const { long } = (await app.inject({ method: 'GET', url: '/positions' })).json();
    expect(long.size).toBe(0);
    const orders = (await app.inject({ method: 'GET', url: '/orders' })).json();
    expect(orders.filter((o: { side: number }) => o.side === 1)).toHaveLength(0);
  });

  it('POST /positions/short/flat closes short position AND removes sell orders', async () => {
    await app.inject({ method: 'POST', url: '/bars', payload: barsPayload(1, 1.1050) });
    await app.inject({ method: 'POST', url: '/positions/short', payload: {} });
    await app.inject({ method: 'POST', url: '/orders', payload: { type: 'SELL_LIMIT', price: 1.1200 } });
    await app.inject({ method: 'POST', url: '/positions/short/flat', payload: {} });
    const { short } = (await app.inject({ method: 'GET', url: '/positions' })).json();
    expect(short.size).toBe(0);
    const orders = (await app.inject({ method: 'GET', url: '/orders' })).json();
    expect(orders.filter((o: { side: number }) => o.side === -1)).toHaveLength(0);
  });

  it('POST /positions/flat clears all orders and positions', async () => {
    await app.inject({ method: 'POST', url: '/bars', payload: barsPayload(1, 1.1050) });
    await app.inject({ method: 'POST', url: '/positions/long', payload: {} });
    await app.inject({ method: 'POST', url: '/orders', payload: { type: 'BUY_LIMIT', price: 1.0900 } });
    await app.inject({ method: 'POST', url: '/orders', payload: { type: 'SELL_LIMIT', price: 1.1200 } });
    await app.inject({ method: 'POST', url: '/positions/flat', payload: {} });
    const orders = (await app.inject({ method: 'GET', url: '/orders' })).json();
    expect(orders).toHaveLength(0);
    const { long } = (await app.inject({ method: 'GET', url: '/positions' })).json();
    expect(long.size).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────
// R13 – DELETE /orders?side=  (Unit 2)
// ─────────────────────────────────────────────────────────────

describe('R13 – DELETE /orders bulk by side', () => {
  let app: FastifyInstance;
  beforeEach(async () => { app = await buildApp({ logger: false }); await app.ready(); });
  afterEach(() => app.close());

  it('DELETE /orders?side=buy removes only buy orders', async () => {
    await app.inject({ method: 'POST', url: '/orders', payload: { type: 'BUY_LIMIT',  price: 1.09500 } });
    await app.inject({ method: 'POST', url: '/orders', payload: { type: 'SELL_LIMIT', price: 1.11000 } });
    const res = await app.inject({ method: 'DELETE', url: '/orders?side=buy' });
    expect(res.statusCode).toBe(200);
    const orders = (await app.inject({ method: 'GET', url: '/orders' })).json();
    expect(orders).toHaveLength(1);
    expect(orders[0].type).toBe('SELL_LIMIT');
  });

  it('DELETE /orders?side=sell removes only sell orders', async () => {
    await app.inject({ method: 'POST', url: '/orders', payload: { type: 'BUY_LIMIT',  price: 1.09500 } });
    await app.inject({ method: 'POST', url: '/orders', payload: { type: 'SELL_LIMIT', price: 1.11000 } });
    const res = await app.inject({ method: 'DELETE', url: '/orders?side=sell' });
    expect(res.statusCode).toBe(200);
    const orders = (await app.inject({ method: 'GET', url: '/orders' })).json();
    expect(orders).toHaveLength(1);
    expect(orders[0].type).toBe('BUY_LIMIT');
  });

  it('DELETE /orders?side=all removes all orders', async () => {
    await app.inject({ method: 'POST', url: '/orders', payload: { type: 'BUY_LIMIT',  price: 1.09500 } });
    await app.inject({ method: 'POST', url: '/orders', payload: { type: 'SELL_LIMIT', price: 1.11000 } });
    const res = await app.inject({ method: 'DELETE', url: '/orders?side=all' });
    expect(res.statusCode).toBe(200);
    expect((await app.inject({ method: 'GET', url: '/orders' })).json()).toHaveLength(0);
  });

  it('rejects an unknown side value with 400', async () => {
    const res = await app.inject({ method: 'DELETE', url: '/orders?side=both' });
    expect(res.statusCode).toBe(400);
  });
});

// ─────────────────────────────────────────────────────────────
// R14 – POST /orders with trailing entry types  (Unit 3)
// ─────────────────────────────────────────────────────────────

describe('R14 – POST /orders trailing entry types', () => {
  let app: FastifyInstance;
  beforeEach(async () => { app = await buildApp({ logger: false }); await app.ready(); });
  afterEach(() => app.close());

  it('places a BUY_LIMIT_TRAIL order and returns an id', async () => {
    const res = await app.inject({
      method: 'POST', url: '/orders',
      payload: {
        type: 'BUY_LIMIT_TRAIL',
        price: 1.1050,
        trailEntry: { mode: 1, distancePts: 20 }, // TrailMode.Dst = 1
      },
    });
    expect(res.statusCode).toBe(200);
    expect(typeof res.json().id).toBe('string');
  });

  it('trail order appears in GET /orders', async () => {
    await app.inject({
      method: 'POST', url: '/orders',
      payload: { type: 'BUY_LIMIT_TRAIL', price: 1.1050, trailEntry: { mode: 1, distancePts: 20 } },
    });
    const orders = (await app.inject({ method: 'GET', url: '/orders' })).json();
    expect(orders).toHaveLength(1);
  });

  it('places a SELL_LIMIT_TRAIL order', async () => {
    const res = await app.inject({
      method: 'POST', url: '/orders',
      payload: { type: 'SELL_LIMIT_TRAIL', price: 1.1100, trailEntry: { mode: 1, distancePts: 15 } },
    });
    expect(res.statusCode).toBe(200);
  });

  it('returns 400 when trailEntry is missing for a trail type', async () => {
    const res = await app.inject({
      method: 'POST', url: '/orders',
      payload: { type: 'BUY_LIMIT_TRAIL', price: 1.1050 },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toHaveProperty('error');
  });

  it('places BUY_STOP_TRAIL and SELL_STOP_TRAIL without error', async () => {
    const r1 = await app.inject({
      method: 'POST', url: '/orders',
      payload: { type: 'BUY_STOP_TRAIL',  price: 1.1100, trailEntry: { mode: 1, distancePts: 10 } },
    });
    const r2 = await app.inject({
      method: 'POST', url: '/orders',
      payload: { type: 'SELL_STOP_TRAIL', price: 1.1000, trailEntry: { mode: 1, distancePts: 10 } },
    });
    expect(r1.statusCode).toBe(200);
    expect(r2.statusCode).toBe(200);
  });
});

// ─────────────────────────────────────────────────────────────
// R15 – POST /orders/bracket  (Unit 4)
// ─────────────────────────────────────────────────────────────

describe('R15 – POST /orders/bracket', () => {
  let app: FastifyInstance;
  beforeEach(async () => { app = await buildApp({ logger: false }); await app.ready(); });
  afterEach(() => app.close());

  it('places a bracket order and returns an id', async () => {
    const res = await app.inject({
      method: 'POST', url: '/orders/bracket',
      payload: { entryType: 'BUY_LIMIT', entryPrice: 1.1050, slPts: 20, tpPts: 40 },
    });
    expect(res.statusCode).toBe(200);
    expect(typeof res.json().id).toBe('string');
  });

  it('bracket order appears in GET /orders', async () => {
    await app.inject({
      method: 'POST', url: '/orders/bracket',
      payload: { entryType: 'BUY_LIMIT', entryPrice: 1.1050, slPts: 20, tpPts: 40 },
    });
    const orders = (await app.inject({ method: 'GET', url: '/orders' })).json();
    expect(orders).toHaveLength(1);
    expect(orders[0].type).toBe('BUY_LIMIT');
    expect(orders[0].price).toBeCloseTo(1.1050, 4);
  });

  it('accepts an optional size', async () => {
    const res = await app.inject({
      method: 'POST', url: '/orders/bracket',
      payload: { entryType: 'SELL_STOP', entryPrice: 1.1000, slPts: 15, tpPts: 30, size: 2 },
    });
    expect(res.statusCode).toBe(200);
  });

  it('rejects a missing slPts with 400', async () => {
    const res = await app.inject({
      method: 'POST', url: '/orders/bracket',
      payload: { entryType: 'BUY_LIMIT', entryPrice: 1.1050, tpPts: 40 },
    });
    expect(res.statusCode).toBe(400);
  });

  it('bracket fill via bar opens a position with SL active', async () => {
    // BUY_LIMIT at 1.1060, slPts=500 (sl=1.1010), tpPts=1000 (tp=1.1160)
    // Bar: low=1.1050 triggers the entry (1.1050<=1.1060), but stays above sl (1.1010) and below tp (1.1160)
    const bracketRes = await app.inject({
      method: 'POST', url: '/orders/bracket',
      payload: { entryType: 'BUY_LIMIT', entryPrice: 1.1060, slPts: 500, tpPts: 1000 },
    });
    expect(bracketRes.statusCode).toBe(200);
    const bar = makeBar(1.1060, { low: 1.1050, high: 1.1070 });
    const barRes = await app.inject({ method: 'POST', url: '/bars', payload: { bar, bars: [bar] } });
    expect(barRes.statusCode).toBe(200);
    const { long } = (await app.inject({ method: 'GET', url: '/positions' })).json();
    // Position fills and stays open (SL=1.1010 not breached, TP=1.1160 not hit)
    expect(long.size).toBeGreaterThan(0);
    // _applyBracketPts sets slActive=true
    expect(long.slActive).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────
// R16 – PUT /positions/:side/sl-tp extended  (Unit 5)
// ─────────────────────────────────────────────────────────────

describe('R16 – PUT /positions/:side/sl-tp extended (absolute + trail)', () => {
  let app: FastifyInstance;
  beforeEach(async () => { app = await buildApp({ logger: false }); await app.ready(); });
  afterEach(() => app.close());

  it('slAbsolute sets the SL to an exact price on the long slot', async () => {
    const res = await app.inject({
      method: 'PUT', url: '/positions/long/sl-tp',
      payload: { slAbsolute: 1.0900 },
    });
    expect(res.statusCode).toBe(200);
    const { long } = (await app.inject({ method: 'GET', url: '/positions' })).json();
    expect(long.sl).toBeCloseTo(1.0900, 4);
  });

  it('tpAbsolute sets the TP to an exact price on the short slot', async () => {
    await app.inject({
      method: 'PUT', url: '/positions/short/sl-tp',
      payload: { tpAbsolute: 1.0800 },
    });
    const { short } = (await app.inject({ method: 'GET', url: '/positions' })).json();
    expect(short.tp).toBeCloseTo(1.0800, 4);
  });

  it('trailMode + trailDistancePts updates trailCfg visible in GET /positions', async () => {
    await app.inject({
      method: 'PUT', url: '/positions/long/sl-tp',
      payload: { trailMode: 1, trailDistancePts: 25 }, // TrailMode.Dst = 1
    });
    const { long } = (await app.inject({ method: 'GET', url: '/positions' })).json();
    expect(long.trailCfg.mode).toBe(1);
    expect(long.trailCfg.distancePts).toBe(25);
  });

  it('trailActive enables trailing on the long slot', async () => {
    await app.inject({
      method: 'PUT', url: '/positions/long/sl-tp',
      payload: { trailActive: true },
    });
    const { long } = (await app.inject({ method: 'GET', url: '/positions' })).json();
    expect(long.trailActive).toBe(true);
  });

  it('accepts only trailDistancePts (mode defaults to current value)', async () => {
    const res = await app.inject({
      method: 'PUT', url: '/positions/short/sl-tp',
      payload: { trailDistancePts: 30 },
    });
    expect(res.statusCode).toBe(200);
    const { short } = (await app.inject({ method: 'GET', url: '/positions' })).json();
    expect(short.trailCfg.distancePts).toBe(30);
  });
});

// ─────────────────────────────────────────────────────────────
// R17 – GET /positions pl field  (Unit 6)
// ─────────────────────────────────────────────────────────────

describe('R17 – GET /positions pl field', () => {
  let app: FastifyInstance;
  beforeEach(async () => { app = await buildApp({ logger: false }); await app.ready(); });
  afterEach(() => app.close());

  it('pl is 0 when flat', async () => {
    const { long, short } = (await app.inject({ method: 'GET', url: '/positions' })).json();
    expect(typeof long.pl).toBe('number');
    expect(long.pl).toBe(0);
    expect(short.pl).toBe(0);
  });

  it('pl is a number after a fill', async () => {
    // Open long via BUY_MIT fill
    await app.inject({ method: 'POST', url: '/orders', payload: { type: 'BUY_MIT', price: 1.1050 } });
    const bar = makeBar(1.1040, { low: 1.1030 });
    await app.inject({ method: 'POST', url: '/bars', payload: { bar, bars: [bar] } });
    const { long } = (await app.inject({ method: 'GET', url: '/positions' })).json();
    expect(long.size).toBeGreaterThan(0);
    expect(typeof long.pl).toBe('number');
  });
});

// ─────────────────────────────────────────────────────────────
// R18 – PUT /engine/config  (Unit 6)
// ─────────────────────────────────────────────────────────────

describe('R18 – PUT /engine/config', () => {
  let app: FastifyInstance;
  beforeEach(async () => { app = await buildApp({ logger: false }); await app.ready(); });
  afterEach(() => app.close());

  it('returns ok: true', async () => {
    const res = await app.inject({
      method: 'PUT', url: '/engine/config',
      payload: { removeOrdersOnFlat: true },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });
  });

  it('accepts an empty body (all fields optional)', async () => {
    const res = await app.inject({ method: 'PUT', url: '/engine/config', payload: {} });
    expect(res.statusCode).toBe(200);
  });

  it('rejects a non-boolean removeOrdersOnFlat', async () => {
    const res = await app.inject({
      method: 'PUT', url: '/engine/config',
      payload: { removeOrdersOnFlat: 'yes' },
    });
    expect(res.statusCode).toBe(400);
  });
});

// ─────────────────────────────────────────────────────────────
// R19 – POST /scaled-orders  (Unit 7)
// ─────────────────────────────────────────────────────────────

describe('R19 – POST /scaled-orders', () => {
  let app: FastifyInstance;
  beforeEach(async () => { app = await buildApp({ logger: false }); await app.ready(); });
  afterEach(() => app.close());

  it('Scalper_I long places multiple orders', async () => {
    // Scalper_I: atrMode=None, distance=2, countLimits=4, countStops=1 → 6 orders (1 MIT + 4 limits + 1 stop)
    const res = await app.inject({
      method: 'POST', url: '/scaled-orders',
      payload: { side: 'long', preset: 'Scalper_I', currentPrice: 1.1050 },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(Array.isArray(body.orderIds)).toBe(true);
    expect(body.orderIds.length).toBeGreaterThan(1);
    expect(typeof body.baseDist).toBe('number');
    expect(typeof body.slDist).toBe('number');
  });

  it('Scalper_I short places orders on the sell side', async () => {
    const res = await app.inject({
      method: 'POST', url: '/scaled-orders',
      payload: { side: 'short', preset: 'Scalper_I', currentPrice: 1.1050 },
    });
    expect(res.statusCode).toBe(200);
    const orders = (await app.inject({ method: 'GET', url: '/orders' })).json();
    expect(orders.some((o: { side: number }) => o.side === -1)).toBe(true);
  });

  it('placeBoth returns long and short sub-results', async () => {
    const res = await app.inject({
      method: 'POST', url: '/scaled-orders',
      payload: { side: 'both', preset: 'Scalper_I', currentPrice: 1.1050 },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty('long');
    expect(body).toHaveProperty('short');
    expect(Array.isArray(body.long.orderIds)).toBe(true);
  });

  it('returns 400 for an unknown preset', async () => {
    const res = await app.inject({
      method: 'POST', url: '/scaled-orders',
      payload: { side: 'long', preset: 'NonExistentPreset', currentPrice: 1.1050 },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toHaveProperty('error');
  });
});

// ─────────────────────────────────────────────────────────────
// R20 – PUT /atr/config + /bars AtrModule hook  (Unit 8)
// ─────────────────────────────────────────────────────────────

describe('R20 – PUT /atr/config', () => {
  let app: FastifyInstance;
  beforeEach(async () => { app = await buildApp({ logger: false }); await app.ready(); });
  afterEach(() => app.close());

  it('returns ok: true', async () => {
    const res = await app.inject({
      method: 'PUT', url: '/atr/config',
      payload: { slMultiplier: 2 },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });
  });

  it('accepts an empty body', async () => {
    const res = await app.inject({ method: 'PUT', url: '/atr/config', payload: {} });
    expect(res.statusCode).toBe(200);
  });

  it('rejects a negative slMultiplier with 400', async () => {
    const res = await app.inject({
      method: 'PUT', url: '/atr/config',
      payload: { slMultiplier: -1 },
    });
    expect(res.statusCode).toBe(400);
  });

  it('atrModule.onBar is called during POST /bars without error', async () => {
    // Configure slMultiplier so AtrModule will try to update SL on next bar
    await app.inject({
      method: 'PUT', url: '/atr/config',
      payload: { slMultiplier: 1.5, period: 3, shift: 0, onlyWhenFlat: true },
    });
    // Feed enough bars for ATR to be calculable (period=3 needs at least 3 bars)
    const res = await app.inject({
      method: 'POST', url: '/bars',
      payload: barsPayload(3, 1.1050),
    });
    expect(res.statusCode).toBe(200);
  });

  it('updates the mutable config object so subsequent bars use new values', async () => {
    await app.inject({ method: 'PUT', url: '/atr/config', payload: { period: 5 } });
    expect(app.atrConfig.period).toBe(5);
  });
});

// ─────────────────────────────────────────────────────────────
// R21 – POST /v1/backtest
// ─────────────────────────────────────────────────────────────

describe('R21 – POST /v1/backtest', () => {
  let app: FastifyInstance;
  beforeEach(async () => { app = await buildApp({ logger: false }); await app.ready(); });
  afterEach(() => app.close());

  it('returns signalCount equal to bars length', async () => {
    const bars = Array.from({ length: 30 }, (_, i) => makeBar(1.1000 + i * 0.0001));
    const res = await app.inject({
      method: 'POST', url: '/v1/backtest',
      payload: { bars, strategy: 'CandleAtr' },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.signalCount).toBe(bars.length);
    expect(body.buyCount + body.sellCount + body.holdCount).toBe(bars.length);
  });

  it('accepts VolumeBreakout strategy', async () => {
    const bars = Array.from({ length: 20 }, (_, i) => makeBar(1.1000 + i * 0.0001));
    const res = await app.inject({
      method: 'POST', url: '/v1/backtest',
      payload: { bars, strategy: 'VolumeBreakout' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveProperty('signalCount');
  });

  it('returns 400 for empty bars array', async () => {
    const res = await app.inject({
      method: 'POST', url: '/v1/backtest',
      payload: { bars: [] },
    });
    expect(res.statusCode).toBe(400);
  });
});

// ─────────────────────────────────────────────────────────────
// R22 – POST /v1/signal
// ─────────────────────────────────────────────────────────────

describe('R22 – POST /v1/signal', () => {
  let app: FastifyInstance;
  beforeEach(async () => { app = await buildApp({ logger: false }); await app.ready(); });
  afterEach(() => app.close());

  it('returns result BUY, SELL, or HOLD', async () => {
    const bars = Array.from({ length: 20 }, (_, i) => makeBar(1.1000 + i * 0.0001));
    const res = await app.inject({
      method: 'POST', url: '/v1/signal',
      payload: { bars, strategy: 'CandleAtr' },
    });
    expect(res.statusCode).toBe(200);
    const { result } = res.json();
    expect(['BUY', 'SELL', 'HOLD']).toContain(result);
  });

  it('returns 400 for empty bars array', async () => {
    const res = await app.inject({
      method: 'POST', url: '/v1/signal',
      payload: { bars: [] },
    });
    expect(res.statusCode).toBe(400);
  });
});

// ─────────────────────────────────────────────────────────────
// R23 – GET / DELETE / PATCH /v1/positions
// ─────────────────────────────────────────────────────────────

type SeedPosition = Parameters<PaperBroker['seedPosition']>[0];

function makeSeedPosition(ticket: number): SeedPosition {
  return {
    ticket, userId: 'default', symbol: 'EURUSD', type: 'BUY',
    magic: 0, identifier: 0,
    time: new Date().toISOString(),
    priceOpen: 1.1000, priceCurrent: 1.1010,
    stopLoss: 0, takeProfit: 0, priceStopLimit: 0,
    volume: 0.1, commission: 0, swap: 0, profit: 0,
    comment: '', externalId: '', reason: 0,
  } as SeedPosition;
}

describe('R23 – GET /v1/positions', () => {
  let app: FastifyInstance;
  beforeEach(async () => { app = await buildApp({ logger: false }); await app.ready(); });
  afterEach(() => app.close());

  it('returns empty array with no seeded positions', async () => {
    const res = await app.inject({ method: 'GET', url: '/v1/positions' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([]);
  });

  it('returns seeded positions', async () => {
    (app.broker as PaperBroker).seedPosition(makeSeedPosition(1001));
    const res = await app.inject({ method: 'GET', url: '/v1/positions' });
    expect(res.statusCode).toBe(200);
    const positions = res.json();
    expect(positions).toHaveLength(1);
    expect(positions[0].ticket).toBe(1001);
  });
});

describe('R23 – DELETE /v1/positions/:ticket', () => {
  let app: FastifyInstance;
  beforeEach(async () => { app = await buildApp({ logger: false }); await app.ready(); });
  afterEach(() => app.close());

  it('returns 204 for an existing position', async () => {
    (app.broker as PaperBroker).seedPosition(makeSeedPosition(2001));
    const res = await app.inject({ method: 'DELETE', url: '/v1/positions/2001' });
    expect(res.statusCode).toBe(204);
  });

  it('returns 404 for a non-existent ticket', async () => {
    const res = await app.inject({ method: 'DELETE', url: '/v1/positions/9999' });
    expect(res.statusCode).toBe(404);
  });
});

describe('R23 – PATCH /v1/positions/:ticket', () => {
  let app: FastifyInstance;
  beforeEach(async () => { app = await buildApp({ logger: false }); await app.ready(); });
  afterEach(() => app.close());

  it('returns 204 when modifying an existing position', async () => {
    (app.broker as PaperBroker).seedPosition(makeSeedPosition(3001));
    const res = await app.inject({
      method: 'PATCH', url: '/v1/positions/3001',
      payload: { stopLoss: 1.0950, takeProfit: 1.1100 },
    });
    expect(res.statusCode).toBe(204);
  });

  it('returns 404 for a non-existent ticket', async () => {
    const res = await app.inject({
      method: 'PATCH', url: '/v1/positions/9999',
      payload: { stopLoss: 1.0950, takeProfit: 1.1100 },
    });
    expect(res.statusCode).toBe(404);
  });

  it('returns 400 for a non-numeric ticket', async () => {
    const res = await app.inject({
      method: 'PATCH', url: '/v1/positions/abc',
      payload: { stopLoss: 1.0950, takeProfit: 1.1100 },
    });
    expect(res.statusCode).toBe(400);
  });

  it('returns 400 for an empty body (missing SL/TP)', async () => {
    (app.broker as PaperBroker).seedPosition(makeSeedPosition(3002));
    const res = await app.inject({
      method: 'PATCH', url: '/v1/positions/3002',
      payload: {},
    });
    expect(res.statusCode).toBe(400);
  });
});

describe('R23 – DELETE /v1/positions/:ticket — non-numeric', () => {
  let app: FastifyInstance;
  beforeEach(async () => { app = await buildApp({ logger: false }); await app.ready(); });
  afterEach(() => app.close());

  it('returns 400 for a non-numeric ticket', async () => {
    const res = await app.inject({ method: 'DELETE', url: '/v1/positions/abc' });
    expect(res.statusCode).toBe(400);
  });
});

// ─────────────────────────────────────────────────────────────
// R24 – POST /v1/money-management
// ─────────────────────────────────────────────────────────────

describe('R24 – POST /v1/money-management', () => {
  let app: FastifyInstance;
  beforeEach(async () => { app = await buildApp({ logger: false }); await app.ready(); });
  afterEach(() => app.close());

  it('returns { valid: true } for a valid config', async () => {
    const res = await app.inject({
      method: 'POST', url: '/v1/money-management',
      payload: {
        userId: 'user1', symbol: 'EURUSD', timeframe: 'H1', direction: 'BUY',
        stopLossType: 'DO_NOT_USE', stopLossValue: 0,
        takeProfitType: 'DO_NOT_USE', takeProfitValue: 0,
        lotsType: 'FIXED', lotsValue: 0.1,
      },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ valid: true });
  });

  it('returns 400 for an invalid config (missing required fields)', async () => {
    const res = await app.inject({
      method: 'POST', url: '/v1/money-management',
      payload: { symbol: 'EURUSD' },
    });
    expect(res.statusCode).toBe(400);
  });
});

// ─────────────────────────────────────────────────────────────
// R25 – OpenBB Workspace integration endpoints
// ─────────────────────────────────────────────────────────────

describe('R25 – GET /widgets.json', () => {
  let app: FastifyInstance;
  beforeEach(async () => { app = await buildApp({ logger: false }); await app.ready(); });
  afterEach(() => app.close());

  it('returns all 8 widget keys', async () => {
    const res = await app.inject({ method: 'GET', url: '/widgets.json' });
    expect(res.statusCode).toBe(200);
    expect(Object.keys(res.json()).sort()).toEqual([
      'account_balance', 'account_equity', 'deal_history',
      'engine_config', 'engine_positions', 'order_history', 'pending_orders', 'symbol_info',
    ]);
  });

  it('each widget has endpoint and type fields', async () => {
    const res = await app.inject({ method: 'GET', url: '/widgets.json' });
    for (const widget of Object.values(res.json()) as Record<string, unknown>[]) {
      expect(widget).toHaveProperty('endpoint');
      expect(widget).toHaveProperty('type');
    }
  });
});

describe('R25 – GET /apps.json', () => {
  let app: FastifyInstance;
  beforeEach(async () => { app = await buildApp({ logger: false }); await app.ready(); });
  afterEach(() => app.close());

  it('returns trading_dashboard with Overview and History tabs', async () => {
    const res = await app.inject({ method: 'GET', url: '/apps.json' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty('trading_dashboard');
    expect(Object.keys(body.trading_dashboard.tabs).sort()).toEqual(['History', 'Overview']);
  });
});

describe('R25 – GET /openbb/positions', () => {
  let app: FastifyInstance;
  beforeEach(async () => { app = await buildApp({ logger: false }); await app.ready(); });
  afterEach(() => app.close());

  it('returns LONG and SHORT rows when flat', async () => {
    const res = await app.inject({ method: 'GET', url: '/openbb/positions' });
    expect(res.statusCode).toBe(200);
    const [long, short] = res.json();
    expect(long.side).toBe('LONG');
    expect(long.status).toBe('FLAT');
    expect(short.side).toBe('SHORT');
    expect(short.status).toBe('FLAT');
  });

  it('returns null for openPrice/sl/tp when flat', async () => {
    const res = await app.inject({ method: 'GET', url: '/openbb/positions' });
    const [long] = res.json();
    expect(long.openPrice).toBeNull();
    expect(long.sl).toBeNull();
    expect(long.tp).toBeNull();
  });

  it('returns numeric openPrice when open', async () => {
    await app.inject({ method: 'POST', url: '/bars', payload: barsPayload(1, 1.1050) });
    await app.inject({ method: 'POST', url: '/positions/long', payload: { size: 0.1 } });
    const res = await app.inject({ method: 'GET', url: '/openbb/positions' });
    const [long] = res.json();
    expect(long.status).toBe('OPEN');
    expect(long.openPrice).toBeTypeOf('number');
  });
});

describe('R25 – GET /openbb/positions SSRM', () => {
  let app: FastifyInstance;
  beforeEach(async () => { app = await buildApp({ logger: false }); await app.ready(); });
  afterEach(() => app.close());

  it('returns SSRM envelope when startRow/endRow are provided', async () => {
    const res = await app.inject({ method: 'GET', url: '/openbb/positions?startRow=0&endRow=1' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty('rows');
    expect(body).toHaveProperty('lastRow');
    expect(body.rows).toHaveLength(1);
    expect(body.lastRow).toBe(2);
  });

  it('returns plain array when no SSRM params', async () => {
    const res = await app.inject({ method: 'GET', url: '/openbb/positions' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(Array.isArray(body)).toBe(true);
  });
});

describe('R25 – GET /openbb/orders', () => {
  let app: FastifyInstance;
  beforeEach(async () => { app = await buildApp({ logger: false }); await app.ready(); });
  afterEach(() => app.close());

  it('returns empty array with no pending orders', async () => {
    const res = await app.inject({ method: 'GET', url: '/openbb/orders' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([]);
  });
});

describe('R25 – GET /openbb/account/equity', () => {
  let app: FastifyInstance;
  beforeEach(async () => { app = await buildApp({ logger: false }); await app.ready(); });
  afterEach(() => app.close());

  it('returns value, label, delta', async () => {
    const res = await app.inject({ method: 'GET', url: '/openbb/account/equity' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ label: 'Equity', value: expect.any(Number), delta: expect.any(Number) });
  });
});

describe('R25 – GET /openbb/account/balance', () => {
  let app: FastifyInstance;
  beforeEach(async () => { app = await buildApp({ logger: false }); await app.ready(); });
  afterEach(() => app.close());

  it('returns value, label, delta=0', async () => {
    const res = await app.inject({ method: 'GET', url: '/openbb/account/balance' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ label: 'Balance', value: expect.any(Number), delta: 0 });
  });
});

describe('R25 – GET /openbb/deals', () => {
  let app: FastifyInstance;
  beforeEach(async () => { app = await buildApp({ logger: false }); await app.ready(); });
  afterEach(() => app.close());

  it('returns empty array on fresh paper broker', async () => {
    const res = await app.inject({ method: 'GET', url: '/openbb/deals' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([]);
  });

  it('accepts optional from/to query params', async () => {
    const res = await app.inject({ method: 'GET', url: '/openbb/deals?from=2024-01-01&to=2024-12-31' });
    expect(res.statusCode).toBe(200);
  });
});

describe('R25 – GET /openbb/symbol', () => {
  let app: FastifyInstance;
  beforeEach(async () => { app = await buildApp({ logger: false }); await app.ready(); });
  afterEach(() => app.close());

  it('returns 400 when symbol param is missing', async () => {
    const res = await app.inject({ method: 'GET', url: '/openbb/symbol' });
    expect(res.statusCode).toBe(400);
  });

  it('returns 404 for unknown symbol', async () => {
    const res = await app.inject({ method: 'GET', url: '/openbb/symbol?symbol=UNKNOWN' });
    expect(res.statusCode).toBe(404);
  });
});

describe('R25 – GET /openbb/engine-config', () => {
  let app: FastifyInstance;
  beforeEach(async () => { app = await buildApp({ logger: false }); await app.ready(); });
  afterEach(() => app.close());

  it('returns omni content array with text and table blocks', async () => {
    const res = await app.inject({ method: 'GET', url: '/openbb/engine-config' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body[0]).toMatchObject({ type: 'text' });
    expect(body[0].content).toContain('ATR Configuration');
    expect(body[1]).toMatchObject({ type: 'table' });
    expect(Array.isArray(body[1].content)).toBe(true);
    expect(body[1].content[0]).toHaveProperty('key');
    expect(body[1].content[0]).toHaveProperty('value');
  });
});

describe('R25 – OPENBB_API_KEY auth guard', () => {
  const ORIGINAL_KEY = process.env.OPENBB_API_KEY;
  let app: FastifyInstance;

  beforeEach(async () => {
    process.env.OPENBB_API_KEY = 'test-secret';
    app = await buildApp({ logger: false });
    await app.ready();
  });
  afterEach(async () => {
    if (ORIGINAL_KEY !== undefined) process.env.OPENBB_API_KEY = ORIGINAL_KEY;
    else delete process.env.OPENBB_API_KEY;
    await app.close();
  });

  it('returns 401 with no apiKey', async () => {
    const res = await app.inject({ method: 'GET', url: '/openbb/positions' });
    expect(res.statusCode).toBe(401);
    expect(res.json()).toEqual({ error: 'Unauthorized' });
  });

  it('returns 401 with wrong apiKey', async () => {
    const res = await app.inject({ method: 'GET', url: '/openbb/positions?apiKey=wrong' });
    expect(res.statusCode).toBe(401);
  });

  it('returns 200 with correct apiKey', async () => {
    const res = await app.inject({ method: 'GET', url: '/openbb/positions?apiKey=test-secret' });
    expect(res.statusCode).toBe(200);
  });

  it('does NOT affect existing /positions route', async () => {
    const res = await app.inject({ method: 'GET', url: '/positions' });
    expect(res.statusCode).toBe(200);
  });
});

// ─────────────────────────────────────────────────────────────
// R26 — Skills routes
// ─────────────────────────────────────────────────────────────

describe('R26 – /skills routes disabled without auth', () => {
  let app: FastifyInstance;
  const savedOAuth = process.env.CLAUDE_CODE_OAUTH_TOKEN;
  const savedApiKey = process.env.ANTHROPIC_API_KEY;

  beforeEach(async () => {
    delete process.env.CLAUDE_CODE_OAUTH_TOKEN;
    delete process.env.ANTHROPIC_API_KEY;
    app = await buildApp({ logger: false });
    await app.ready();
  });
  afterEach(async () => {
    process.env.CLAUDE_CODE_OAUTH_TOKEN = savedOAuth;
    process.env.ANTHROPIC_API_KEY = savedApiKey;
    await app.close();
  });

  it('GET /skills returns 404 when no Claude auth configured', async () => {
    const res = await app.inject({ method: 'GET', url: '/skills' });
    expect(res.statusCode).toBe(404);
  });

  it('POST /skills/data/analyze returns 404 when no Claude auth configured', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/skills/data/analyze',
      payload: { prompt: 'test' },
    });
    expect(res.statusCode).toBe(404);
  });
});

describe('R26 – /skills routes enabled with auth', () => {
  let app: FastifyInstance;
  const savedOAuth = process.env.CLAUDE_CODE_OAUTH_TOKEN;
  const savedApiKey = process.env.ANTHROPIC_API_KEY;
  const savedKey = process.env.API_KEY;

  beforeEach(async () => {
    process.env.CLAUDE_CODE_OAUTH_TOKEN = 'test-token';
    delete process.env.API_KEY; // disable x-api-key guard for catalog tests
    app = await buildApp({ logger: false });
    await app.ready();
  });
  afterEach(async () => {
    process.env.CLAUDE_CODE_OAUTH_TOKEN = savedOAuth;
    process.env.ANTHROPIC_API_KEY = savedApiKey;
    process.env.API_KEY = savedKey;
    await app.close();
  });

  it('GET /skills returns catalog array', async () => {
    const res = await app.inject({ method: 'GET', url: '/skills' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThan(0);
    expect(body[0]).toMatchObject({
      path: expect.stringContaining('/skills/'),
      command: expect.any(String),
      category: expect.any(String),
      description: expect.any(String),
    });
  });

  it('GET /skills returns 401 when API_KEY is set and no x-api-key header', async () => {
    process.env.API_KEY = 'secret';
    const guarded = await buildApp({ logger: false });
    await guarded.ready();
    const res = await guarded.inject({ method: 'GET', url: '/skills' });
    expect(res.statusCode).toBe(401);
    await guarded.close();
  });

  it('POST /skills/data/analyze rejects invalid body', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/skills/data/analyze',
      payload: { sessionId: 'not-a-uuid' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('POST /skills/data/analyze accepts valid body with prompt only', async () => {
    // We can't test the full SSE flow without a real Claude auth token,
    // but we verify the route exists and accepts a valid body schema.
    const res = await app.inject({
      method: 'POST',
      url: '/skills/data/analyze',
      payload: { prompt: 'test' },
    });
    // Route exists (not 404) and body validates (not 400)
    expect(res.statusCode).not.toBe(404);
    expect(res.statusCode).not.toBe(400);
  });

  it('POST /skills/nonexistent returns 404', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/skills/nonexistent/route',
      payload: { prompt: 'test' },
    });
    expect(res.statusCode).toBe(404);
  });

  it('each catalog entry has unique path and valid structure', async () => {
    const res = await app.inject({ method: 'GET', url: '/skills' });
    const skills = res.json() as { path: string; command: string; category: string }[];
    const paths = skills.map((s) => s.path);
    expect(new Set(paths).size).toBe(paths.length); // no duplicates
    for (const skill of skills) {
      expect(skill.command).toBeTruthy();
      expect(skill.category).toBeTruthy();
    }
  });
});

// ─────────────────────────────────────────────────────────────
// R27 – Cache-Control headers
// ─────────────────────────────────────────────────────────────

describe('R27 – Cache-Control headers', () => {
  let app: FastifyInstance;
  const savedOBBKey = process.env.OPENBB_API_KEY;
  beforeEach(async () => {
    delete process.env.OPENBB_API_KEY; // ensure no auth guard
    app = await buildApp({ logger: false });
    await app.ready();
  });
  afterEach(async () => {
    if (savedOBBKey !== undefined) process.env.OPENBB_API_KEY = savedOBBKey;
    else delete process.env.OPENBB_API_KEY;
    await app.close();
  });

  it('/widgets.json has Cache-Control: public, max-age=3600 and ETag', async () => {
    const res = await app.inject({ method: 'GET', url: '/widgets.json' });
    expect(res.headers['cache-control']).toBe('public, max-age=3600');
    expect(res.headers.etag).toBeDefined();
  });

  it('/widgets.json returns 304 for matching If-None-Match', async () => {
    const first = await app.inject({ method: 'GET', url: '/widgets.json' });
    const etag = first.headers.etag as string;
    const second = await app.inject({
      method: 'GET', url: '/widgets.json',
      headers: { 'if-none-match': etag },
    });
    expect(second.statusCode).toBe(304);
  });

  it('/apps.json has Cache-Control: public, max-age=3600 and ETag', async () => {
    const res = await app.inject({ method: 'GET', url: '/apps.json' });
    expect(res.headers['cache-control']).toBe('public, max-age=3600');
    expect(res.headers.etag).toBeDefined();
  });

  it('/openbb/positions has Cache-Control: no-store', async () => {
    const res = await app.inject({ method: 'GET', url: '/openbb/positions' });
    expect(res.headers['cache-control']).toBe('no-store');
  });

  it('/openbb/orders has Cache-Control: no-store', async () => {
    const res = await app.inject({ method: 'GET', url: '/openbb/orders' });
    expect(res.headers['cache-control']).toBe('no-store');
  });

  it('/openbb/account/equity has Cache-Control: no-store', async () => {
    const res = await app.inject({ method: 'GET', url: '/openbb/account/equity' });
    expect(res.headers['cache-control']).toBe('no-store');
  });

  it('/openbb/account/balance has Cache-Control: no-store', async () => {
    const res = await app.inject({ method: 'GET', url: '/openbb/account/balance' });
    expect(res.headers['cache-control']).toBe('no-store');
  });

  it('/openbb/deals has Cache-Control: private, max-age=10', async () => {
    const res = await app.inject({ method: 'GET', url: '/openbb/deals' });
    expect(res.headers['cache-control']).toBe('private, max-age=10');
  });

  it('/openbb/symbol has Cache-Control: public, max-age=60', async () => {
    const res = await app.inject({ method: 'GET', url: '/openbb/symbol?symbol=EURUSD' });
    expect(res.headers['cache-control']).toBe('public, max-age=60');
  });

  it('/openapi.yaml has Cache-Control: no-cache', async () => {
    const res = await app.inject({ method: 'GET', url: '/openapi.yaml' });
    expect(res.headers['cache-control']).toBe('no-cache');
  });

  it('/docs has Cache-Control: no-cache', async () => {
    const res = await app.inject({ method: 'GET', url: '/docs' });
    expect(res.headers['cache-control']).toBe('no-cache');
  });
});

// ─────────────────────────────────────────────────────────────
// R28 – API_KEY auth guard consistency
// ─────────────────────────────────────────────────────────────

describe('R28 – all mutating routes reject requests when API_KEY is set', () => {
  let app: FastifyInstance;
  const savedKey = process.env.API_KEY;

  beforeEach(async () => {
    process.env.API_KEY = 'test-secret-key';
    app = await buildApp({ logger: false });
  });
  afterEach(async () => {
    if (savedKey !== undefined) process.env.API_KEY = savedKey;
    else delete process.env.API_KEY;
    await app.close();
  });

  const mutatingRoutes = [
    { method: 'POST'   as const, url: '/positions/long',    body: { size: 1 } },
    { method: 'POST'   as const, url: '/positions/short',   body: { size: 1 } },
    { method: 'POST'   as const, url: '/positions/hedge' },
    { method: 'POST'   as const, url: '/positions/long/flat' },
    { method: 'POST'   as const, url: '/positions/short/flat' },
    { method: 'POST'   as const, url: '/positions/flat' },
    { method: 'DELETE' as const, url: '/positions/long' },
    { method: 'PUT'    as const, url: '/positions/long/sl-tp', body: { sl: 10 } },
    { method: 'POST'   as const, url: '/orders',            body: { type: 'BUY_LIMIT', price: 1.1, size: 1 } },
    { method: 'POST'   as const, url: '/orders/bracket',    body: { entryType: 'BUY_LIMIT', entryPrice: 1.1, slPts: 10, tpPts: 20 } },
    { method: 'PATCH'  as const, url: '/orders/fake-id',    body: { price: 1.2 } },
    { method: 'DELETE' as const, url: '/orders?side=all' },
    { method: 'DELETE' as const, url: '/orders/fake-id' },
    { method: 'POST'   as const, url: '/bars',              body: { bar: makeBar(), bars: [makeBar()] } },
    { method: 'PUT'    as const, url: '/engine/config',     body: { removeOrdersOnFlat: true } },
    { method: 'PUT'    as const, url: '/atr/config',        body: { slMultiplier: 2 } },
    { method: 'POST'   as const, url: '/scaled-orders',     body: { side: 'long', preset: 'Scalper_I', currentPrice: 1.1 } },
  ];

  for (const { method, url, body } of mutatingRoutes) {
    it(`${method} ${url} returns 401 without x-api-key`, async () => {
      const res = await app.inject({
        method,
        url,
        ...(body ? { payload: body } : {}),
      });
      expect(res.statusCode).toBe(401);
    });
  }

  it('GET /positions (read-only) is allowed without x-api-key', async () => {
    const res = await app.inject({ method: 'GET', url: '/positions' });
    expect(res.statusCode).toBe(200);
  });

  it('GET /orders (read-only) is allowed without x-api-key', async () => {
    const res = await app.inject({ method: 'GET', url: '/orders' });
    expect(res.statusCode).toBe(200);
  });

  it('GET /account (read-only) is allowed without x-api-key', async () => {
    const res = await app.inject({ method: 'GET', url: '/account' });
    expect(res.statusCode).toBe(200);
  });
});

// ─────────────────────────────────────────────────────────────
// R29 – UDF response schemas
// ─────────────────────────────────────────────────────────────

describe('R29 – UDF routes return well-shaped responses', () => {
  let app: FastifyInstance;
  beforeEach(async () => { app = await buildApp({ logger: false }); });
  afterEach(async () => { await app.close(); });

  it('GET /udf/config returns supported_resolutions and flags', async () => {
    const res = await app.inject({ method: 'GET', url: '/udf/config' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.supports_search).toBe(true);
    expect(body.supports_time).toBe(true);
    expect(Array.isArray(body.supported_resolutions)).toBe(true);
    expect(body.supported_resolutions).toContain('1D');
  });

  it('GET /udf/time returns a Unix timestamp string', async () => {
    const res = await app.inject({ method: 'GET', url: '/udf/time' });
    expect(res.statusCode).toBe(200);
    const ts = Number(res.payload);
    expect(ts).toBeGreaterThan(1_000_000_000);
  });

  it('GET /udf/symbols returns symbol metadata', async () => {
    const res = await app.inject({ method: 'GET', url: '/udf/symbols?symbol=EURUSD' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.name).toBe('EURUSD');
    expect(body.type).toBe('forex');
    expect(body.pricescale).toBe(100000);
  });

  it('GET /udf/history returns no_data for empty broker', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/udf/history?symbol=EURUSD&from=0&to=9999999999&resolution=1D',
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.s).toBe('no_data');
  });

  it('GET /udf/history rejects unsupported resolution', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/udf/history?symbol=EURUSD&from=0&to=9999999999&resolution=3M',
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.s).toBe('error');
    expect(body.errmsg).toContain('Unsupported resolution');
  });
});

// ─────────────────────────────────────────────────────────────
// R30 – WebSocket /stream
// ─────────────────────────────────────────────────────────────

describe('R30 – WebSocket /stream', () => {
  let app: FastifyInstance;
  let port: number;

  beforeEach(async () => {
    app = await buildApp({ logger: false });
    await app.listen({ port: 0 });
    const addr = app.server.address();
    port = typeof addr === 'object' && addr ? addr.port : 0;
  });
  afterEach(async () => { await app.close(); });

  /** Connect a WS client and collect messages. Listener is set before open to avoid race. */
  async function connectWS(path = '/stream'): Promise<{ ws: import('ws').WebSocket; msgs: string[] }> {
    const { default: WS } = await import('ws');
    const msgs: string[] = [];
    const ws = new WS(`ws://127.0.0.1:${port}${path}`);
    ws.on('message', (data: Buffer) => msgs.push(data.toString()));
    await new Promise<void>((resolve, reject) => {
      ws.on('open', () => resolve());
      ws.on('error', reject);
    });
    return { ws, msgs };
  }

  it('v2 client receives connected message with protocol version', async () => {
    const { ws, msgs } = await connectWS();
    await new Promise(r => setTimeout(r, 100));
    expect(msgs.length).toBeGreaterThanOrEqual(1);
    const connected = JSON.parse(msgs[0]);
    expect(connected.type).toBe('connected');
    expect(connected.protocol).toBe(2);
    ws.close();
  });

  it('v2 client receives bar events as envelopes', async () => {
    const { ws, msgs } = await connectWS();
    await new Promise(r => setTimeout(r, 50)); // wait for connected msg

    await app.inject({ method: 'POST', url: '/bars', payload: barsPayload() });
    await new Promise(r => setTimeout(r, 200)); // wait for flush interval

    expect(msgs.length).toBeGreaterThanOrEqual(2);
    const barEvent = JSON.parse(msgs[1]);
    expect(barEvent.type).toBe('bar');
    expect(barEvent.id).toBeGreaterThan(0);
    expect(barEvent.payload).toBeDefined();
    ws.close();
  });

  it('v1 client does not receive connected message', async () => {
    const { ws, msgs } = await connectWS('/stream?v=1');
    await new Promise(r => setTimeout(r, 100));
    const hasConnected = msgs.some(m => {
      try { return JSON.parse(m).type === 'connected'; } catch { return false; }
    });
    expect(hasConnected).toBe(false);
    ws.close();
  });

  it('reconnection replays missed events via lastEventId', async () => {
    // Connect client to register route-level listeners
    const { ws: ws1 } = await connectWS();
    await new Promise(r => setTimeout(r, 50));

    // Emit bars to populate replay buffer
    await app.inject({ method: 'POST', url: '/bars', payload: barsPayload() });
    await app.inject({ method: 'POST', url: '/bars', payload: barsPayload() });
    await app.inject({ method: 'POST', url: '/bars', payload: barsPayload() });
    ws1.close();
    await new Promise(r => setTimeout(r, 100));

    // Reconnect with lastEventId=1
    const { ws: ws2, msgs } = await connectWS('/stream?lastEventId=1');
    await new Promise(r => setTimeout(r, 200));

    // Should have connected + replayed bar events (order may vary due to flush timing)
    expect(msgs.length).toBeGreaterThanOrEqual(1);
    const parsed = msgs.map(m => JSON.parse(m));
    expect(parsed.some((e: { type: string }) => e.type === 'connected')).toBe(true);

    const replayed = parsed.filter((e: { type: string }) => e.type === 'bar');
    for (const evt of replayed) {
      expect(evt.id).toBeGreaterThan(1);
    }
    ws2.close();
  });
});

describe('TickIngestionService wiring', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    const { buildApp } = await import('./app.js');
    app = await buildApp({ logger: false });
  });
  afterEach(() => app.close());

  it('includes tick-ingestion in /services list', async () => {
    const res = await app.inject({ method: 'GET', url: '/services' });
    expect(res.statusCode).toBe(200);
    const body = res.json<{ id: string }[]>();
    expect(body.some(s => s.id === 'ingestion:tick')).toBe(true);
  });
});
