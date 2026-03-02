import type { EventEmitter } from 'node:events';
import type { TradingEngine, SymbolInfo, AtrModule } from '../../trading-engine.js';
import type { PaperBroker } from '../plugins/broker.js';
import type { MutableAtrConfig } from '../plugins/atr.js';

declare module 'fastify' {
  interface FastifyInstance {
    engine:    TradingEngine;
    symbol:    SymbolInfo;
    emitter:   EventEmitter;
    broker:    PaperBroker;
    atrModule: AtrModule;
    atrConfig: MutableAtrConfig;
  }
}
