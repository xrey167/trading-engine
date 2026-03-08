import fp from 'fastify-plugin';
import type { FastifyPluginAsync } from 'fastify';
import openbbRoute from './routes.js';

const openbbModule: FastifyPluginAsync = async (fastify) => {
  await fastify.register(openbbRoute);
};

export default fp(openbbModule, { name: 'openbb-module' });
