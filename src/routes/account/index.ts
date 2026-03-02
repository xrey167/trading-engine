import type { FastifyPluginAsync } from 'fastify';
import { AccountSchema } from '../../schemas/index.js';

const accountRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get('/account', {
    schema: { response: { 200: AccountSchema } },
  }, async (_req, reply) => {
    return reply.send(await fastify.broker.getAccount());
  });
};

export default accountRoute;
