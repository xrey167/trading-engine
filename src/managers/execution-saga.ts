import type { TypedEventBus } from '../shared/event-bus.js';
import type { AppEventMap, SignalEvent } from '../shared/services/event-map.js';
import type { Logger } from '../shared/lib/logger.js';
import type { ServiceRegistry } from '../shared/services/service-registry.js';
import { Mutex } from '../shared/lib/mutex.js';
import { ServiceKind } from '../shared/services/types.js';
import { BaseService } from '../shared/services/base-service.js';
import { BrokerService } from '../broker/broker-service.js';
import type { RiskManagerService } from './risk-manager.js';
import { createCanonicalId, EntityType, type CanonicalId } from '../shared/lib/canonical-id.js';
import { CanonicalIdRegistry } from '../shared/lib/canonical-id-registry.js';

const _canonicalRegistry = new CanonicalIdRegistry();

export class ExecutionSaga extends BaseService {
  readonly id: string;
  readonly kind = ServiceKind.ExecutionSaga;
  readonly name: string;
  private readonly symbolMutexes = new Map<string, Mutex>();
  private _signalsProcessed = 0;
  private _ordersPlaced = 0;
  private _ordersRejected = 0;

  constructor(
    id: string,
    name: string,
    private readonly riskManager: RiskManagerService,
    private readonly registry: ServiceRegistry,
    eventBus: TypedEventBus<AppEventMap>,
    logger: Logger,
  ) {
    super(eventBus, logger);
    this.id = id;
    this.name = name;
  }

  protected async onStart(): Promise<void> {}
  protected async onStop(): Promise<void> {}

  protected getHealthMetadata(): Record<string, unknown> {
    return {
      signalsProcessed: this._signalsProcessed,
      ordersPlaced: this._ordersPlaced,
      ordersRejected: this._ordersRejected,
    };
  }

  async execute(signal: SignalEvent): Promise<void> {
    if (signal.action === 'HOLD') return;
    this._signalsProcessed++;

    const mutex = this.getSymbolMutex(signal.symbol);
    const release = await mutex.acquire();
    try {
      // 1. Pre-trade risk gate
      const riskResult = this.riskManager.validateOrder({
        symbol: signal.symbol,
        direction: signal.action,
        lots: 1,
      });

      if (!riskResult.ok) {
        this.logger.error(`ExecutionSaga risk validation error: ${riskResult.error.message}`);
        return;
      }

      if (!riskResult.value.approved) {
        this._ordersRejected++;
        this.logger.info(`ExecutionSaga signal rejected by risk: ${riskResult.value.reason}`);
        return;
      }

      // 2. Resolve broker
      const brokerId = (signal.metadata.brokerId as string | undefined) ?? 'broker:paper:primary';
      const brokerResult = this.registry.get(brokerId);
      if (!brokerResult.ok) {
        this.logger.error(`ExecutionSaga broker not found: ${brokerId}`);
        return;
      }

      const svc = brokerResult.value;
      if (svc.kind !== ServiceKind.Broker || !(svc instanceof BrokerService)) {
        this.logger.error(`ExecutionSaga service '${brokerId}' is not a broker`);
        return;
      }

      // 3. Execute order via broker adapter
      const price = svc.broker.getPrice();
      const orderResult = await svc.broker.placeOrder({
        userId: 'system',
        symbol: signal.symbol,
        direction: signal.action,
        lots: 1,
        price,
        stopLoss: 0,
        takeProfit: 0,
        magic: 0,
        deviation: 10,
        comment: `signal:${signal.serviceId}`,
        orderType: 'MARKET',
        filling: 'FOK',
        asyncMode: false,
      });

      if (!orderResult.ok) {
        this._ordersRejected++;
        this.riskManager.releaseCapacity(signal.symbol);
        this.eventBus.emit('order', {
          action: 'REJECTED',
          orderId: 0,
          orderType: 'UNKNOWN',
          brokerId,
          symbol: signal.symbol,
          direction: signal.action,
          lots: 1,
          price: 0,
          metadata: { error: orderResult.error.message },
          timestamp: new Date().toISOString(),
        });
        this.logger.error(`ExecutionSaga order rejected by broker: ${orderResult.error.message}`);
        return;
      }

      // 4. Emit success
      this._ordersPlaced++;
      const fillTicket = orderResult.value.ticket;
      let canonicalId: CanonicalId | undefined;
      if (fillTicket !== 0) {
        const cidResult = createCanonicalId(
          {
            broker: svc.broker.brokerSlot,
            type: EntityType.Order,
            nativeId: fillTicket,
            symbol: signal.symbol,
            strategyId: 0,
          },
          _canonicalRegistry,
          svc.broker,
        );
        if (cidResult.ok) {
          canonicalId = cidResult.value;
        } else {
          this.logger.warn(`ExecutionSaga: canonicalId creation failed — ${cidResult.error.message}`);
        }
      }
      this.eventBus.emit('order', {
        action: 'FILLED',
        orderId: fillTicket,
        orderType: 'UNKNOWN',
        brokerId,
        symbol: signal.symbol,
        direction: signal.action,
        lots: 1,
        price,
        canonicalId,
        metadata: { signalServiceId: signal.serviceId },
        timestamp: new Date().toISOString(),
      });
    } catch (e) {
      // Compensation: release risk capacity
      this._ordersRejected++;
      this.riskManager.releaseCapacity(signal.symbol);

      this.eventBus.emit('order', {
        action: 'REJECTED',
        orderId: 0,
        orderType: 'UNKNOWN',
        brokerId: (signal.metadata.brokerId as string | undefined) ?? 'broker:paper:primary',
        symbol: signal.symbol,
        direction: signal.action,
        lots: 1,
        price: 0,
        metadata: { error: e instanceof Error ? e.message : String(e) },
        timestamp: new Date().toISOString(),
      });

      this.logger.error(`ExecutionSaga order failed: ${e}`);
    } finally {
      release();
    }
  }

  private getSymbolMutex(symbol: string): Mutex {
    let mutex = this.symbolMutexes.get(symbol);
    if (!mutex) {
      mutex = new Mutex();
      this.symbolMutexes.set(symbol, mutex);
    }
    return mutex;
  }
}
