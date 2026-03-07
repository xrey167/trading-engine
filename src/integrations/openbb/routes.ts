import { createHash, timingSafeEqual } from 'node:crypto';
import type { FastifyPluginAsync } from 'fastify';
import { Type } from '@sinclair/typebox';
import { Side } from '../../../trading-engine.js';
import { ErrorResponseSchema } from '../../shared/schemas/common.js';
import {
  OpenBBPositionRowSchema,
  OpenBBMetricSchema,
  OpenBBDealRowSchema,
  OpenBBOmniContentSchema,
  SSRMQuerySchema,
} from './schemas.js';
import { PendingOrderSchema } from '../../trading/schemas.js';
import { SymbolInfoVOSchema } from '../../shared/domain/account.js';
import { applySSRM, type SSRMParams } from '../../shared/lib/ssrm.js';

// ─── Discovery configs ───────────────────────────────────────────────────────

const WIDGETS_CONFIG = {
  engine_positions: {
    name: 'Live Positions',
    description: 'Real-time long and short position state with P&L',
    category: 'Positions',
    type: 'live-grid',
    endpoint: '/openbb/positions',
    gridDimensions: { w: 8, h: 5 },
    refetchInterval: 3000,
    ssrm: true,
    parameters: [],
  },
  pending_orders: {
    name: 'Pending Orders',
    description: 'All pending limit/stop orders in the engine',
    category: 'Orders',
    type: 'live-grid',
    endpoint: '/openbb/orders',
    gridDimensions: { w: 6, h: 4 },
    refetchInterval: 3000,
    ssrm: true,
    parameters: [],
  },
  account_equity: {
    name: 'Account Equity',
    category: 'Account',
    type: 'metric',
    endpoint: '/openbb/account/equity',
    gridDimensions: { w: 2, h: 2 },
    parameters: [],
  },
  account_balance: {
    name: 'Account Balance',
    category: 'Account',
    type: 'metric',
    endpoint: '/openbb/account/balance',
    gridDimensions: { w: 2, h: 2 },
    parameters: [],
  },
  deal_history: {
    name: 'Deal History',
    category: 'History',
    type: 'table',
    endpoint: '/openbb/deals',
    gridDimensions: { w: 8, h: 5 },
    ssrm: true,
    parameters: [
      { paramName: 'from', label: 'From', type: 'date', show: true, optional: true,  value: '' },
      { paramName: 'to',   label: 'To',   type: 'date', show: true, optional: true,  value: '' },
    ],
  },
  symbol_info: {
    name: 'Symbol Info',
    category: 'Market Data',
    type: 'table',
    endpoint: '/openbb/symbol',
    gridDimensions: { w: 6, h: 3 },
    parameters: [
      { paramName: 'symbol', label: 'Symbol', type: 'text', show: true, optional: false, value: 'EURUSD' },
    ],
  },
  engine_config: {
    name: 'Engine & ATR Config',
    category: 'Configuration',
    type: 'omni',
    endpoint: '/openbb/engine-config',
    gridDimensions: { w: 4, h: 4 },
    parameters: [],
  },
};

const APPS_CONFIG = {
  trading_dashboard: {
    name: 'Trading Dashboard',
    description: 'Live overview of positions, orders, account and market data',
    tabs: {
      Overview: {
        layout: [
          { i: 'account_equity',   x: 0, y: 0, w: 2, h: 2 },
          { i: 'account_balance',  x: 2, y: 0, w: 2, h: 2 },
          { i: 'engine_positions', x: 0, y: 2, w: 8, h: 5 },
          { i: 'pending_orders',   x: 8, y: 0, w: 6, h: 4 },
          { i: 'engine_config',    x: 8, y: 4, w: 4, h: 4 },
        ],
      },
      History: {
        layout: [
          { i: 'deal_history', x: 0, y: 0, w: 8, h: 5 },
          { i: 'symbol_info',  x: 8, y: 0, w: 6, h: 3 },
        ],
      },
    },
  },
};

// ─── ETag for static configs ─────────────────────────────────────────────────

