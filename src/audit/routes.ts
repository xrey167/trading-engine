import type { FastifyPluginAsync } from 'fastify';
import { AuditQuerySchema, AuditResponseSchema, type AuditQuery } from './schemas.js';
import { ErrorResponseSchema } from '../shared/schemas/common.js';

const auditRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /audit/events — query audit trail
  fastify.get<{ Querystring: AuditQuery }>('/audit/events', {
    schema: {
      querystring: AuditQuerySchema,
      response: {
        200: AuditResponseSchema,
        503: ErrorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const consumer = fastify.auditConsumer;
    if (!consumer) {
      return reply.status(503).send({
        error: 'Service Unavailable',
        message: 'Audit trail requires RABBITMQ_URL',
        statusCode: 503,
      });
    }

    const { type, since, limit } = request.query;
    const events = consumer.query({ type, since, limit });
    return { total: events.length, events };
  });
};

export default auditRoutes;
