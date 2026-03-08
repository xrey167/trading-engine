import type { FastifyPluginAsync } from 'fastify';
import { PostTickBodySchema, type PostTickBody } from '../schemas.js';
import { apiKeyPreHandler } from '../../shared/lib/api-utils.js';

const ticksRoute: FastifyPluginAsync = async (fastify) => {
  fastify.post<{ Body: PostTickBody }>('/ticks', {
    preHandler: [apiKeyPreHandler],
    schema: {
      body: PostTickBodySchema,
      response: { 204: { type: 'null' } },
    },
  }, async (req, reply) => {
    const { bid, ask, time } = req.body;
    fastify.emitter.emit('tick', {
      providerId: 'http',
      symbol: fastify.symbol.name,
      bid,
      ask,
      timestamp: time ?? new Date().toISOString(),
    });
    return reply.status(204).send();
  });
};

export default ticksRoute;
