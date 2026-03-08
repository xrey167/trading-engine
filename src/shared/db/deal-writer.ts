import { deals } from './schema.js';
import type { DrizzleDB } from './client.js';
import type { TypedEventBus } from '../event-bus.js';
import type { AppEventMap, OrderEvent } from '../services/event-map.js';
import type { Logger } from '../lib/logger.js';

export class DealWriter {
  constructor(
    private readonly db: DrizzleDB,
    emitter: TypedEventBus<AppEventMap>,
    private readonly logger: Logger,
  ) {
    emitter.on('order', (event: OrderEvent) => this.onOrder(event));
  }

  private onOrder(event: OrderEvent): void {
    if (event.action !== 'FILLED') return;

    this.db.insert(deals).values({
      ticket:     (event.metadata.ticket as number) ?? 0,
      symbol:     event.symbol,
      type:       event.direction,
      volume:     event.lots,
      price:      event.price,
      profit:     (event.metadata.profit as number) ?? 0,
      swap:       (event.metadata.swap as number) ?? 0,
      commission: (event.metadata.commission as number) ?? 0,
      canonicalId: event.canonicalId ?? null,
      time:        new Date(event.timestamp),
    }).then(() => {
      this.logger.debug(`Deal written: ${event.symbol} ${event.direction} ${event.lots}@${event.price}`);
    }).catch((err) => {
      this.logger.error(`Deal write error: ${(err as Error).message}`);
    });
  }
}
