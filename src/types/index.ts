import type { EventEmitter } from 'node:events';
import type { TradingEngine, SymbolInfo } from '../../trading-engine.js';
import type { PaperBroker } from '../plugins/broker.js';

declare module 'fastify' {
  interface FastifyInstance {
    engine:  TradingEngine;
    symbol:  SymbolInfo;
    emitter: EventEmitter;
    broker:  PaperBroker;
  }
}
