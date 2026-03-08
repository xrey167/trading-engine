import { orderEvents } from './schema.js';
import type { DrizzleDB } from './client.js';
import type { TypedEventBus } from '../event-bus.js';
import type { AppEventMap, OrderEvent } from '../services/event-map.js';
import type { Logger } from '../lib/logger.js';

export class OrderWriter {
  constructor(
    private readonly db: DrizzleDB,
    emitter: TypedEventBus<AppEventMap>,
    private readonly logger: Logger,
  ) {
    emitter.on('order', (event: OrderEvent) => this.onOrder(event));
  }

  private onOrder(event: AppEventMap['order']): void {
    this.db.insert(orderEvents).values({
      orderId:    event.orderId,
      action:     event.action,
      orderType:  event.orderType,
      source:     event.source,
      symbol:     event.symbol,
      direction:  event.direction,
      lots:       event.lots,
      price:      event.price,
      limitPrice: event.limitPrice,
      metadata:   event.metadata,
      timestamp:  event.timestamp,
    }).catch((err: unknown) => {
      this.logger.error(`OrderWriter insert error: ${(err as Error).message}`);
    });
  }
}
