import type { FastifyPluginAsync } from 'fastify';
import {
  PutAtrConfigBodySchema,
  type PutAtrConfigBody,
  OkResponseSchema,
} from '../../schemas/index.js';

const atrRoute: FastifyPluginAsync = async (fastify) => {
  // PUT /atr/config — update AtrModule multipliers and flags at runtime (Unit 8)
  fastify.put<{ Body: PutAtrConfigBody }>('/atr/config', {
    schema: {
      body: PutAtrConfigBodySchema,
      response: { 200: OkResponseSchema },
    },
  }, async (req, reply) => {
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
    return reply.send({ ok: true });
  });
};

export default atrRoute;
