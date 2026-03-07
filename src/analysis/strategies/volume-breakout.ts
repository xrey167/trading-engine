import type { Logger } from '../../shared/lib/logger.js';
import { SignalResult, type ISignalStrategy, type ISignalContext, RunMode } from './types.js';

export interface VolumeBreakoutConfig {
  lookback: number;
  multiplier: number;
  minBodyRange: number;
}

const DEFAULT_CONFIG: VolumeBreakoutConfig = {
  lookback: 20,
  multiplier: 1.5,
  minBodyRange: 0,
};

export class VolumeBreakoutStrategy implements ISignalStrategy {
  private readonly config: VolumeBreakoutConfig;
  private cachedAverageVolume = 0;

  constructor(config: Partial<VolumeBreakoutConfig> = {}, readonly logger: Logger) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  async initialize(): Promise<void> {
    this.cachedAverageVolume = 0;
  }

  async evaluate(context: ISignalContext): Promise<SignalResult> {
    if (context.isNewBar) {
      // When lookback > bars.length, tickVolumeAverage returns 0.
      // The cachedAverageVolume === 0 guard below returns HOLD,
      // keeping the strategy out until enough history exists.
      this.cachedAverageVolume = context.bars.length >= this.config.lookback
        ? context.bars.tickVolumeAverage(this.config.lookback)
        : 0;
    }

    if (this.cachedAverageVolume === 0) {
      return SignalResult.HOLD;
    }

    if (!context.positionState.isFlat()) {
      return SignalResult.HOLD;
    }

    const shift = context.runMode === RunMode.Live ? 0 : 1;
    if (context.bars.length <= shift) return SignalResult.HOLD;
    const bar = context.bars.bar(shift);

    if (bar.bodyRange() < this.config.minBodyRange) {
      return SignalResult.HOLD;
    }

    const threshold = this.cachedAverageVolume * this.config.multiplier;
    if ((bar.volume ?? 0) >= threshold) {
      return bar.isBullish() ? SignalResult.BUY : SignalResult.SELL;
    }

    return SignalResult.HOLD;
  }
}
