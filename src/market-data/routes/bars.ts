import type { FastifyPluginAsync } from 'fastify';
import { Bar } from '../../shared/domain/bar/bar.js';
import { Bars } from '../../shared/domain/bar/bars.js';
import { OkResponseSchema } from '../../shared/schemas/common.js';
import {
  PostBarsBodySchema,
  type PostBarsBody,
} from '../schemas.js';
import { apiKeyPreHandler } from '../../shared/lib/api-utils.js';

const barsRoute: FastifyPluginAsync = async (fastify) => {
  // Wire engine callback to emit EXPIRED events when removeOrdersOnFlat fires
  fastify.engine.onOrderExpired = (orders) => {
    const now = new Date().toISOString();
    for (const o of orders) {
      fastify.emitter.emit('order', {
        action:    'EXPIRED',
        orderId:   Number(o.id),
        orderType: o.type,
        source:    'broker',
        brokerId:  'paper',
        symbol:    fastify.symbol.name,
        direction: (o.side > 0) ? 'BUY' : 'SELL',
        lots:      o.size,
        price:     o.price,
        metadata:  {},
        timestamp: now,
      });
    }
  };

  // POST /bars — drives engine.onBar(); emits 'bar' event to WebSocket clients
  fastify.post<{ Body: PostBarsBody }>('/bars', {
    preHandler: [apiKeyPreHandler],
    config: { rateLimit: { max: 120, timeWindow: '1 second' } },
    schema: {
      body: PostBarsBodySchema,
      response: { 200: OkResponseSchema },
    },
  }, async (req, reply) => {
    const { engine, emitter, broker } = fastify;
    const b = req.body.bar;

    const bar = new Bar(b.open, b.high, b.low, b.close, new Date(b.time), b.volume);
    const bars = new Bars(req.body.bars.map(raw => ({
      open:   raw.open,
      high:   raw.high,
      low:    raw.low,
      close:  raw.close,
      time:   new Date(raw.time),
      volume: raw.volume,
    })));

    // Update paper-broker price reference before onBar drives fills
    broker.setPrice(bar.close);

    await engine.onBar(bar, bars);
    // Unit 8 — AtrModule updates SL/TP/trail after each bar if configured
    fastify.atrModule.onBar(bars);
    emitter.emit('bar', { type: 'bar', bar: req.body.bar });

    return reply.send({ ok: true });
  });
};

export default barsRoute;
