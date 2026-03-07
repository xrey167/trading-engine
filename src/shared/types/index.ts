import type { TradingEngine, SymbolInfo, AtrModule } from '../../../trading-engine.js';
import type { IFullBrokerAdapter } from '../../broker/types.js';
import type { MutableAtrConfig } from '../../engine/atr-plugin.js';
import type { Mutex } from '../lib/mutex.js';
import type { TypedEventBus } from '../event-bus.js';

declare module 'fastify' {
  interface FastifyInstance {
    engine:      TradingEngine;
    symbol:      SymbolInfo;
    emitter:     TypedEventBus;
    broker:      IFullBrokerAdapter;
    atrModule:   AtrModule;
    atrConfig:   MutableAtrConfig;
    engineMutex: Mutex;
  }
}
