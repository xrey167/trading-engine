import type { FastifyPluginAsync } from 'fastify';
import { Type } from '@sinclair/typebox';
import { TrailMode } from '../../../trading-engine.js';
import {
  PendingOrderSchema,
  PostOrderBodySchema,
  type PostOrderBody,
  PatchOrderBodySchema,
  type PatchOrderBody,
  PostBracketBodySchema,
  type PostBracketBody,
  ErrorResponseSchema,
  OkResponseSchema,
} from '../../schemas/index.js';
import { apiKeyPreHandler } from '../../lib/api-utils.js';

const ordersRoute: FastifyPluginAsync = async (fastify) => {
  // GET /orders
  fastify.get('/orders', {
    schema: {
      response: {
        200: Type.Array(PendingOrderSchema),
      },
    },
  }, async (_req, reply) => {
    const orders = fastify.engine.getOrders().map(o => ({
      id:    o.id,
      type:  o.type,
      side:  o.side,
      price: o.price,
      size:  o.size,
      time:  o.time.toISOString(),
    }));
    return reply.send(orders);
  });

  // POST /orders — rate-limited: max 10 per second; supports trailing entry types (Unit 3)
  fastify.post<{ Body: PostOrderBody }>('/orders', {
    preHandler: [apiKeyPreHandler],
    config: { rateLimit: { max: 10, timeWindow: '1 second' } },
    schema: {
      body: PostOrderBodySchema,
      response: {
        200: Type.Object({ id: Type.String() }),
        400: ErrorResponseSchema,
      },
    },
  }, async (req, reply) => {
    const { engine } = fastify;
    const { type, price, size, attributes, trailEntry } = req.body;

    const release = await fastify.engineMutex.acquire();
    try {
      // Apply optional attributes before placing the order
      if (attributes) {
        if (attributes.oco  !== undefined) engine.orderAttrOCO(attributes.oco);
        if (attributes.co   !== undefined) engine.orderAttrCO(attributes.co);
        if (attributes.cs   !== undefined) engine.orderAttrCS(attributes.cs);
        if (attributes.rev  !== undefined) engine.orderAttrREV(attributes.rev);
        if (attributes.bracketSL !== undefined) engine.bracketSL(attributes.bracketSL);
        if (attributes.bracketTP !== undefined) engine.bracketTP(attributes.bracketTP);
        if (attributes.pullbackPts !== undefined) engine.orderLimitPullback(attributes.pullbackPts);
        if (attributes.limitConfirm !== undefined) engine.orderLimitConfirm(attributes.limitConfirm as 0 | 1 | 2 | 3);
      }
      let id: string | undefined;
      switch (type) {
        // Pass size directly — avoids mutating shared _nextOrderSize engine state
        case 'BUY_LIMIT':  id = engine.addBuyLimit(price, size ?? 1);  break;
        case 'BUY_STOP':   id = engine.addBuyStop(price, size ?? 1);   break;
        case 'SELL_LIMIT': id = engine.addSellLimit(price, size ?? 1); break;
        case 'SELL_STOP':  id = engine.addSellStop(price, size ?? 1);  break;
        case 'BUY_MIT':    id = engine.addBuyMIT(price, size ?? 1);    break;
        case 'SELL_MIT':   id = engine.addSellMIT(price, size ?? 1);   break;
        // Unit 3 — trailing entry types (no size param; set+reset to avoid state leak)
        case 'BUY_LIMIT_TRAIL': {
          if (!trailEntry) return reply.status(400).send({ error: 'trailEntry required for BUY_LIMIT_TRAIL' });
          if (size !== undefined) engine.orderSize(size);
          id = engine.addBuyLimitTrail(trailEntry.mode as TrailMode, trailEntry.distancePts, trailEntry.periods);
          if (size !== undefined) engine.orderSize(1);
          break;
        }
        case 'BUY_STOP_TRAIL': {
          if (!trailEntry) return reply.status(400).send({ error: 'trailEntry required for BUY_STOP_TRAIL' });
          if (size !== undefined) engine.orderSize(size);
          id = engine.addBuyStopTrail(trailEntry.mode as TrailMode, trailEntry.distancePts, trailEntry.periods);
          if (size !== undefined) engine.orderSize(1);
          break;
        }
        case 'SELL_LIMIT_TRAIL': {
          if (!trailEntry) return reply.status(400).send({ error: 'trailEntry required for SELL_LIMIT_TRAIL' });
          if (size !== undefined) engine.orderSize(size);
          id = engine.addSellLimitTrail(trailEntry.mode as TrailMode, trailEntry.distancePts, trailEntry.periods);
          if (size !== undefined) engine.orderSize(1);
          break;
        }
        case 'SELL_STOP_TRAIL': {
          if (!trailEntry) return reply.status(400).send({ error: 'trailEntry required for SELL_STOP_TRAIL' });
          if (size !== undefined) engine.orderSize(size);
          id = engine.addSellStopTrail(trailEntry.mode as TrailMode, trailEntry.distancePts, trailEntry.periods);
          if (size !== undefined) engine.orderSize(1);
          break;
        }
        default:
          return reply.status(400).send({ error: `Unknown order type: ${type}` });
      }

      return reply.send({ id });
    } finally {
      release();
    }
  });

  // POST /orders/bracket — place a bracket order (Unit 4)
  fastify.post<{ Body: PostBracketBody }>('/orders/bracket', {
    preHandler: [apiKeyPreHandler],
    schema: {
      body: PostBracketBodySchema,
      response: {
        200: Type.Object({ id: Type.String() }),
        400: ErrorResponseSchema,
      },
    },
  }, async (req, reply) => {
    const { entryType, entryPrice, slPts, tpPts, size } = req.body;
    const id = fastify.engine.addBracket({ entryType, entryPrice, slPts, tpPts, size });
    return reply.send({ id });
  });

  // PATCH /orders/:id — move order to a new price
  fastify.patch<{ Params: { id: string }; Body: PatchOrderBody }>('/orders/:id', {
    preHandler: [apiKeyPreHandler],
    schema: {
      params: Type.Object({ id: Type.String() }),
      body: PatchOrderBodySchema,
      response: { 200: OkResponseSchema, 404: ErrorResponseSchema },
    },
  }, async (req, reply) => {
    const moved = fastify.engine.moveOrder(req.params.id, req.body.price);
    if (!moved) return reply.status(404).send({ error: `Order ${req.params.id} not found` });
    return reply.send({ ok: true });
  });

  // DELETE /orders — bulk delete by side (Unit 2): ?side=buy|sell|all
  fastify.delete('/orders', {
    preHandler: [apiKeyPreHandler],
    schema: {
      querystring: Type.Object({
        side: Type.Union([Type.Literal('buy'), Type.Literal('sell'), Type.Literal('all')]),
      }),
      response: { 200: OkResponseSchema, 400: ErrorResponseSchema },
    },
  }, async (req, reply) => {
    const { side } = req.query as { side: string };
    switch (side) {
      case 'buy':  await fastify.engine.deleteBuyOrders();  break;
      case 'sell': await fastify.engine.deleteSellOrders(); break;
      case 'all':  await fastify.engine.deleteAllOrders();  break;
      default:
        return reply.status(400).send({ error: `Unknown side: ${side}` });
    }
    return reply.send({ ok: true });
  });

  // DELETE /orders/:id
  fastify.delete<{ Params: { id: string } }>('/orders/:id', {
    preHandler: [apiKeyPreHandler],
    schema: {
      params: Type.Object({ id: Type.String() }),
      response: {
        200: OkResponseSchema,
        404: ErrorResponseSchema,
      },
    },
  }, async (req, reply) => {
    const deleted = fastify.engine.deleteOrder(req.params.id);
    if (!deleted) return reply.status(404).send({ error: `Order ${req.params.id} not found` });
    return reply.send({ ok: true });
  });
};

export default ordersRoute;
