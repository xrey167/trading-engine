import fp from 'fastify-plugin';
import type { FastifyPluginAsync } from 'fastify';
import auditRoutes from './routes.js';

const auditModule: FastifyPluginAsync = async (fastify) => {
  await fastify.register(auditRoutes);
};

export default fp(auditModule, { name: 'audit-module' });
