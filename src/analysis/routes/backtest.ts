import type { FastifyPluginAsync } from 'fastify';
import { Type } from '@sinclair/typebox';
import { OHLCSchema, ErrorResponseSchema } from '../../shared/schemas/common.js';
import { BacktestUseCase } from '../use-cases/backtest.js';
import { flatPositionState, parseBars } from '../helpers.js';
import { createStrategy } from '../strategies/strategy-factory.js';

const BacktestBodySchema = Type.Object({
  bars:     Type.Array(OHLCSchema, { minItems: 1 }),
  strategy: Type.Optional(Type.Union([
    Type.Literal('CandleAtr'),
    Type.Literal('VolumeBreakout'),
  ])),
  symbol:    Type.Optional(Type.String()),
  timeframe: Type.Optional(Type.String()),
});

const BacktestResponseSchema = Type.Object({
  signalCount: Type.Integer(),
  buyCount:    Type.Integer(),
  sellCount:   Type.Integer(),
  holdCount:   Type.Integer(),
});

const backtestRoute: FastifyPluginAsync = async (fastify) => {
  fastify.post('/v1/backtest', {
    schema: {
      body:     BacktestBodySchema,
      response: { 200: BacktestResponseSchema, 400: ErrorResponseSchema },
    },
  }, async (req, reply) => {
    const body = req.body as {
      bars: Array<{ open: number; high: number; low: number; close: number; time: string; volume?: number }>;
      strategy?: string;
      symbol?: string;
      timeframe?: string;
    };

    const ohlcs = parseBars(body.bars);
    const strategy = createStrategy(body.strategy, fastify.log);

    const useCase = new BacktestUseCase(strategy, fastify.log);
    const summary = await useCase.execute({
      ohlcs,
      symbol:        body.symbol    ?? 'EURUSD',
      timeframe:     body.timeframe ?? 'H1',
      positionState: flatPositionState,
    });

    return reply.send(summary);
  });
};

export default backtestRoute;
