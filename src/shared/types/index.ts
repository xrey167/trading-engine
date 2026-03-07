import type { TradingEngine, SymbolInfoBase, AtrModule } from '../../../trading-engine.js';
import type { IFullBrokerAdapter } from '../../broker/types.js';
import type { MutableAtrConfig } from '../../engine/atr-plugin.js';
import type { Mutex } from '../lib/mutex.js';
import type { TypedEventBus } from '../event-bus.js';
import type { AppEventMap } from '../services/event-map.js';
import type { ServiceRegistry } from '../services/service-registry.js';
import type { IBarCache } from '../../market-data/data-provider-types.js';
import type { AuditConsumer } from '../../audit/audit-consumer.js';

declare module 'fastify' {
  interface FastifyInstance {
    engine:          TradingEngine;
    symbol:          SymbolInfoBase;
    emitter:         TypedEventBus<AppEventMap>;
    broker:          IFullBrokerAdapter;
    atrModule:       AtrModule;
    atrConfig:       MutableAtrConfig;
    engineMutex:     Mutex;
    serviceRegistry: ServiceRegistry;
    barCache:        IBarCache;
    auditConsumer:   AuditConsumer | null;
  }
}
