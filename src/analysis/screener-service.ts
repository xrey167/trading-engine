import type { TypedEventBus } from '../shared/event-bus.js';
import type { AppEventMap } from '../shared/services/event-map.js';
import type { Logger } from '../shared/lib/logger.js';
import { BaseService } from '../shared/services/base-service.js';
import { ServiceKind } from '../shared/services/types.js';

export interface ScreenerMatch {
  readonly symbol: string;
  readonly matchType: string;
  readonly score: number;
  readonly metadata: Record<string, unknown>;
}

export interface IScreenerLogic {
  scan(symbols: string[]): Promise<ScreenerMatch[]>;
}

export interface ScreenerServiceConfig {
  readonly id: string;
  readonly name: string;
  readonly symbols: string[];
  readonly intervalMs: number;
}

export class ScreenerService extends BaseService {
  readonly id: string;
  readonly kind = ServiceKind.Screener;
  readonly name: string;
  private readonly config: ScreenerServiceConfig;
  private readonly logic: IScreenerLogic;
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    config: ScreenerServiceConfig,
    logic: IScreenerLogic,
    eventBus: TypedEventBus<AppEventMap>,
    logger: Logger,
  ) {
    super(eventBus, logger);
    this.id = config.id;
    this.name = config.name;
    this.config = config;
    this.logic = logic;
  }

  protected async onStart(): Promise<void> {
    this.timer = setInterval(() => { void this.runScan(); }, this.config.intervalMs);
  }

  protected async onStop(): Promise<void> {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private async runScan(): Promise<void> {
    try {
      const matches = await this.logic.scan(this.config.symbols);
      if (matches.length > 0) {
        this.eventBus.emit('screener', {
          serviceId: this.id,
          matchedSymbols: matches.map(m => m.symbol),
          criteria: this.name,
          metadata: { matches },
          timestamp: new Date().toISOString(),
        });
      }
    } catch (e) {
      this.logger.error(`ScreenerService ${this.id} scan error: ${e}`);
    }
  }

  async scan(symbols?: string[]): Promise<ScreenerMatch[]> {
    return this.logic.scan(symbols ?? this.config.symbols);
  }
}
