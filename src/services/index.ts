import fp from 'fastify-plugin';
import type { FastifyPluginAsync } from 'fastify';
import serviceRoutes from './routes.js';

const servicesModule: FastifyPluginAsync = async (fastify) => {
  await fastify.register(serviceRoutes);
};

export default fp(servicesModule, { name: 'services-module' });
