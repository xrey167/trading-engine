import fp from 'fastify-plugin';
import type { FastifyPluginAsync } from 'fastify';
import enginePlugin, { type EnginePluginOptions } from './engine-plugin.js';
import atrPlugin from './atr-plugin.js';
import engineRoutes from './routes.js';

const engineModule: FastifyPluginAsync<EnginePluginOptions> = async (fastify, opts) => {
  await fastify.register(enginePlugin, opts);
  await fastify.register(atrPlugin);
  await fastify.register(engineRoutes);
};

export default fp(engineModule, { name: 'engine-module' });
