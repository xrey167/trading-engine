import type { FastifyPluginAsync } from 'fastify';
import {
  ServiceSummarySchema,
  ServiceDetailSchema,
  AggregateHealthSchema,
  ServiceIdParamsSchema,
  type ServiceIdParams,
} from './schemas.js';
import { Type } from '@sinclair/typebox';
import { ErrorResponseSchema } from '../shared/schemas/common.js';
import { apiKeyPreHandler } from '../shared/lib/api-utils.js';
import { ServiceKind } from '../shared/services/types.js';
import { StrategyService } from '../analysis/strategy-service.js';
import { ScreenerService } from '../analysis/screener-service.js';
import { RiskManagerService } from '../managers/risk-manager.js';
import { Bars } from '../market-data/bars.js';

const serviceRoutes: FastifyPluginAsync = async (fastify) => {
  const { serviceRegistry } = fastify;

  // GET /services — list all services
  fastify.get('/services', {
    schema: {
      response: { 200: Type.Array(ServiceSummarySchema) },
    },
  }, async () => {
    return serviceRegistry.list();
  });

  // GET /services/health — aggregate health
  fastify.get('/services/health', {
    schema: {
      response: { 200: AggregateHealthSchema },
    },
  }, async () => {
    const all = serviceRegistry.healthAll();
    const list = serviceRegistry.list();
    return {
      total:    all.length,
      running:  all.filter(h => h.status === 'RUNNING').length,
      stopped:  all.filter(h => h.status === 'STOPPED').length,
      error:    all.filter(h => h.status === 'ERROR').length,
      degraded: all.filter(h => h.status === 'DEGRADED').length,
      services: all.map((h, i) => ({
        id: list[i].id, status: h.status, error: h.error,
      })),
    };
  });

  // GET /services/:id — service detail
  fastify.get<{ Params: ServiceIdParams }>('/services/:id', {
    schema: {
      params: ServiceIdParamsSchema,
      response: {
        200: ServiceDetailSchema,
        404: ErrorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const result = serviceRegistry.get(request.params.id);
    if (!result.ok) {
      return reply.status(404).send({ error: result.error.message });
    }
    const svc = result.value;
    return {
      id: svc.id,
      kind: svc.kind,
      name: svc.name,
      health: svc.health(),
    };
  });

  // POST /services/:id/start — start a service
  fastify.post<{ Params: ServiceIdParams }>('/services/:id/start', {
    preHandler: [apiKeyPreHandler],
    schema: {
      params: ServiceIdParamsSchema,
      response: {
        200: ServiceDetailSchema,
        404: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const result = serviceRegistry.get(request.params.id);
    if (!result.ok) {
      return reply.status(404).send({ error: result.error.message });
    }
    const svc = result.value;
    try {
      await svc.start();
    } catch (e) {
      return reply.status(500).send({ error: e instanceof Error ? e.message : String(e) });
    }
    return {
      id: svc.id,
      kind: svc.kind,
      name: svc.name,
      health: svc.health(),
    };
  });

  // POST /services/:id/stop — stop a service
  fastify.post<{ Params: ServiceIdParams }>('/services/:id/stop', {
    preHandler: [apiKeyPreHandler],
    schema: {
      params: ServiceIdParamsSchema,
      response: {
        200: ServiceDetailSchema,
        404: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const result = serviceRegistry.get(request.params.id);
    if (!result.ok) {
      return reply.status(404).send({ error: result.error.message });
    }
    const svc = result.value;
    try {
      await svc.stop();
    } catch (e) {
      return reply.status(500).send({ error: e instanceof Error ? e.message : String(e) });
    }
    return {
      id: svc.id,
      kind: svc.kind,
      name: svc.name,
      health: svc.health(),
    };
  });
  // POST /services/strategies/:id/evaluate — on-demand strategy evaluation
  fastify.post<{ Params: ServiceIdParams }>('/services/strategies/:id/evaluate', {
    preHandler: [apiKeyPreHandler],
    schema: {
      params: ServiceIdParamsSchema,
      response: {
        200: Type.Object({
          action: Type.Union([Type.Literal('BUY'), Type.Literal('SELL'), Type.Literal('HOLD')]),
        }),
        400: ErrorResponseSchema,
        404: ErrorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const result = serviceRegistry.get(request.params.id);
    if (!result.ok) {
      return reply.status(404).send({ error: result.error.message });
    }
    const svc = result.value;
    if (svc.kind !== ServiceKind.Strategy || !(svc instanceof StrategyService)) {
      return reply.status(400).send({ error: `Service '${request.params.id}' is not a strategy` });
    }
    // Minimal context for on-demand evaluation
    const context = {
      isNewBar: true,
      runMode: 'LIVE' as const,
      bars: new Bars([]),
      positionState: { isFlat: () => true, longCount: () => 0, shortCount: () => 0 },
      symbol: 'UNKNOWN',
      timeframe: 'H1',
    };
    const signal = await svc.evaluate(context);
    return { action: signal };
  });

  // POST /services/screeners/:id/scan — on-demand screener scan
  fastify.post<{ Params: ServiceIdParams }>('/services/screeners/:id/scan', {
    preHandler: [apiKeyPreHandler],
    schema: {
      params: ServiceIdParamsSchema,
      response: {
        200: Type.Object({
          matches: Type.Array(Type.Unknown()),
        }),
        400: ErrorResponseSchema,
        404: ErrorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const result = serviceRegistry.get(request.params.id);
    if (!result.ok) {
      return reply.status(404).send({ error: result.error.message });
    }
    const svc = result.value;
    if (svc.kind !== ServiceKind.Screener || !(svc instanceof ScreenerService)) {
      return reply.status(400).send({ error: `Service '${request.params.id}' is not a screener` });
    }
    const matches = await svc.scan();
    return { matches };
  });
  // POST /services/risk/validate — on-demand risk validation
  fastify.post<{ Body: { symbol: string; direction: 'BUY' | 'SELL'; lots: number } }>('/services/risk/validate', {
    preHandler: [apiKeyPreHandler],
    schema: {
      body: Type.Object({
        symbol: Type.String(),
        direction: Type.Union([Type.Literal('BUY'), Type.Literal('SELL')]),
        lots: Type.Number({ minimum: 0 }),
      }),
      response: {
        200: Type.Object({
          approved: Type.Boolean(),
          reason: Type.String(),
        }),
        404: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
  }, async (_request, reply) => {
    const riskManagers = serviceRegistry.getByKind(ServiceKind.RiskManager);
    if (riskManagers.length === 0) {
      return reply.status(404).send({ error: 'No risk manager service registered' });
    }
    const svc = riskManagers[0];
    if (!(svc instanceof RiskManagerService)) {
      return reply.status(500).send({ error: 'Risk manager service is not a RiskManagerService' });
    }
    const result = svc.validateOrder(_request.body);
    if (!result.ok) {
      return reply.status(500).send({ error: result.error.message });
    }
    return result.value;
  });
};

export default serviceRoutes;
