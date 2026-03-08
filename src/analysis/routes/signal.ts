import type { FastifyPluginAsync } from 'fastify';
import { Type } from '@sinclair/typebox';
import { OHLCSchema, ErrorResponseSchema } from '../../shared/schemas/common.js';
import { Bars } from '../../market-data/bars.js';
import { RunSignalUseCase } from '../use-cases/run-signal.js';
import { RunMode } from '../strategies/types.js';
import { flatPositionState, parseBars } from '../helpers.js';
import { createStrategy } from '../strategies/strategy-factory.js';

const SignalBodySchema = Type.Object({
  bars:     Type.Array(OHLCSchema, { minItems: 1 }),
  strategy: Type.Optional(Type.Union([
    Type.Literal('CandleAtr'),
    Type.Literal('VolumeBreakout'),
  ])),
  symbol:    Type.Optional(Type.String()),
  timeframe: Type.Optional(Type.String()),
});

const SignalResponseSchema = Type.Object({
  result: Type.Union([
    Type.Literal('BUY'),
    Type.Literal('SELL'),
    Type.Literal('HOLD'),
  ]),
});

const signalRoute: FastifyPluginAsync = async (fastify) => {
  fastify.post('/v1/signal', {
    schema: {
      body:     SignalBodySchema,
      response: { 200: SignalResponseSchema, 400: ErrorResponseSchema },
    },
  }, async (req, reply) => {
    const body = req.body as {
      bars: Array<{ open: number; high: number; low: number; close: number; time: string; volume?: number }>;
      strategy?: string;
      symbol?: string;
      timeframe?: string;
    };

    const ohlcs = parseBars(body.bars);
    const bars = new Bars(ohlcs);

    const strategy = createStrategy(body.strategy, fastify.log);
    await strategy.initialize();

    const useCase = new RunSignalUseCase(strategy, fastify.log);
    const result = await useCase.execute({
      isNewBar:      true,
      runMode:       RunMode.Live,
      bars,
      positionState: flatPositionState,
      symbol:        body.symbol    ?? 'EURUSD',
      timeframe:     body.timeframe ?? 'H1',
    });

    return reply.send({ result });
  });
};

export default signalRoute;
