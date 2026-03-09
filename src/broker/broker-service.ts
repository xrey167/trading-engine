import { TradingEngine } from '../engine/core/trading-engine.js';
import type { SymbolInfoBase } from '../engine/core/symbol.js';
import type { Bar } from '../shared/domain/bar/bar.js';
import type { Bars } from '../shared/domain/bar/bars.js';
import type { IFullBrokerAdapter } from './types.js';
import type { TypedEventBus } from '../shared/event-bus.js';
import type { AppEventMap } from '../shared/services/event-map.js';
import type { Logger } from '../shared/lib/logger.js';
import { Mutex } from '../shared/lib/mutex.js';
import { CircuitBreaker, type CircuitBreakerOptions } from '../shared/lib/circuit-breaker.js';
import { BaseService } from '../shared/services/base-service.js';
import { ServiceKind } from '../shared/services/types.js';
import { CanonicalIdRegistry } from '../shared/lib/canonical-id/index.js';

export interface BrokerServiceOptions {
  readonly id: string;
  readonly name: string;
  readonly broker: IFullBrokerAdapter;
  readonly symbol: SymbolInfoBase;
  readonly hedging: boolean;
  readonly engine?: TradingEngine;
  readonly engineMutex?: Mutex;
  readonly circuitBreaker?: CircuitBreakerOptions;
  readonly canonicalRegistry?: CanonicalIdRegistry;
}

export class BrokerService extends BaseService {
  readonly id: string;
  readonly kind = ServiceKind.Broker;
  readonly name: string;
  readonly engine: TradingEngine;
  readonly engineMutex: Mutex;
  readonly broker: IFullBrokerAdapter;
  readonly circuitBreaker: CircuitBreaker;
  readonly canonicalRegistry: CanonicalIdRegistry;

  constructor(
    opts: BrokerServiceOptions,
    eventBus: TypedEventBus<AppEventMap>,
    logger: Logger,
  ) {
    super(eventBus, logger);
    this.id = opts.id;
    this.name = opts.name;
    this.broker = opts.broker;
    this.engine = opts.engine ?? new TradingEngine(opts.symbol, opts.broker, opts.hedging);
    this.engineMutex = opts.engineMutex ?? new Mutex();
    this.circuitBreaker = new CircuitBreaker(
      opts.circuitBreaker ?? { failureThreshold: 5, resetTimeoutMs: 30_000 },
    );
    this.canonicalRegistry = opts.canonicalRegistry ?? new CanonicalIdRegistry();
  }

  async processBar(bar: Bar, bars: Bars): Promise<void> {
    const release = await this.engineMutex.acquire();
    try {
      await this.circuitBreaker.call(() => {
        this.engine.onBar(bar, bars);
        return Promise.resolve();
      });
    } finally {
      release();
    }
  }

  protected async onStart(): Promise<void> {
    await this.broker.connect();
  }

  protected async onStop(): Promise<void> {
    await this.broker.disconnect();
  }

  protected getHealthMetadata(): Record<string, unknown> {
    return {
      connected: this.broker.isConnected(),
      circuitBreaker: this.circuitBreaker.state,
    };
  }
}
