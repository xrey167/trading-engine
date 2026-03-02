import type { FastifyPluginAsync } from 'fastify';
import { Type } from '@sinclair/typebox';
import {
  PendingOrderSchema,
  PostOrderBodySchema,
  type PostOrderBody,
  PatchOrderBodySchema,
  type PatchOrderBody,
  ErrorResponseSchema,
  OkResponseSchema,
} from '../../schemas/index.js';

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

  // POST /orders — rate-limited: max 10 per second
  fastify.post<{ Body: PostOrderBody }>('/orders', {
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
    const { type, price, size, attributes } = req.body;

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
    if (size !== undefined) engine.orderSize(size);

    let id: string | undefined;
    switch (type) {
      case 'BUY_LIMIT':  id = engine.addBuyLimit(price);  break;
      case 'BUY_STOP':   id = engine.addBuyStop(price);   break;
      case 'SELL_LIMIT': id = engine.addSellLimit(price); break;
      case 'SELL_STOP':  id = engine.addSellStop(price);  break;
      case 'BUY_MIT':    id = engine.addBuyMIT(price);    break;
      case 'SELL_MIT':   id = engine.addSellMIT(price);   break;
      default:
        return reply.status(400).send({ error: `Unknown order type: ${type}` });
    }

    return reply.send({ id });
  });

  // PATCH /orders/:id — move order to a new price
  fastify.patch<{ Params: { id: string }; Body: PatchOrderBody }>('/orders/:id', {
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

  // DELETE /orders/:id
  fastify.delete<{ Params: { id: string } }>('/orders/:id', {
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
