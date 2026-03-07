import fp from 'fastify-plugin';
import type { FastifyPluginAsync } from 'fastify';
import backtestRoute from './routes/backtest.js';
import signalRoute from './routes/signal.js';

const analysisModule: FastifyPluginAsync = async (fastify) => {
  await fastify.register(backtestRoute);
  await fastify.register(signalRoute);
};

export default fp(analysisModule, { name: 'analysis-module' });