const WIDGETS_JSON = JSON.stringify(WIDGETS_CONFIG);
const WIDGETS_ETAG = `"${createHash('sha256').update(WIDGETS_JSON).digest('hex').slice(0, 16)}"`;
const APPS_JSON = JSON.stringify(APPS_CONFIG);
const APPS_ETAG = `"${createHash('sha256').update(APPS_JSON).digest('hex').slice(0, 16)}"`;

// Querystring schemas (TypeBox) — validates and strips unknown params
const DealsQuerySchema = Type.Object({
  from:   Type.Optional(Type.String()),
  to:     Type.Optional(Type.String()),
  apiKey: Type.Optional(Type.String()),
});

const SymbolQuerySchema = Type.Object({
  symbol: Type.Optional(Type.String()),
  apiKey: Type.Optional(Type.String()),
});

// ─── Plugin ──────────────────────────────────────────────────────────────────

// NOT fp()-wrapped — hooks and routes are scoped to this child only.
const openbbRoute: FastifyPluginAsync = async (fastify) => {
  // Optional API-key guard — only activated when OPENBB_API_KEY env var is set.
  const API_KEY = process.env.OPENBB_API_KEY;
  if (API_KEY) {
    const keyBuf = Buffer.from(API_KEY);
    fastify.addHook('preHandler', async (req, reply) => {
      const provided = (req.query as { apiKey?: string }).apiKey ?? '';
      const providedBuf = Buffer.from(provided);
      // timingSafeEqual requires equal-length buffers; check length first
      const valid = keyBuf.length === providedBuf.length && timingSafeEqual(keyBuf, providedBuf);
      if (!valid) return reply.status(401).send({ error: 'Unauthorized' });
    });
  }

  // ── Discovery ──────────────────────────────────────────────────────────────

  fastify.get('/widgets.json', {
    schema: { response: { 200: Type.Object({}, { additionalProperties: true }) } },
  }, async (req, reply) => {
    reply.header('Cache-Control', 'public, max-age=3600');
    reply.header('ETag', WIDGETS_ETAG);
    if (req.headers['if-none-match'] === WIDGETS_ETAG) {
      reply.raw.writeHead(304); return reply.raw.end();
    }
    return reply.send(WIDGETS_CONFIG);
  });

  fastify.get('/apps.json', {
    schema: { response: { 200: Type.Object({}, { additionalProperties: true }) } },
  }, async (req, reply) => {
    reply.header('Cache-Control', 'public, max-age=3600');
    reply.header('ETag', APPS_ETAG);
    if (req.headers['if-none-match'] === APPS_ETAG) {
      reply.raw.writeHead(304); return reply.raw.end();
    }
    return reply.send(APPS_CONFIG);
  });

  // ── Positions ──────────────────────────────────────────────────────────────

  const PositionsQuerySchema = Type.Intersect([
    SSRMQuerySchema,
    Type.Object({ apiKey: Type.Optional(Type.String()) }),
  ]);

  fastify.get('/openbb/positions', {
    schema: { querystring: PositionsQuerySchema },
  }, async (req, reply) => {
    reply.header('Cache-Control', 'no-store');
    const { engine, broker } = fastify;
    const price = broker.getPrice();
    const rows = [Side.Long, Side.Short].map(side => {
      const isLong = side === Side.Long;
      const size = isLong ? engine.getSizeBuy() : engine.getSizeSell();
      const open = size > 0;
      return {
        side:      isLong ? 'LONG' as const : 'SHORT' as const,
        size,
        openPrice: open ? (isLong ? engine.getBEBuy()      : engine.getBESell())  : null,
        sl:        open ? (isLong ? engine.getSLBuy()      : engine.getSLSell())  : null,
        tp:        open ? (isLong ? engine.getTPBuy()      : engine.getTPSell())  : null,
        pl:        isLong ? engine.getPLBuy(price) : engine.getPLSell(price),
        status:    open ? 'OPEN' as const : 'FLAT' as const,
      };
    });
    const q = req.query as SSRMParams;
    if (q.startRow != null || q.endRow != null || q.sortModel || q.filterModel) {
      return reply.send(applySSRM(rows, q));
    }
    return reply.send(rows);
  });

  // ── Orders ─────────────────────────────────────────────────────────────────

  const OrdersQuerySchema = Type.Intersect([
    SSRMQuerySchema,
    Type.Object({ apiKey: Type.Optional(Type.String()) }),
  ]);

  fastify.get('/openbb/orders', {
    schema: { querystring: OrdersQuerySchema },
  }, async (req, reply) => {
    reply.header('Cache-Control', 'no-store');
    const orders = [...fastify.engine.getOrders()] as unknown as Record<string, unknown>[];
    const q = req.query as SSRMParams;
    if (q.startRow != null || q.endRow != null || q.sortModel || q.filterModel) {
      return reply.send(applySSRM(orders, q));
    }
    return reply.send(orders);
  });

  // ── Account ────────────────────────────────────────────────────────────────

  fastify.get('/openbb/account/equity', {
    schema: { response: { 200: OpenBBMetricSchema } },
  }, async (_req, reply) => {
    reply.header('Cache-Control', 'no-store');
    const { equity, balance } = await fastify.broker.getAccount();
    return reply.send({ value: equity, label: 'Equity', delta: equity - balance });
  });

  fastify.get('/openbb/account/balance', {
    schema: { response: { 200: OpenBBMetricSchema } },
  }, async (_req, reply) => {
    reply.header('Cache-Control', 'no-store');
    const { balance } = await fastify.broker.getAccount();
    return reply.send({ value: balance, label: 'Balance', delta: 0 });
  });

  // ── History ────────────────────────────────────────────────────────────────

  const DealsQueryWithSSRMSchema = Type.Intersect([
    DealsQuerySchema,
    SSRMQuerySchema,
  ]);

  fastify.get('/openbb/deals', {
    schema: {
      querystring: DealsQueryWithSSRMSchema,
      response: {
        400: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
  }, async (req, reply) => {
    reply.header('Cache-Control', 'private, max-age=10');
    const { from, to } = req.query as { from?: string; to?: string };
    const fromDate = from ? new Date(from) : new Date(0);
    const toDate   = to   ? new Date(to)   : new Date();
    if (from && Number.isNaN(fromDate.getTime()))
      return reply.status(400).send({ error: 'Invalid "from" date' });
    if (to && Number.isNaN(toDate.getTime()))
      return reply.status(400).send({ error: 'Invalid "to" date' });
    if (fromDate > toDate)
      return reply.status(400).send({ error: '"from" must be before "to"' });
    const result = await fastify.broker.getDeals('default', fromDate, toDate);
    if (!result.ok) return reply.status(500).send({ error: result.error.message });
    const deals = result.value.map(d => ({
      ticket:     d.ticket,
      symbol:     d.symbol,
      type:       d.type,
      volume:     d.volume,
      price:      d.price,
      profit:     d.profit,
      swap:       d.swap,
      commission: d.commission,
      time:       d.time,
    }));
    const q = req.query as SSRMParams;
    if (q.startRow != null || q.endRow != null || q.sortModel || q.filterModel) {
      return reply.send(applySSRM(deals as Record<string, unknown>[], q));
    }
    return reply.send(deals);
  });

  // ── Market data ────────────────────────────────────────────────────────────

  fastify.get('/openbb/symbol', {
    schema: {
      querystring: SymbolQuerySchema,
      response: {
        200: Type.Array(SymbolInfoVOSchema),
        400: ErrorResponseSchema,
        404: ErrorResponseSchema,
      },
    },
  }, async (req, reply) => {
    reply.header('Cache-Control', 'public, max-age=60');
    const { symbol } = req.query as { symbol?: string };
    if (!symbol) return reply.status(400).send({ error: 'symbol query param required' });
    const result = await fastify.broker.getSymbolInfo(symbol);
    if (!result.ok) return reply.status(404).send({ error: result.error.message });
    return reply.send([result.value]);
  });

  // ── Engine config ──────────────────────────────────────────────────────────

  fastify.get('/openbb/engine-config', {
    schema: { response: { 200: Type.Array(OpenBBOmniContentSchema) } },
  }, async (_req, reply) => {
    const cfg = fastify.atrConfig;
    return reply.send([
      { type: 'text', content: '## Engine & ATR Configuration' },
      {
        type: 'table',
        content: Object.entries(cfg).map(([key, value]) => ({ key, value })),
      },
    ]);
  });
};

export default openbbRoute;
