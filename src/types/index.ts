import type { EventEmitter } from 'node:events';
import type { TradingEngine, SymbolInfo, AtrModule } from '../../trading-engine.js';
import type { IFullBrokerAdapter } from '../gateways/types.js';
import type { MutableAtrConfig } from '../plugins/atr.js';
import type { Mutex } from '../lib/mutex.js';

declare module 'fastify' {
  interface FastifyInstance {
    engine:      TradingEngine;
    symbol:      SymbolInfo;
    emitter:     EventEmitter;
    broker:      IFullBrokerAdapter;
    atrModule:   AtrModule;
    atrConfig:   MutableAtrConfig;
    engineMutex: Mutex;
  }
}
