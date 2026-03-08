import type { FastifyPluginAsync } from 'fastify';
import { Type } from '@sinclair/typebox';
import { ScaledOrderEngine, SCALED_ORDER_PRESETS } from '../../trading/scaled-orders/engine.js';
import { Bars } from '../../shared/domain/bar/bars.js';
import { ErrorResponseSchema } from '../../shared/schemas/common.js';
import {
  PostScaledOrdersBodySchema,
  type PostScaledOrdersBody,
  ScaledOrderResultSchema,
} from '../schemas.js';
import { apiKeyPreHandler } from '../../shared/lib/api-utils.js';

const scaledOrdersRoute: FastifyPluginAsync = async (fastify) => {
  // POST /scaled-orders — place a full order grid using a named preset (Unit 7)
  fastify.post<{ Body: PostScaledOrdersBody }>('/scaled-orders', {
    preHandler: [apiKeyPreHandler],
    schema: {
      body: PostScaledOrdersBodySchema,
      response: {
        200: Type.Union([
          // single side result
          ScaledOrderResultSchema,
          // both sides result
          Type.Object({ long: ScaledOrderResultSchema, short: ScaledOrderResultSchema }),
        ]),
        400: ErrorResponseSchema,
      },
    },
  }, async (req, reply) => {
    const { side, preset, currentPrice, dailyBars: rawDailyBars } = req.body;
    const { engine, symbol } = fastify;

    // Validate preset exists before constructing
    const presetDef = SCALED_ORDER_PRESETS[preset];
    if (!presetDef) return reply.status(400).send({ error: `Unknown preset: ${preset}` });

    // ATR-based presets need bars to compute distances; reject early to avoid silent zero-dist orders
    if (presetDef.atrMode !== 'None' && !rawDailyBars) {
      return reply.status(400).send({ error: `Preset '${preset}' uses ATR (${presetDef.atrMode}) and requires dailyBars` });
    }

    let soe: ScaledOrderEngine;
    try {
      soe = new ScaledOrderEngine(engine, symbol, preset);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return reply.status(400).send({ error: msg });
    }

    // Build a minimal Bars object from the body's dailyBars if provided
    const currentBars = new Bars(
      (rawDailyBars ?? []).map(b => ({
        open:   b.open,
        high:   b.high,
        low:    b.low,
        close:  b.close,
        time:   new Date(b.time),
        volume: b.volume,
      })),
    );

    if (rawDailyBars) soe.setDailyBars(currentBars);

    const release = await fastify.engineMutex.acquire();
    try {
      if (side === 'long') {
        const result = await soe.placeLong(currentBars, currentPrice);
        return reply.send({ orderIds: result.orderIds, baseDist: result.baseDist, slDist: result.slDist });
      }
      if (side === 'short') {
        const result = await soe.placeShort(currentBars, currentPrice);
        return reply.send({ orderIds: result.orderIds, baseDist: result.baseDist, slDist: result.slDist });
      }
      // both
      const result = await soe.placeBoth(currentBars, currentPrice);
      return reply.send({
        long:  { orderIds: result.long.orderIds,  baseDist: result.long.baseDist,  slDist: result.long.slDist  },
        short: { orderIds: result.short.orderIds, baseDist: result.short.baseDist, slDist: result.short.slDist },
      });
    } finally {
      release();
    }
  });
};

export default scaledOrdersRoute;
