import type { OHLCBody } from '../shared/schemas/common.js';

export interface IBarCache {
  push(symbol: string, timeframe: string, bar: OHLCBody): void;
  getBars(symbol: string, timeframe: string, limit?: number): OHLCBody[];
  latest(symbol: string, timeframe: string): OHLCBody | undefined;
  clear(symbol: string, timeframe: string): void;
}

export interface DataProviderConfig {
  readonly id: string;
  readonly name: string;
  readonly symbols: string[];
  readonly timeframe: string;
  readonly pollIntervalMs: number;
}
