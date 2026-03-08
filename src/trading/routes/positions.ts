import type { FastifyPluginAsync } from 'fastify';
import { Side } from '../../shared/domain/engine-enums.js';
import { Type } from '@sinclair/typebox';
import { ErrorResponseSchema, OkResponseSchema } from '../../shared/schemas/common.js';
import {
  PositionSlotSchema,
  PutPositionSlTpBodySchema,
  PostMarketOrderBodySchema,
  type PutPositionSlTpBody,
  type PostMarketOrderBody,
} from '../schemas.js';
import { apiKeyPreHandler } from '../../shared/lib/api-utils.js';

const positionsRoute: FastifyPluginAsync = async (fastify) => {
  // GET /positions — all 16 fields + pl (Unit 6) — read-only, no auth
  fastify.get('/positions', {
    schema: {
      response: {
        200: Type.Object({
          long:  Type.Intersect([PositionSlotSchema, Type.Object({ pl: Type.Number() })]),
          short: Type.Intersect([PositionSlotSchema, Type.Object({ pl: Type.Number() })]),
        }),
      },
    },
  }, async (_req, reply) => {
    const { engine, broker } = fastify;
    const price = broker.getPrice();
    const toSlot = (side: typeof Side[keyof typeof Side]) => {
      const size = side === Side.Long ? engine.getSizeBuy() : engine.getSizeSell();
      const trailStateRaw = side === Side.Long ? engine.getTrailStateBuy() : engine.getTrailStateSell();
      return {
        side,
        size,
        openPrice:     side === Side.Long ? engine.getBEBuy()             : engine.getBESell(),
        // null when flat to avoid epoch artifact (new Date(0).toISOString())
        openTime:      size > 0
          ? (side === Side.Long ? engine.getOpenTimeBuy() : engine.getOpenTimeSell()).toISOString()
          : null,
        sl:            side === Side.Long ? engine.getSLBuy()             : engine.getSLSell(),
        tp:            side === Side.Long ? engine.getTPBuy()             : engine.getTPSell(),
        slOffsetPts:   side === Side.Long ? engine.getSlOffsetPtsBuy()    : engine.getSlOffsetPtsSell(),
        tpOffsetPts:   side === Side.Long ? engine.getTpOffsetPtsBuy()    : engine.getTpOffsetPtsSell(),
        slActive:      side === Side.Long ? engine.getSlActiveBuy()       : engine.getSlActiveSell(),
        tpActive:      side === Side.Long ? engine.getTpActiveBuy()       : engine.getTpActiveSell(),
        trailCfg:      side === Side.Long ? engine.getTrailCfgBuy()       : engine.getTrailCfgSell(),
        trailState:    { active: trailStateRaw.active, plhRef: Number.isFinite(trailStateRaw.plhRef) ? trailStateRaw.plhRef : 0 },
        trailActive:   side === Side.Long ? engine.getTrailActiveBuy()    : engine.getTrailActiveSell(),
        trailBeginPts: side === Side.Long ? engine.getTrailBeginPtsBuy()  : engine.getTrailBeginPtsSell(),
        beActive:      side === Side.Long ? engine.getBeActiveBuy()       : engine.getBeActiveSell(),
        beAddPts:      side === Side.Long ? engine.getBeAddPtsBuy()       : engine.getBeAddPtsSell(),
        pl:            side === Side.Long ? engine.getPLBuy(price)        : engine.getPLSell(price),
      };
    };
    return reply.send({ long: toSlot(Side.Long), short: toSlot(Side.Short) });
  });

  // DELETE /positions/:side  — side: "long" | "short" | "all"
  fastify.delete<{ Params: { side: string } }>('/positions/:side', {
    preHandler: [apiKeyPreHandler],
    schema: {
      params: Type.Object({ side: Type.String() }),
      response: {
        200: OkResponseSchema,
        400: ErrorResponseSchema,
      },
    },
  }, async (req, reply) => {
    const release = await fastify.engineMutex.acquire();
    try {
      const { engine } = fastify;
      switch (req.params.side) {
        case 'long':  await engine.closeBuy();  break;
        case 'short': await engine.closeSell(); break;
        case 'all':   await engine.closeAll();  break;
        default:
          return reply.status(400).send({ error: `Unknown side: ${req.params.side}` });
      }
      return reply.send({ ok: true });
    } finally {
      release();
    }
  });

  // PUT /positions/:side/sl-tp  — update SL/TP/trail/BE on a live position (Units 5 + existing)
  fastify.put<{ Params: { side: string }; Body: PutPositionSlTpBody }>('/positions/:side/sl-tp', {
    preHandler: [apiKeyPreHandler],
    schema: {
      params: Type.Object({ side: Type.String() }),
      body: PutPositionSlTpBodySchema,
      response: { 200: OkResponseSchema, 400: ErrorResponseSchema },
    },
  }, async (req, reply) => {
    const release = await fastify.engineMutex.acquire();
    try {
      const { engine } = fastify;
      const isLong  = req.params.side === 'long';
      const isShort = req.params.side === 'short';
      if (!isLong && !isShort)
        return reply.status(400).send({ error: `Unknown side: ${req.params.side}` });

      const b = req.body;
      // Offset-based SL/TP (pts from open price)
      if (b.sl            !== undefined) isLong ? engine.slBuy(b.sl)                   : engine.slSell(b.sl);
      if (b.tp            !== undefined) isLong ? engine.tpBuy(b.tp)                   : engine.tpSell(b.tp);
      if (b.slActive      !== undefined) isLong ? engine.slActivateBuy(b.slActive)      : engine.slActivateSell(b.slActive);
      if (b.tpActive      !== undefined) isLong ? engine.tpActivateBuy(b.tpActive)      : engine.tpActivateSell(b.tpActive);
      if (b.trailBeginPts !== undefined) isLong ? engine.trailBeginBuy(b.trailBeginPts) : engine.trailBeginSell(b.trailBeginPts);
      if (b.beActive      !== undefined) isLong ? engine.beActivateBuy(b.beActive)      : engine.beActivateSell(b.beActive);
      if (b.beAddPts      !== undefined) isLong ? engine.beBuy(b.beAddPts)              : engine.beSell(b.beAddPts);
      // Unit 5 — absolute SL/TP
      if (b.slAbsolute    !== undefined) isLong ? engine.slBuyAbsolute(b.slAbsolute)    : engine.slSellAbsolute(b.slAbsolute);
      if (b.tpAbsolute    !== undefined) isLong ? engine.tpBuyAbsolute(b.tpAbsolute)    : engine.tpSellAbsolute(b.tpAbsolute);
      // Unit 5 — trail mode / distance (any trail field triggers trailMode call)
      if (b.trailMode !== undefined || b.trailDistancePts !== undefined) {
        const mode    = b.trailMode       ?? (isLong ? engine.getTrailCfgBuy().mode      : engine.getTrailCfgSell().mode);
        const distPts = b.trailDistancePts ?? (isLong ? engine.getTrailCfgBuy().distancePts : engine.getTrailCfgSell().distancePts);
        const periods = b.trailPeriods     ?? (isLong ? engine.getTrailCfgBuy().periods   : engine.getTrailCfgSell().periods);
        isLong ? engine.trailModeBuy(mode, distPts, periods) : engine.trailModeSell(mode, distPts, periods);
      }
      if (b.trailActive !== undefined) isLong ? engine.trailActivateBuy(b.trailActive) : engine.trailActivateSell(b.trailActive);

      return reply.send({ ok: true });
    } finally {
      release();
    }
  });

  // POST /positions/long   — market buy  (Unit 1)
  fastify.post<{ Body: PostMarketOrderBody }>('/positions/long', {
    preHandler: [apiKeyPreHandler],
    schema: {
      body: PostMarketOrderBodySchema,
      response: { 200: OkResponseSchema, 400: ErrorResponseSchema },
    },
  }, async (req, reply) => {
    if (fastify.broker.getPrice() === 0)
      return reply.status(400).send({ error: 'No price reference — POST /bars first' });
    const release = await fastify.engineMutex.acquire();
    try {
      await fastify.engine.buy(req.body.size);
      return reply.send({ ok: true });
    } finally {
      release();
    }
  });

  // POST /positions/short  — market sell (Unit 1)
  fastify.post<{ Body: PostMarketOrderBody }>('/positions/short', {
    preHandler: [apiKeyPreHandler],
    schema: {
      body: PostMarketOrderBodySchema,
      response: { 200: OkResponseSchema, 400: ErrorResponseSchema },
    },
  }, async (req, reply) => {
    if (fastify.broker.getPrice() === 0)
      return reply.status(400).send({ error: 'No price reference — POST /bars first' });
    const release = await fastify.engineMutex.acquire();
    try {
      await fastify.engine.sell(req.body.size);
      return reply.send({ ok: true });
    } finally {
      release();
    }
  });

  // POST /positions/hedge  — hedge all   (Unit 1)
  fastify.post('/positions/hedge', {
    preHandler: [apiKeyPreHandler],
    schema: { response: { 200: OkResponseSchema } },
  }, async (_req, reply) => {
    const release = await fastify.engineMutex.acquire();
    try {
      await fastify.engine.hedgeAll();
      return reply.send({ ok: true });
    } finally {
      release();
    }
  });

  // POST /positions/long/flat  — close long + cancel buy orders  (Unit 2)
  fastify.post('/positions/long/flat', {
    preHandler: [apiKeyPreHandler],
    schema: { response: { 200: OkResponseSchema } },
  }, async (_req, reply) => {
    const release = await fastify.engineMutex.acquire();
    try {
      await fastify.engine.flatLong();
      return reply.send({ ok: true });
    } finally {
      release();
    }
  });

  // POST /positions/short/flat — close short + cancel sell orders (Unit 2)
  fastify.post('/positions/short/flat', {
    preHandler: [apiKeyPreHandler],
    schema: { response: { 200: OkResponseSchema } },
  }, async (_req, reply) => {
    const release = await fastify.engineMutex.acquire();
    try {
      await fastify.engine.flatShort();
      return reply.send({ ok: true });
    } finally {
      release();
    }
  });

  // POST /positions/flat — close all positions + cancel all orders (Unit 2)
  fastify.post('/positions/flat', {
    preHandler: [apiKeyPreHandler],
    schema: { response: { 200: OkResponseSchema } },
  }, async (_req, reply) => {
    const release = await fastify.engineMutex.acquire();
    try {
      await fastify.engine.flat();
      return reply.send({ ok: true });
    } finally {
      release();
    }
  });
};

export default positionsRoute;
