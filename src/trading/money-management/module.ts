import fp from 'fastify-plugin';
import type { FastifyPluginAsync } from 'fastify';
import moneyManagementRoute from './routes.js';

const mmModule: FastifyPluginAsync = async (fastify) => {
  await fastify.register(moneyManagementRoute);
};

export default fp(mmModule, { name: 'money-management-module' });
