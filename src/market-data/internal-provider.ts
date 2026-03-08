import type { TypedEventBus } from '../shared/event-bus.js';
import type { AppEventMap } from '../shared/services/event-map.js';
import type { Logger } from '../shared/lib/logger.js';
import { BaseService } from '../shared/services/base-service.js';
import { ServiceKind } from '../shared/services/types.js';
import type { IBarCache } from './data-provider-types.js';

/**
 * Bridges the legacy `bar` event (emitted by `POST /bars`) into the
 * `normalized_bar` event that DataProviderService consumers expect.
 *
 * Also pushes each bar into the shared {@link IBarCache} so strategies
 * can access historical context.
 */
export class InternalProvider extends BaseService {
  readonly id = 'dp:internal';
  readonly kind = ServiceKind.DataProvider;
  readonly name = 'internal';

  constructor(
    private readonly symbol: string,
    private readonly timeframe: string,
    private readonly cache: IBarCache,
    eventBus: TypedEventBus<AppEventMap>,
    logger: Logger,
  ) {
    super(eventBus, logger);
  }

  protected async onStart(): Promise<void> {
    this.eventBus.off('bar', this.handleBar); // idempotent: prevent double-registration
    this.eventBus.on('bar', this.handleBar);
  }

  protected async onStop(): Promise<void> {
    this.eventBus.off('bar', this.handleBar);
  }

  private handleBar = (event: AppEventMap['bar']): void => {
    const bar = event.bar;
    this.cache.push(this.symbol, this.timeframe, bar);
    this.eventBus.emit('normalized_bar', {
      providerId: this.id,
      symbol: this.symbol,
      timeframe: this.timeframe,
      bar,
      timestamp: new Date().toISOString(),
    });
  };
}
