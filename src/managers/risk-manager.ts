import type { TypedEventBus } from '../shared/event-bus.js';
import type { AppEventMap } from '../shared/services/event-map.js';
import type { Logger } from '../shared/lib/logger.js';
import { BaseService } from '../shared/services/base-service.js';
import { ServiceKind, ServiceStatus } from '../shared/services/types.js';
import type { Result } from '../shared/lib/result.js';
import type { DomainError } from '../shared/lib/errors.js';
import { ok } from '../shared/lib/result.js';

export interface RiskManagerConfig {
  readonly id: string;
  readonly name: string;
  readonly maxOpenPositions: number;
  readonly maxPositionsPerSymbol: number;
  readonly maxDailyLoss: number;
}

export interface OrderValidationRequest {
  readonly symbol: string;
  readonly direction: 'BUY' | 'SELL';
  readonly lots: number;
}

export interface RiskValidationResult {
  readonly approved: boolean;
  readonly reason: string;
}

export class RiskManagerService extends BaseService {
  readonly id: string;
  readonly kind = ServiceKind.RiskManager;
  readonly name: string;
  private readonly config: RiskManagerConfig;
  private openPositionCount = 0;
  private readonly symbolPositions = new Map<string, number>();
  private dailyLoss = 0;

  constructor(
    config: RiskManagerConfig,
    eventBus: TypedEventBus<AppEventMap>,
    logger: Logger,
  ) {
    super(eventBus, logger);
    this.id = config.id;
    this.name = config.name;
    this.config = config;
  }

  protected async onStart(): Promise<void> {
    this.eventBus.on('order', this.handleOrder);
  }

  protected async onStop(): Promise<void> {
    this.eventBus.off('order', this.handleOrder);
  }

  private handleOrder = (event: AppEventMap['order']): void => {
    if (event.action === 'FILLED') {
      this.openPositionCount++;
      const current = this.symbolPositions.get(event.symbol) ?? 0;
      this.symbolPositions.set(event.symbol, current + 1);
    } else if (event.action === 'CANCELLED' || event.action === 'REJECTED') {
      // No position change
    }
  };

  validateOrder(request: OrderValidationRequest): Result<RiskValidationResult, DomainError> {
    // Fail-closed: if risk manager is not running, reject everything
    if (this.status !== ServiceStatus.Running) {
      return ok({ approved: false, reason: 'Risk manager is not running (fail-closed policy)' });
    }

    if (this.openPositionCount >= this.config.maxOpenPositions) {
      this.eventBus.emit('risk', {
        action: 'REJECTED',
        symbol: request.symbol,
        reason: `Max open positions (${this.config.maxOpenPositions}) reached`,
        metadata: { currentCount: this.openPositionCount },
        timestamp: new Date().toISOString(),
      });
      return ok({
        approved: false,
        reason: `Max open positions (${this.config.maxOpenPositions}) reached`,
      });
    }

    const symbolCount = this.symbolPositions.get(request.symbol) ?? 0;
    if (symbolCount >= this.config.maxPositionsPerSymbol) {
      this.eventBus.emit('risk', {
        action: 'REJECTED',
        symbol: request.symbol,
        reason: `Max positions per symbol (${this.config.maxPositionsPerSymbol}) reached for ${request.symbol}`,
        metadata: { symbolCount },
        timestamp: new Date().toISOString(),
      });
      return ok({
        approved: false,
        reason: `Max positions per symbol (${this.config.maxPositionsPerSymbol}) reached for ${request.symbol}`,
      });
    }

    if (this.dailyLoss >= this.config.maxDailyLoss) {
      this.eventBus.emit('risk', {
        action: 'LIMIT_BREACHED',
        symbol: request.symbol,
        reason: `Max daily loss (${this.config.maxDailyLoss}) reached`,
        metadata: { dailyLoss: this.dailyLoss },
        timestamp: new Date().toISOString(),
      });
      return ok({
        approved: false,
        reason: `Max daily loss (${this.config.maxDailyLoss}) reached`,
      });
    }

    this.eventBus.emit('risk', {
      action: 'APPROVED',
      symbol: request.symbol,
      reason: 'All risk checks passed',
      metadata: {},
      timestamp: new Date().toISOString(),
    });
    return ok({ approved: true, reason: 'All risk checks passed' });
  }

  releaseCapacity(symbol: string): void {
    if (this.openPositionCount > 0) this.openPositionCount--;
    const current = this.symbolPositions.get(symbol) ?? 0;
    if (current > 0) this.symbolPositions.set(symbol, current - 1);
  }

  recordLoss(amount: number): void {
    this.dailyLoss += amount;
  }

  resetDailyLoss(): void {
    this.dailyLoss = 0;
  }

  protected getHealthMetadata(): Record<string, unknown> {
    return {
      openPositionCount: this.openPositionCount,
      dailyLoss: this.dailyLoss,
    };
  }
}
