import type { Bars } from '../../trading-engine.js';
import type { Logger } from '../lib/logger.js';
import { isBullish, bodyRange } from '../analysis/candle-analysis.js';
import { SignalResult, type ISignalStrategy, type ISignalContext, RunMode } from './types.js';

export interface VolumeBreakoutConfig {
  lookback: number;
  multiplier: number;
  minBodyRange: number;
  runMode: RunMode;
}

const DEFAULT_CONFIG: VolumeBreakoutConfig = {
  lookback: 20,
  multiplier: 1.5,
  minBodyRange: 0,
  runMode: RunMode.Live,
};

function tickVolumeAverage(bars: Bars, lookback: number): number | null {
  if (bars.length < lookback) return null;
  let sum = 0;
  for (let i = 0; i < lookback; i++) {
    const c = bars.candle(i);
    sum += c.volume ?? 0;
  }
  return sum / lookback;
}

export class VolumeBreakoutStrategy implements ISignalStrategy {
  private readonly config: VolumeBreakoutConfig;
  private cachedAverageVolume = 0;

  constructor(config: Partial<VolumeBreakoutConfig> = {}, private readonly logger: Logger) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  async initialize(): Promise<void> {
    this.cachedAverageVolume = 0;
  }

  async evaluate(context: ISignalContext): Promise<SignalResult> {
    if (context.isNewBar) {
      const avg = tickVolumeAverage(context.bars, this.config.lookback);
      this.cachedAverageVolume = avg ?? 0;
    }

    if (this.cachedAverageVolume === 0) {
      return SignalResult.HOLD;
    }

    if (!context.positionState.isFlat()) {
      return SignalResult.HOLD;
    }

    const bar = context.bars.candle(context.runMode === RunMode.Live ? 0 : 1);
    if (!bar) return SignalResult.HOLD;

    if (bodyRange(bar) < this.config.minBodyRange) {
      return SignalResult.HOLD;
    }

    const threshold = this.cachedAverageVolume * this.config.multiplier;
    if ((bar.volume ?? 0) >= threshold) {
      return isBullish(bar) ? SignalResult.BUY : SignalResult.SELL;
    }

    return SignalResult.HOLD;
  }
}
