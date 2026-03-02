import type { FastifyPluginAsync } from 'fastify';
import {
  PutEngineConfigBodySchema,
  type PutEngineConfigBody,
  OkResponseSchema,
} from '../../schemas/index.js';

const engineRoute: FastifyPluginAsync = async (fastify) => {
  // PUT /engine/config — update engine-level flags (Unit 6)
  fastify.put<{ Body: PutEngineConfigBody }>('/engine/config', {
    schema: {
      body: PutEngineConfigBodySchema,
      response: { 200: OkResponseSchema },
    },
  }, async (req, reply) => {
    const { removeOrdersOnFlat } = req.body;
    if (removeOrdersOnFlat !== undefined)
      fastify.engine.aeRemoveOrdersFlat(removeOrdersOnFlat);
    return reply.send({ ok: true });
  });
};

export default engineRoute;
