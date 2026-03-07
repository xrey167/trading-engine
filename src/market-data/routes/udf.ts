import type { FastifyPluginAsync } from 'fastify';
import { Type } from '@sinclair/typebox';

// ─── Resolution mapping ────────────────────────────────────────────────────

const SUPPORTED_RESOLUTIONS = ['1', '5', '15', '30', '60', '240', '1D', '1W', '1M'] as const;

const RESOLUTION_TO_TIMEFRAME: Record<string, string> = {
  '1':   'M1',
  '5':   'M5',
  '15':  'M15',
  '30':  'M30',
  '60':  'H1',
  '240': 'H4',
  '1D':  'D1',
  '1W':  'W1',
  '1M':  'MN1',
};

// ─── Forex pair descriptions ───────────────────────────────────────────────

const PAIR_DESCRIPTIONS: Record<string, string> = {
  EURUSD: 'Euro / US Dollar',
  GBPUSD: 'British Pound / US Dollar',
  USDJPY: 'US Dollar / Japanese Yen',
  USDCHF: 'US Dollar / Swiss Franc',
  AUDUSD: 'Australian Dollar / US Dollar',
  USDCAD: 'US Dollar / Canadian Dollar',
  NZDUSD: 'New Zealand Dollar / US Dollar',
};

// ─── Querystring schemas ───────────────────────────────────────────────────

const SymbolQuerySchema = Type.Object({
  symbol: Type.String(),
});

const HistoryQuerySchema = Type.Object({
  symbol:     Type.String(),
  from:       Type.Number(),
  to:         Type.Number(),
  resolution: Type.String(),
});

// ─── Response schemas ─────────────────────────────────────────────────────

const UdfConfigResponseSchema = Type.Object({
  supports_search:        Type.Boolean(),
  supports_group_request: Type.Boolean(),
  supports_marks:         Type.Boolean(),
  supports_timescale_marks: Type.Boolean(),
  supports_time:          Type.Boolean(),
  exchanges:              Type.Array(Type.Object({ value: Type.String(), name: Type.String(), desc: Type.String() })),
  symbols_types:          Type.Array(Type.Object({ name: Type.String(), value: Type.String() })),
  supported_resolutions:  Type.Array(Type.String()),
});

const UdfSymbolResponseSchema = Type.Object({
  name:                   Type.String(),
  full_name:              Type.String(),
  description:            Type.String(),
  type:                   Type.String(),
  session:                Type.String(),
  exchange:               Type.String(),
  listed_exchange:        Type.String(),
  timezone:               Type.String(),
  has_intraday:           Type.Boolean(),
  has_daily:              Type.Boolean(),
  pricescale:             Type.Number(),
  minmov:                 Type.Number(),
  supported_resolutions:  Type.Array(Type.String()),
  data_status:            Type.String(),
});

const UdfHistoryResponseSchema = Type.Union([
  Type.Object({
    s: Type.Literal('ok'),
    t: Type.Array(Type.Number()),
    o: Type.Array(Type.Number()),
    h: Type.Array(Type.Number()),
    l: Type.Array(Type.Number()),
    c: Type.Array(Type.Number()),
    v: Type.Array(Type.Number()),
  }),
  Type.Object({ s: Type.Literal('no_data') }),
  Type.Object({ s: Type.Literal('error'), errmsg: Type.String() }),
]);

// ─── Plugin ────────────────────────────────────────────────────────────────

const udfRoute: FastifyPluginAsync = async (fastify) => {

  // GET /udf/config — server capabilities
  fastify.get('/udf/config', {
    schema: { response: { 200: UdfConfigResponseSchema } },
  }, async (_req, reply) => {
    return reply.send({
      supports_search: true,
      supports_group_request: false,
      supports_marks: false,
      supports_timescale_marks: false,
      supports_time: true,
      exchanges: [{ value: '', name: 'All Exchanges', desc: '' }],
      symbols_types: [{ name: 'Forex', value: 'forex' }],
      supported_resolutions: [...SUPPORTED_RESOLUTIONS],
    });
  });

  // GET /udf/time — server time as Unix timestamp (seconds)
  fastify.get('/udf/time', {
    schema: { response: { 200: Type.String() } },
  }, async () => {
    return Math.floor(Date.now() / 1000).toString();
  });

  // GET /udf/symbols — symbol info
  fastify.get('/udf/symbols', {
    schema: { querystring: SymbolQuerySchema, response: { 200: UdfSymbolResponseSchema } },
  }, async (req, reply) => {
    const { symbol } = req.query as { symbol: string };
    const symbolName = fastify.symbol.name;
    const digits = fastify.symbol.digits;
    const name = symbol || symbolName;

    return reply.send({
      name,
      full_name: name,
      description: PAIR_DESCRIPTIONS[name] || name,
      type: 'forex',
      session: '24x7',
      exchange: '',
      listed_exchange: '',
      timezone: 'Etc/UTC',
      has_intraday: true,
      has_daily: true,
      pricescale: 10 ** digits,
      minmov: 1,
      supported_resolutions: [...SUPPORTED_RESOLUTIONS],
      data_status: 'streaming',
    });
  });

  // GET /udf/history — OHLCV data
  fastify.get('/udf/history', {
    schema: { querystring: HistoryQuerySchema, response: { 200: UdfHistoryResponseSchema } },
  }, async (req, reply) => {
    const { symbol, from, to, resolution } = req.query as {
      symbol: string; from: number; to: number; resolution: string;
    };

    const timeframe = RESOLUTION_TO_TIMEFRAME[resolution];
    if (!timeframe) {
      return reply.send({ s: 'error', errmsg: `Unsupported resolution: ${resolution}` });
    }

    const result = await fastify.broker.getBars(symbol, timeframe);
    if (!result.ok) {
      return reply.send({ s: 'no_data' });
    }

    const bars = result.value;
    const t: number[] = [];
    const o: number[] = [];
    const h: number[] = [];
    const l: number[] = [];
    const c: number[] = [];
    const v: number[] = [];

    // Bars are indexed 0 = most recent; iterate in reverse for chronological order
    for (let i = bars.length - 1; i >= 0; i--) {
      const candle = bars.candle(i);
      const ts = Math.floor(candle.time.getTime() / 1000);
      if (ts >= from && ts <= to) {
        t.push(ts);
        o.push(candle.open);
        h.push(candle.high);
        l.push(candle.low);
        c.push(candle.close);
        v.push(candle.volume ?? 0);
      }
    }

    if (t.length === 0) {
      return reply.send({ s: 'no_data' });
    }

    return reply.send({ s: 'ok', t, o, h, l, c, v });
  });
};

export default udfRoute;
