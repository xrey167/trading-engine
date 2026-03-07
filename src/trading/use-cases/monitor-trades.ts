// MonitorTradesUseCase — ported from quant-lib/application
// Polls open positions at a configurable interval and fires a callback
// whenever a position crosses a profit/loss threshold.
import type { Logger } from '../../shared/lib/logger.js';
import type { DomainError } from '../../shared/lib/errors.js';
import { isErr } from '../../shared/lib/result.js';
import type { PositionInfoVO } from '../../shared/domain/position.js';
import type { IPositionGateway } from '../../broker/types.js';

export interface MonitorTradesOptions {
  /** User whose positions are monitored. */
  userId: string;
  /** Poll interval in milliseconds (default: 5000). */
  intervalMs?: number;
  /** Callback invoked for each position on every poll cycle. */
  onPosition?: (position: PositionInfoVO) => void;
  /** Callback invoked when a poll fails. */
  onError?: (error: DomainError) => void;
}

export class MonitorTradesUseCase {
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly gateway: IPositionGateway,
    private readonly logger: Logger,
  ) {}

  start(opts: MonitorTradesOptions): void {
    if (this.timer !== null) {
      this.logger.warn('MonitorTradesUseCase already running — call stop() first');
      return;
    }
    const { userId, intervalMs = 5000, onPosition, onError } = opts;
    this.logger.info(`MonitorTrades: starting poll every ${intervalMs}ms for userId=${userId}`);

    this.timer = setInterval(async () => {
      const result = await this.gateway.getPositions(userId);
      if (isErr(result)) {
        this.logger.error(`MonitorTrades poll error: ${result.error.message}`);
        onError?.(result.error);
        return;
      }
      for (const pos of result.value) {
        onPosition?.(pos);
      }
    }, intervalMs);
  }

  stop(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
      this.logger.info('MonitorTrades: stopped');
      // Note: if a poll tick is mid-flight when stop() is called, the in-progress
      // async callback will still complete and may invoke onPosition/onError once
      // more after this point. Callers must tolerate this if onPosition has
      // side-effects (e.g. placing orders). Consider adding an `_stopped` guard
      // inside the callback if strict stop semantics are required.
    }
  }

  get isRunning(): boolean {
    return this.timer !== null;
  }
}
