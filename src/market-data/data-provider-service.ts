import type { TypedEventBus } from '../shared/event-bus.js';
import type { AppEventMap } from '../shared/services/event-map.js';
import type { Logger } from '../shared/lib/logger.js';
import type { OHLCBody } from '../shared/schemas/common.js';
import { BaseService } from '../shared/services/base-service.js';
import { ServiceKind } from '../shared/services/types.js';
import type { DataProviderConfig, IBarCache } from './data-provider-types.js';

export interface IDataFetcher {
  fetchBars(symbol: string, timeframe: string): Promise<OHLCBody[]>;
}

export class DataProviderService extends BaseService {
  readonly id: string;
  readonly kind = ServiceKind.DataProvider;
  readonly name: string;
  private readonly config: DataProviderConfig;
  private readonly fetcher: IDataFetcher;
  private readonly cache: IBarCache;
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    config: DataProviderConfig,
    fetcher: IDataFetcher,
    cache: IBarCache,
    eventBus: TypedEventBus<AppEventMap>,
    logger: Logger,
  ) {
    super(eventBus, logger);
    this.id = config.id;
    this.name = config.name;
    this.config = config;
    this.fetcher = fetcher;
    this.cache = cache;
  }

  protected async onStart(): Promise<void> {
    this.timer = setInterval(() => { void this.poll(); }, this.config.pollIntervalMs);
  }

  protected async onStop(): Promise<void> {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private async poll(): Promise<void> {
    for (const symbol of this.config.symbols) {
      try {
        const bars = await this.fetcher.fetchBars(symbol, this.config.timeframe);
        for (const bar of bars) {
          const latest = this.cache.latest(symbol, this.config.timeframe);
          if (latest !== undefined && bar.time <= latest.time) {
            continue;
          }
          this.cache.push(symbol, this.config.timeframe, bar);
          this.eventBus.emit('normalized_bar', {
            providerId: this.id,
            symbol,
            timeframe: this.config.timeframe,
            bar,
            timestamp: new Date().toISOString(),
          });
        }
      } catch (e) {
        this.logger.error(`DataProviderService ${this.id} poll error for ${symbol}: ${e}`);
      }
    }
  }

  getCache(): IBarCache {
    return this.cache;
  }
}
