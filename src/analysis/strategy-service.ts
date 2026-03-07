import type { TypedEventBus } from '../shared/event-bus.js';
import type { AppEventMap } from '../shared/services/event-map.js';
import type { Logger } from '../shared/lib/logger.js';
import { BaseService } from '../shared/services/base-service.js';
import { ServiceKind } from '../shared/services/types.js';
import type { ISignalStrategy, ISignalContext } from './strategies/types.js';
import { SignalResult, RunMode } from './strategies/types.js';
import { createStrategy } from './strategies/strategy-factory.js';

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
      this.eventBus.on('bar', this.handleBar);
      this.eventBus.on('normalized_bar', this.handleNormalizedBar);
    }
  }

  protected async onStop(): Promise<void> {
    this.eventBus.off('bar', this.handleBar);
    this.eventBus.off('normalized_bar', this.handleNormalizedBar);
  }

  private handleBar = async (event: AppEventMap['bar']): Promise<void> => {
    try {
      // The bar event carries an OHLCBody, but we need Bars for evaluation
      // In autonomous mode, we evaluate with minimal context
      // Full context (bars array) will be available when DataProviders feed normalized_bar in Phase 5
      const { Bars } = await import('../../trading-engine.js');
      const ohlc = {
        open: event.bar.open,
        high: event.bar.high,
        low: event.bar.low,
        close: event.bar.close,
        time: new Date(event.bar.time),
        volume: event.bar.volume,
      };
      const bars = new Bars([ohlc]);

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
          metadata: {},
          timestamp: new Date().toISOString(),
        });
      }
    } catch (e) {
      this.logger.error(`StrategyService ${this.id} handleBar error: ${e}`);
    }
  };

  private handleNormalizedBar = async (event: AppEventMap['normalized_bar']): Promise<void> => {
    if (event.symbol !== this.config.symbol || event.timeframe !== this.config.timeframe) return;
    try {
      const { Bars } = await import('../../trading-engine.js');
      const ohlc = {
        open: event.bar.open,
        high: event.bar.high,
        low: event.bar.low,
        close: event.bar.close,
        time: new Date(event.bar.time),
        volume: event.bar.volume,
      };
      const bars = new Bars([ohlc]);

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
