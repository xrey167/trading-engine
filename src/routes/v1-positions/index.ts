import type { FastifyPluginAsync } from 'fastify';
import { Type } from '@sinclair/typebox';
import { ErrorResponseSchema, PositionInfoVOSchema } from '../../schemas/index.js';
import { GetPositionsUseCase } from '../../use-cases/get-positions.js';
import { ClosePositionUseCase } from '../../use-cases/close-position.js';
import { ModifyPositionUseCase } from '../../use-cases/modify-position.js';

// Paper broker uses a fixed default userId (no auth layer)
const DEFAULT_USER_ID = 'default';

const ModifyBodySchema = Type.Object({
  stopLoss:   Type.Optional(Type.Number({ minimum: 0 })),
  takeProfit: Type.Optional(Type.Number({ minimum: 0 })),
});

const v1PositionsRoute: FastifyPluginAsync = async (fastify) => {
  const { broker, log } = fastify;

  // GET /v1/positions — list all open positions
  fastify.get('/v1/positions', {
    schema: {
      response: {
        200: Type.Array(PositionInfoVOSchema),
        500: ErrorResponseSchema,
      },
    },
  }, async (_req, reply) => {
    const useCase = new GetPositionsUseCase(broker, log);
    const result = await useCase.execute(DEFAULT_USER_ID);
    if (!result.ok) {
      return reply.status(500).send({ error: result.error.message });
    }
    return reply.send(result.value);
  });

  // DELETE /v1/positions/:ticket — close a position
  fastify.delete<{ Params: { ticket: string }; Querystring: { deviation?: string } }>(
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
      const ticket   = Number(req.params.ticket);
      const deviation = Number(req.query.deviation ?? 0);
      const useCase  = new ClosePositionUseCase(broker, log);
      const result   = await useCase.execute(ticket, deviation, DEFAULT_USER_ID);
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
      const body   = req.body as { stopLoss?: number; takeProfit?: number };
      const useCase = new ModifyPositionUseCase(broker, log);
      const result  = await useCase.execute(
        ticket,
        body.stopLoss   ?? 0,
        body.takeProfit ?? 0,
        DEFAULT_USER_ID,
      );
      if (!result.ok) {
        const status = result.error.type === 'NOT_FOUND' ? 404 : 400;
        return reply.status(status).send({ error: result.error.message });
      }
      return reply.status(204).send();
    },
  );
};

export default v1PositionsRoute;
