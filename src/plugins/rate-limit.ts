import fp from 'fastify-plugin';
import rateLimit from '@fastify/rate-limit';
import type { FastifyPluginAsync } from 'fastify';

const rateLimitPlugin: FastifyPluginAsync = async (fastify) => {
  await fastify.register(rateLimit, {
    global: false, // opt-in per-route via routeOptions.config.rateLimit
  });
};

export default fp(rateLimitPlugin, { name: 'rate-limit' });
