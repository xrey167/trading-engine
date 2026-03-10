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
import { ok } from '../shared/lib/result.js';
import type { Result } from '../shared/lib/result.js';
import type { DomainError } from '../shared/lib/errors.js';
import type { PositionInfoVO } from '../shared/domain/position/position.js';
import type { DealInfoVO } from '../shared/domain/deal/deal.js';
import type { HistoryOrderInfoVO } from '../shared/domain/order/order.js';

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

  // ── Enriching read gateway methods ────────────────────────────────────────
  // These delegate to the underlying broker adapter and attach canonicalId from
  // the registry whenever one has been registered for the entity's native ticket.

  async getPositions(userId: string): Promise<Result<PositionInfoVO[], DomainError>> {
    const r = await this.broker.getPositions(userId);
    if (!r.ok) return r;
    return ok(r.value.map(p => this._enrichWithCanonical(p)));
  }

  async getPositionByTicket(ticket: number, userId: string): Promise<Result<PositionInfoVO, DomainError>> {
    const r = await this.broker.getPositionByTicket(ticket, userId);
    if (!r.ok) return r;
    return ok(this._enrichWithCanonical(r.value));
  }

  async closePositionByTicket(ticket: number, deviation: number, userId: string) {
    return this.broker.closePositionByTicket(ticket, deviation, userId);
  }

  async modifyPosition(ticket: number, sl: number, tp: number, userId: string) {
    return this.broker.modifyPosition(ticket, sl, tp, userId);
  }

  async getDeals(userId: string, from: Date, to: Date): Promise<Result<DealInfoVO[], DomainError>> {
    const r = await this.broker.getDeals(userId, from, to);
    if (!r.ok) return r;
    return ok(r.value.map(d => this._enrichWithCanonical(d)));
  }

  async getDealByTicket(ticket: number, userId: string): Promise<Result<DealInfoVO, DomainError>> {
    const r = await this.broker.getDealByTicket(ticket, userId);
    if (!r.ok) return r;
    return ok(this._enrichWithCanonical(r.value));
  }

  async getHistoryOrders(userId: string, from: Date, to: Date): Promise<Result<HistoryOrderInfoVO[], DomainError>> {
    const r = await this.broker.getHistoryOrders(userId, from, to);
    if (!r.ok) return r;
    return ok(r.value.map(o => this._enrichWithCanonical(o)));
  }

  // ── Private enrichment helpers ────────────────────────────────────────────

  private _enrichWithCanonical<T extends { ticket: number; canonicalId?: string }>(vo: T): T {
    const cid = this.canonicalRegistry.getCanonicalId(vo.ticket);
    return cid !== undefined ? { ...vo, canonicalId: cid } : vo;
  }
}
