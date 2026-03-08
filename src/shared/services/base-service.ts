import type { TypedEventBus } from '../event-bus.js';
import type { Logger } from '../lib/logger.js';
import type { AppEventMap } from './event-map.js';
import { ServiceStatus, type IService, type ServiceKind, type ServiceHealth } from './types.js';

export abstract class BaseService implements IService {
  abstract readonly id: string;
  abstract readonly kind: ServiceKind;
  abstract readonly name: string;
  protected status: ServiceStatus = ServiceStatus.Stopped;
  protected lastError: string | null = null;

  constructor(
    protected readonly eventBus: TypedEventBus<AppEventMap>,
    protected readonly logger: Logger,
  ) {}

  async start(): Promise<void> {
    this.status = ServiceStatus.Starting;
    try {
      await this.onStart();
      this.status = ServiceStatus.Running;
    } catch (e) {
      this.status = ServiceStatus.Error;
      this.lastError = e instanceof Error ? e.message : String(e);
      throw e;
    }
  }

  async stop(): Promise<void> {
    this.status = ServiceStatus.Stopping;
    try {
      await this.onStop();
    } finally {
      this.status = ServiceStatus.Stopped;
    }
  }

  health(): ServiceHealth {
    return {
      status: this.status,
      lastCheckedAt: this.status === ServiceStatus.Running ? new Date().toISOString() : null,
      error: this.lastError,
      metadata: this.getHealthMetadata(),
    };
  }

  protected abstract onStart(): Promise<void>;
  protected abstract onStop(): Promise<void>;
  protected getHealthMetadata(): Record<string, unknown> { return {}; }
}
