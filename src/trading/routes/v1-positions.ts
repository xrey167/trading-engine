import type { FastifyPluginAsync } from 'fastify';
import { Type } from '@sinclair/typebox';
import { ErrorResponseSchema } from '../../shared/schemas/common.js';
import { PositionInfoVOSchema } from '../../shared/domain/position.js';
import { createTradingUseCases } from '../use-cases/index.js';

const DEFAULT_USER_ID = 'default';

const ModifyBodySchema = Type.Object({
  stopLoss:   Type.Number({ minimum: 0 }),
  takeProfit: Type.Number({ minimum: 0 }),
});

const v1PositionsRoute: FastifyPluginAsync = async (fastify) => {
  const useCases = createTradingUseCases(fastify.broker, fastify.log);

  // GET /v1/positions — list all open positions
  fastify.get('/v1/positions', {
    schema: {
      response: {
        200: Type.Array(PositionInfoVOSchema),
        500: ErrorResponseSchema,
      },
    },
  }, async (_req, reply) => {
    const result = await useCases.getPositions.execute(DEFAULT_USER_ID);
    if (!result.ok) {
      return reply.status(500).send({ error: result.error.message });
    }
    return reply.send(result.value);
  });

  // DELETE /v1/positions/:ticket — close a position
  fastify.delete<{ Params: { ticket: string }; Querystring: { deviation?: number } }>(
    '/v1/positions/:ticket',
    {
      schema: {
        params:      Type.Object({ ticket: Type.String() }),
        querystring: Type.Object({ deviation: Type.Optional(Type.Integer({ minimum: 0 })) }),
        response: {
          204: Type.Null(),
          400: ErrorResponseSchema,
          404: ErrorResponseSchema,
        },
      },
    },
    async (req, reply) => {
      const ticket = Number(req.params.ticket);
      if (!Number.isFinite(ticket)) {
        return reply.status(400).send({ error: 'ticket must be a number' });
      }
      const deviation = req.query.deviation ?? 0;
      const result = await useCases.closePosition.execute(ticket, deviation, DEFAULT_USER_ID);
      if (!result.ok) {
        const status = result.error.type === 'NOT_FOUND' ? 404 : 400;
        return reply.status(status).send({ error: result.error.message });
      }
      return reply.status(204).send();
    },
  );

  // PATCH /v1/positions/:ticket — modify SL/TP
  fastify.patch<{ Params: { ticket: string } }>(
    '/v1/positions/:ticket',
    {
      schema: {
        params: Type.Object({ ticket: Type.String() }),
        body:   ModifyBodySchema,
        response: {
          204: Type.Null(),
          400: ErrorResponseSchema,
          404: ErrorResponseSchema,
        },
      },
    },
    async (req, reply) => {
      const ticket = Number(req.params.ticket);
      if (!Number.isFinite(ticket)) {
        return reply.status(400).send({ error: 'ticket must be a number' });
      }
      const body    = req.body as { stopLoss: number; takeProfit: number };
      const result = await useCases.modifyPosition.execute(ticket, body.stopLoss, body.takeProfit, DEFAULT_USER_ID);
      if (!result.ok) {
        const status = result.error.type === 'NOT_FOUND' ? 404 : 400;
        return reply.status(status).send({ error: result.error.message });
      }
      return reply.status(204).send();
    },
  );
};

export default v1PositionsRoute;
