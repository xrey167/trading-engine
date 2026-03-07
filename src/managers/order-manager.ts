import type { TypedEventBus } from '../shared/event-bus.js';
import type { AppEventMap, SignalEvent } from '../shared/services/event-map.js';
import type { Logger } from '../shared/lib/logger.js';
import { BaseService } from '../shared/services/base-service.js';
import { ServiceKind } from '../shared/services/types.js';
import type { ExecutionSaga } from './execution-saga.js';

export interface OrderManagerConfig {
  readonly id: string;
  readonly name: string;
}

export class OrderManagerService extends BaseService {
  readonly id: string;
  readonly kind = ServiceKind.OrderManager;
  readonly name: string;
  private readonly saga: ExecutionSaga;

  constructor(
    config: OrderManagerConfig,
    saga: ExecutionSaga,
    eventBus: TypedEventBus<AppEventMap>,
    logger: Logger,
  ) {
    super(eventBus, logger);
    this.id = config.id;
    this.name = config.name;
    this.saga = saga;
  }

  protected async onStart(): Promise<void> {
    this.eventBus.on('signal', this.handleSignal);
  }

  protected async onStop(): Promise<void> {
    this.eventBus.off('signal', this.handleSignal);
  }

  private handleSignal = async (event: SignalEvent): Promise<void> => {
    try {
      await this.saga.execute(event);
    } catch (e) {
      this.logger.error(`OrderManager signal handling error: ${e}`);
    }
  };
}
