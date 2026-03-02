import type { FastifyPluginAsync } from 'fastify';
import { Side } from '../../../trading-engine.js';
import { Type } from '@sinclair/typebox';
import {
  PositionSlotSchema,
  ErrorResponseSchema,
  OkResponseSchema,
  PutPositionSlTpBodySchema,
  type PutPositionSlTpBody,
} from '../../schemas/index.js';

const positionsRoute: FastifyPluginAsync = async (fastify) => {
  // GET /positions
  fastify.get('/positions', {
    schema: {
      response: {
        200: Type.Object({
          long:  PositionSlotSchema,
          short: PositionSlotSchema,
        }),
      },
    },
  }, async (_req, reply) => {
    const { engine } = fastify;
    const toSlot = (side: typeof Side[keyof typeof Side]) => ({
      side,
      size:          side === Side.Long ? engine.getSizeBuy()           : engine.getSizeSell(),
      openPrice:     side === Side.Long ? engine.getBEBuy()             : engine.getBESell(),
      openTime:      (side === Side.Long ? engine.getOpenTimeBuy() : engine.getOpenTimeSell()).toISOString(),
      sl:            side === Side.Long ? engine.getSLBuy()             : engine.getSLSell(),
      tp:            side === Side.Long ? engine.getTPBuy()             : engine.getTPSell(),
      slOffsetPts:   side === Side.Long ? engine.getSlOffsetPtsBuy()    : engine.getSlOffsetPtsSell(),
      tpOffsetPts:   side === Side.Long ? engine.getTpOffsetPtsBuy()    : engine.getTpOffsetPtsSell(),
      slActive:      side === Side.Long ? engine.getSlActiveBuy()       : engine.getSlActiveSell(),
      tpActive:      side === Side.Long ? engine.getTpActiveBuy()       : engine.getTpActiveSell(),
      trailCfg:      side === Side.Long ? engine.getTrailCfgBuy()       : engine.getTrailCfgSell(),
      trailState:    (() => {
        const s = side === Side.Long ? engine.getTrailStateBuy() : engine.getTrailStateSell();
        return { active: s.active, plhRef: Number.isFinite(s.plhRef) ? s.plhRef : 0 };
      })(),
      trailActive:   side === Side.Long ? engine.getTrailActiveBuy()    : engine.getTrailActiveSell(),
      trailBeginPts: side === Side.Long ? engine.getTrailBeginPtsBuy()  : engine.getTrailBeginPtsSell(),
      beActive:      side === Side.Long ? engine.getBeActiveBuy()       : engine.getBeActiveSell(),
      beAddPts:      side === Side.Long ? engine.getBeAddPtsBuy()       : engine.getBeAddPtsSell(),
    });
    return reply.send({ long: toSlot(Side.Long), short: toSlot(Side.Short) });
  });

  // DELETE /positions/:side  — side: "long" | "short" | "all"
  fastify.delete<{ Params: { side: string } }>('/positions/:side', {
    schema: {
      params: Type.Object({ side: Type.String() }),
      response: {
        200: OkResponseSchema,
        400: ErrorResponseSchema,
      },
    },
  }, async (req, reply) => {
    const { engine } = fastify;
    switch (req.params.side) {
      case 'long':  await engine.closeBuy();  break;
      case 'short': await engine.closeSell(); break;
      case 'all':   await engine.closeAll();  break;
      default:
        return reply.status(400).send({ error: `Unknown side: ${req.params.side}` });
    }
    return reply.send({ ok: true });
  });

  // PUT /positions/:side/sl-tp  — update SL/TP/trail/BE on a live position
  fastify.put<{ Params: { side: string }; Body: PutPositionSlTpBody }>('/positions/:side/sl-tp', {
    schema: {
      params: Type.Object({ side: Type.String() }),
      body: PutPositionSlTpBodySchema,
      response: { 200: OkResponseSchema, 400: ErrorResponseSchema },
    },
  }, async (req, reply) => {
    const { engine } = fastify;
    const isLong  = req.params.side === 'long';
    const isShort = req.params.side === 'short';
    if (!isLong && !isShort)
      return reply.status(400).send({ error: `Unknown side: ${req.params.side}` });

    const b = req.body;
    if (b.sl            !== undefined) isLong ? engine.slBuy(b.sl)                   : engine.slSell(b.sl);
    if (b.tp            !== undefined) isLong ? engine.tpBuy(b.tp)                   : engine.tpSell(b.tp);
    if (b.slActive      !== undefined) isLong ? engine.slActivateBuy(b.slActive)      : engine.slActivateSell(b.slActive);
    if (b.tpActive      !== undefined) isLong ? engine.tpActivateBuy(b.tpActive)      : engine.tpActivateSell(b.tpActive);
    if (b.trailBeginPts !== undefined) isLong ? engine.trailBeginBuy(b.trailBeginPts) : engine.trailBeginSell(b.trailBeginPts);
    if (b.beActive      !== undefined) isLong ? engine.beActivateBuy(b.beActive)      : engine.beActivateSell(b.beActive);
    if (b.beAddPts      !== undefined) isLong ? engine.beBuy(b.beAddPts)              : engine.beSell(b.beAddPts);

    return reply.send({ ok: true });
  });
};

export default positionsRoute;
