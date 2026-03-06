import type { FastifyPluginAsync } from 'fastify';
import { Side } from '../../../trading-engine.js';

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

// ─── Plugin ──────────────────────────────────────────────────────────────────

// NOT fp()-wrapped — hooks and routes are scoped to this child only.
const openbbRoute: FastifyPluginAsync = async (fastify) => {
  // Optional API-key guard — only activated when OPENBB_API_KEY env var is set.
  const API_KEY = process.env.OPENBB_API_KEY;
  if (API_KEY) {
    fastify.addHook('preHandler', async (req, reply) => {
      if ((req.query as { apiKey?: string }).apiKey !== API_KEY) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }
    });
  }

  // ── Discovery ──────────────────────────────────────────────────────────────

  fastify.get('/widgets.json', async (_req, reply) => {
    return reply.send(WIDGETS_CONFIG);
  });

  fastify.get('/apps.json', async (_req, reply) => {
    return reply.send(APPS_CONFIG);
  });

  // ── Positions ──────────────────────────────────────────────────────────────

  fastify.get('/openbb/positions', async (_req, reply) => {
    const { engine, broker } = fastify;
    const price = broker.getPrice();
    const rows = [Side.Long, Side.Short].map(side => {
      const size = side === Side.Long ? engine.getSizeBuy() : engine.getSizeSell();
      return {
        side:      side === Side.Long ? 'LONG' : 'SHORT',
        size,
        openPrice: side === Side.Long ? engine.getBEBuy()      : engine.getBESell(),
        sl:        side === Side.Long ? engine.getSLBuy()      : engine.getSLSell(),
        tp:        side === Side.Long ? engine.getTPBuy()      : engine.getTPSell(),
        pl:        side === Side.Long ? engine.getPLBuy(price) : engine.getPLSell(price),
        status:    size > 0 ? 'OPEN' : 'FLAT',
      };
    });
    return reply.send(rows);
  });

  // ── Orders ─────────────────────────────────────────────────────────────────

  fastify.get('/openbb/orders', async (_req, reply) => {
    return reply.send(fastify.engine.getOrders());
  });

  // ── Account ────────────────────────────────────────────────────────────────

  fastify.get('/openbb/account/equity', async (_req, reply) => {
    const { equity, balance } = await fastify.broker.getAccount();
    return reply.send({ value: equity, label: 'Equity', delta: equity - balance });
  });

  fastify.get('/openbb/account/balance', async (_req, reply) => {
    const { balance } = await fastify.broker.getAccount();
    return reply.send({ value: balance, label: 'Balance', delta: 0 });
  });

  // ── History ────────────────────────────────────────────────────────────────

  fastify.get('/openbb/deals', async (req, reply) => {
    const { from, to } = req.query as { from?: string; to?: string };
    const fromDate = from ? new Date(from) : new Date(0);
    const toDate   = to   ? new Date(to)   : new Date();
    const result = await fastify.broker.getDeals('default', fromDate, toDate);
    if (!result.ok) return reply.status(500).send({ error: result.error.message });
    return reply.send(result.value.map(d => ({
      ticket:     d.ticket,
      symbol:     d.symbol,
      type:       d.type,
      volume:     d.volume,
      price:      d.price,
      profit:     d.profit,
      swap:       d.swap,
      commission: d.commission,
      time:       d.time,
    })));
  });

  // ── Market data ────────────────────────────────────────────────────────────

  fastify.get('/openbb/symbol', async (req, reply) => {
    const { symbol } = req.query as { symbol?: string };
    if (!symbol) return reply.status(400).send({ error: 'symbol query param required' });
    const result = await fastify.broker.getSymbolInfo(symbol);
    if (!result.ok) return reply.status(404).send({ error: result.error.message });
    return reply.send([result.value]);
  });

  // ── Engine config ──────────────────────────────────────────────────────────

  fastify.get('/openbb/engine-config', async (_req, reply) => {
    const cfg = fastify.atrConfig;
    const md = [
      '## ATR Config',
      '',
      `| Key | Value |`,
      `|-----|-------|`,
      `| period               | ${cfg.period}               |`,
      `| method               | ${cfg.method}               |`,
      `| shift                | ${cfg.shift}                |`,
      `| slMultiplier         | ${cfg.slMultiplier}         |`,
      `| tpMultiplier         | ${cfg.tpMultiplier}         |`,
      `| trailBeginMultiplier | ${cfg.trailBeginMultiplier} |`,
      `| trailDistMultiplier  | ${cfg.trailDistMultiplier}  |`,
      `| onlyWhenFlat         | ${cfg.onlyWhenFlat}         |`,
    ].join('\n');
    return reply.send([{ content: md, type: 'text' }]);
  });
};

export default openbbRoute;
