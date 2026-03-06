import type { OHLC } from '../../../trading-engine.js';
import type { Logger } from '../../lib/logger.js';
import type { IPositionState, ISignalStrategy } from '../../strategies/types.js';
import { CandleAtrStrategy } from '../../strategies/candle-atr.js';
import { VolumeBreakoutStrategy } from '../../strategies/volume-breakout.js';

/** Stateless position state — always flat (no open positions). */
export const flatPositionState: IPositionState = {
  isFlat: () => true,
  longCount: () => 0,
  shortCount: () => 0,
};

/** DTO shape received from request body. */
interface OHLCDto {
  open: number;
  high: number;
  low: number;
  close: number;
  time: string;
  volume?: number;
}

/** Map body-level OHLC DTOs to domain OHLC objects. */
export function parseBars(dtos: OHLCDto[]): OHLC[] {
  return dtos.map(b => ({
    open:   b.open,
    high:   b.high,
    low:    b.low,
    close:  b.close,
    time:   new Date(b.time),
    volume: b.volume,
  }));
}

/** Create a strategy instance by name. */
export function createStrategy(name: string | undefined, log: Logger): ISignalStrategy {
  const resolved = name ?? 'CandleAtr';
  return resolved === 'VolumeBreakout'
    ? new VolumeBreakoutStrategy({}, log)
    : new CandleAtrStrategy({}, log);
}
