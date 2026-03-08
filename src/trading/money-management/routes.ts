import type { FastifyPluginAsync } from 'fastify';
import { Type } from '@sinclair/typebox';
import { ErrorResponseSchema } from '../../shared/schemas/common.js';
import { MoneyManagementFactoryConfigSchema } from './types.js';
import { CreateMoneyManagementUseCase } from './use-cases/money-management.js';

const moneyManagementRoute: FastifyPluginAsync = async (fastify) => {
  fastify.post('/v1/money-management', {
    schema: {
      body: MoneyManagementFactoryConfigSchema,
      response: {
        200: Type.Object({ valid: Type.Boolean() }),
        400: ErrorResponseSchema,
      },
    },
  }, async (req, reply) => {
    const useCase = new CreateMoneyManagementUseCase(fastify.log);
    const result  = useCase.execute(req.body);
    if (!result.ok) {
      return reply.status(400).send({ error: result.error.message });
    }
    return reply.send({ valid: true });
  });
};

export default moneyManagementRoute;
