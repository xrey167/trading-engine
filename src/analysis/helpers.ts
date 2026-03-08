import type { OHLC } from '../market-data/ohlc.js';
import type { IPositionState } from './strategies/types.js';

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
