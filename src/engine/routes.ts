import type { FastifyPluginAsync } from 'fastify';
import { AccountSchema, OkResponseSchema } from '../shared/schemas/common.js';
import {
  PutEngineConfigBodySchema,
  type PutEngineConfigBody,
  PutAtrConfigBodySchema,
  type PutAtrConfigBody,
} from './schemas.js';
import { apiKeyPreHandler } from '../shared/lib/api-utils.js';

const engineRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /account
  fastify.get('/account', {
    schema: { response: { 200: AccountSchema } },
  }, async (_req, reply) => {
    return reply.send(await fastify.broker.getAccount());
  });

  // PUT /engine/config — update engine-level flags (Unit 6)
  fastify.put<{ Body: PutEngineConfigBody }>('/engine/config', {
    preHandler: [apiKeyPreHandler],
    schema: {
      body: PutEngineConfigBodySchema,
      response: { 200: OkResponseSchema },
    },
  }, async (req, reply) => {
    const release = await fastify.engineMutex.acquire();
    try {
      const { removeOrdersOnFlat } = req.body;
      if (removeOrdersOnFlat !== undefined)
        fastify.engine.aeRemoveOrdersFlat(removeOrdersOnFlat);
      return reply.send({ ok: true });
    } finally {
      release();
    }
  });

  // PUT /atr/config — update AtrModule multipliers and flags at runtime (Unit 8)
  fastify.put<{ Body: PutAtrConfigBody }>('/atr/config', {
    preHandler: [apiKeyPreHandler],
    schema: {
      body: PutAtrConfigBodySchema,
      response: { 200: OkResponseSchema },
    },
  }, async (req, reply) => {
    const release = await fastify.engineMutex.acquire();
    try {
      const cfg = fastify.atrConfig;
      const b = req.body;
      if (b.period               !== undefined) cfg.period               = b.period;
      if (b.method               !== undefined) cfg.method               = b.method;
      if (b.shift                !== undefined) cfg.shift                = b.shift;
      if (b.slMultiplier         !== undefined) cfg.slMultiplier         = b.slMultiplier;
      if (b.tpMultiplier         !== undefined) cfg.tpMultiplier         = b.tpMultiplier;
      if (b.trailBeginMultiplier !== undefined) cfg.trailBeginMultiplier = b.trailBeginMultiplier;
      if (b.trailDistMultiplier  !== undefined) cfg.trailDistMultiplier  = b.trailDistMultiplier;
      if (b.onlyWhenFlat         !== undefined) cfg.onlyWhenFlat         = b.onlyWhenFlat;
      if (b.barsAtrMode          !== undefined) cfg.barsAtrMode          = b.barsAtrMode;
      if (b.barBase              !== undefined) cfg.barBase              = b.barBase;
      return reply.send({ ok: true });
    } finally {
      release();
    }
  });
};

export default engineRoutes;
