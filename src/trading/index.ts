import fp from 'fastify-plugin';
import type { FastifyPluginAsync } from 'fastify';
import positionsRoute from './routes/positions.js';
import ordersRoute from './routes/orders.js';
import scaledOrdersRoute from './routes/scaled-orders.js';
import v1PositionsRoute from './routes/v1-positions.js';

const tradingModule: FastifyPluginAsync = async (fastify) => {
  await fastify.register(positionsRoute);
  await fastify.register(ordersRoute);
  await fastify.register(scaledOrdersRoute);
  await fastify.register(v1PositionsRoute);
};

export default fp(tradingModule, { name: 'trading-module' });
