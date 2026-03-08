import type { TypedEventBus } from '../shared/event-bus.js';
import type { AppEventMap } from '../shared/services/event-map.js';
import type { Logger } from '../shared/lib/logger.js';
import { BaseService } from '../shared/services/base-service.js';
import { ServiceKind } from '../shared/services/types.js';
import type { IBarCache } from '../market-data/data-provider-types.js';
import type { ISignalStrategy, ISignalContext } from './strategies/types.js';
import { SignalResult, RunMode } from './strategies/types.js';
import { createStrategy } from './strategies/strategy-factory.js';
import { Bars } from '../shared/domain/bar/bars.js';

export interface StrategyServiceConfig {
  readonly id: string;
  readonly name: string;
  readonly strategyName: string;
  readonly symbol: string;
  readonly timeframe: string;
  readonly evaluateOnBar: boolean;
}

export class StrategyService extends BaseService {
  readonly id: string;
  readonly kind = ServiceKind.Strategy;
  readonly name: string;
  private readonly strategy: ISignalStrategy;
  private readonly config: StrategyServiceConfig;

  constructor(
    config: StrategyServiceConfig,
    eventBus: TypedEventBus<AppEventMap>,
    logger: Logger,
    private readonly barCache?: IBarCache,
  ) {
    super(eventBus, logger);
    this.id = config.id;
    this.name = config.name;
    this.config = config;
    this.strategy = createStrategy(config.strategyName, logger);
  }

  protected async onStart(): Promise<void> {
    await this.strategy.initialize();
    if (this.config.evaluateOnBar) {
      // Subscribe to normalized_bar only — InternalProvider bridges bar→normalized_bar,
      // so subscribing to both would cause duplicate evaluations per bar.
      this.eventBus.on('normalized_bar', this.handleNormalizedBar);
    }
  }

  protected async onStop(): Promise<void> {
    this.eventBus.off('normalized_bar', this.handleNormalizedBar);
  }

  private handleNormalizedBar = async (event: AppEventMap['normalized_bar']): Promise<void> => {
    if (event.symbol !== this.config.symbol || event.timeframe !== this.config.timeframe) return;
    try {
      // Build Bars from cache history when available, otherwise single bar.
      // Bars expects index 0 = most recent, so reverse the cache (oldest→newest → newest→oldest).
      const singleBarOhlc = [{
        open: event.bar.open, high: event.bar.high, low: event.bar.low, close: event.bar.close,
        time: new Date(event.bar.time), volume: event.bar.volume,
      }];

      let bars: InstanceType<typeof Bars>;
      if (this.barCache) {
        const cached = this.barCache.getBars(event.symbol, event.timeframe);
        const ohlcArray = cached.map(b => ({
          open: b.open, high: b.high, low: b.low, close: b.close,
          time: new Date(b.time), volume: b.volume,
        }));
        bars = new Bars(ohlcArray.length > 0 ? ohlcArray.reverse() : singleBarOhlc);
      } else {
        bars = new Bars(singleBarOhlc);
      }

      const context: ISignalContext = {
        isNewBar: true,
        runMode: RunMode.Live,
        bars,
        positionState: { isFlat: () => true, longCount: () => 0, shortCount: () => 0 },
        symbol: this.config.symbol,
        timeframe: this.config.timeframe,
      };

      const result = await this.strategy.evaluate(context);
      if (result !== SignalResult.HOLD) {
        this.eventBus.emit('signal', {
          serviceId: this.id,
          symbol: this.config.symbol,
          timeframe: this.config.timeframe,
          action: result,
          confidence: 1.0,
          metadata: { providerId: event.providerId },
          timestamp: new Date().toISOString(),
        });
      }
    } catch (e) {
      this.logger.error(`StrategyService ${this.id} handleNormalizedBar error: ${e}`);
    }
  };

  async evaluate(context: ISignalContext): Promise<SignalResult> {
    return this.strategy.evaluate(context);
  }
}
