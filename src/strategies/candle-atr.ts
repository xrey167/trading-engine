import type { Logger } from '../lib/logger.js';
import { isBullish, isBearish, range, tailPart, wickPart } from '../analysis/candle-analysis.js';
import { calculateATR } from '../analysis/atr.js';
import { isLocalHigh, isLocalLow } from '../analysis/local-extremes.js';
import { SignalResult, type ISignalStrategy, type ISignalContext, type CandleAtrConfig } from './types.js';

const DEFAULT_CONFIG: CandleAtrConfig = {
  atrPeriod: 14,
  atrMultiplier: 2.0,
  localWindow: 5,
  tailPartThreshold: 0.5,
  wickPartThreshold: 0.5,
  slOffsetPoints: 5,
};

export class CandleAtrStrategy implements ISignalStrategy {
  private readonly config: CandleAtrConfig;

  constructor(config: Partial<CandleAtrConfig> = {}, private readonly logger: Logger) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  async initialize(): Promise<void> {
    // stateless
  }

  async evaluate(context: ISignalContext): Promise<SignalResult> {
    const { bars, positionState } = context;

    // Need at least 2 bars
    if (bars.length < 2) return SignalResult.HOLD;

    const prevBar = bars.candle(1);
    const currentBar = bars.candle(0);

    // ATR filter
    const atr = calculateATR(bars, this.config.atrPeriod, 1);
    if (atr === null) {
      this.logger.debug('Insufficient bars for ATR — holding');
      return SignalResult.HOLD;
    }

    if (range(currentBar) < atr * this.config.atrMultiplier) {
      return SignalResult.HOLD;
    }

    // SELL: bearish previous bar + no short positions + small tail + local low
    if (isBearish(prevBar) && positionState.shortCount() === 0) {
      if (
        tailPart(prevBar) < this.config.tailPartThreshold &&
        isLocalLow(bars, this.config.localWindow, 1)
      ) {
        this.logger.info('CandleATR: SELL signal');
        return SignalResult.SELL;
      }
    }

    // BUY: bullish previous bar + no long positions + small wick + local high
    if (isBullish(prevBar) && positionState.longCount() === 0) {
      if (
        wickPart(prevBar) < this.config.wickPartThreshold &&
        isLocalHigh(bars, this.config.localWindow, 1)
      ) {
        this.logger.info('CandleATR: BUY signal');
        return SignalResult.BUY;
      }
    }

    return SignalResult.HOLD;
  }
}
