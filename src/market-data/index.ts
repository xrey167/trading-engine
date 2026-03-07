import fp from 'fastify-plugin';
import type { FastifyPluginAsync } from 'fastify';
import barsRoute from './routes/bars.js';
import streamRoute from './routes/stream.js';

const marketDataModule: FastifyPluginAsync = async (fastify) => {
  await fastify.register(barsRoute);
  await fastify.register(streamRoute);
};

export default fp(marketDataModule, { name: 'market-data-module' });
