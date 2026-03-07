import { BaseService } from '../shared/services/base-service.js';
import { ServiceKind } from '../shared/services/types.js';
import type { TypedEventBus } from '../shared/event-bus.js';
import type { AppEventMap } from '../shared/services/event-map.js';
import type { Logger } from '../shared/lib/logger.js';

interface ITickable {
  onTick(price: number, time: Date): Promise<void>;
}

interface IMutex {
  runExclusive<T>(fn: () => Promise<T>): Promise<T>;
}

export class TickIngestionService extends BaseService {
  readonly id   = 'ingestion:tick';
  readonly kind = ServiceKind.TickIngestion;
  readonly name = 'tick-ingestion';

  private _ticksProcessed = 0;

  constructor(
    private readonly engine: ITickable,
    private readonly mutex: IMutex,
    eventBus: TypedEventBus<AppEventMap>,
    logger: Logger,
  ) {
    super(eventBus, logger);
  }

  protected async onStart(): Promise<void> {
    this.eventBus.off('tick', this._handleTick);
    this.eventBus.on('tick', this._handleTick);
  }

  protected async onStop(): Promise<void> {
    this.eventBus.off('tick', this._handleTick);
  }

  private _handleTick = (event: AppEventMap['tick']): void => {
    const mid = (event.bid + event.ask) / 2;
    const time = new Date(event.timestamp);
    void this.mutex.runExclusive(async () => {
      try {
        await this.engine.onTick(mid, time);
        this._ticksProcessed++;
      } catch (err) {
        this.logger.error(`[TickIngestionService] onTick error: ${err}`);
      }
    });
  };

  override getHealthMetadata(): Record<string, unknown> {
    return { ticksProcessed: this._ticksProcessed };
  }
}
