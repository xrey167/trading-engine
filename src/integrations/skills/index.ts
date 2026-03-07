import fp from 'fastify-plugin';
import type { FastifyPluginAsync } from 'fastify';
import skillsRoute from './routes.js';

const skillsModule: FastifyPluginAsync = async (fastify) => {
  await fastify.register(skillsRoute);
};

export default fp(skillsModule, { name: 'skills-module' });
