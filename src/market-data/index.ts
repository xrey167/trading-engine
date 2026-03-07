import fp from 'fastify-plugin';
import type { FastifyPluginAsync } from 'fastify';
import barsRoute from './routes/bars.js';
import streamRoute from './routes/stream.js';
import ticksRoute from './routes/ticks.js';
import udfRoute from './routes/udf.js';

const marketDataModule: FastifyPluginAsync = async (fastify) => {
  await fastify.register(barsRoute);
  await fastify.register(streamRoute);
  await fastify.register(ticksRoute);
  await fastify.register(udfRoute);
};

export { TickIngestionService } from './tick-ingestion-service.js';

export default fp(marketDataModule, { name: 'market-data-module' });
