import type { OHLCBody } from '../shared/schemas/common.js';
import type { IBarCache } from './data-provider-types.js';

export class InMemoryBarCache implements IBarCache {
  private readonly cache = new Map<string, OHLCBody[]>();
  private readonly maxBars: number;

  constructor(maxBars = 1000) {
    this.maxBars = maxBars;
  }

  private key(symbol: string, timeframe: string): string {
    return `${symbol}:${timeframe}`;
  }

  push(symbol: string, timeframe: string, bar: OHLCBody): void {
    const k = this.key(symbol, timeframe);
    let bars = this.cache.get(k);
    if (!bars) {
      bars = [];
      this.cache.set(k, bars);
    }
    bars.push(bar);
    if (bars.length > this.maxBars) {
      bars.splice(0, bars.length - this.maxBars);
    }
  }

  getBars(symbol: string, timeframe: string, limit?: number): OHLCBody[] {
    const k = this.key(symbol, timeframe);
    const bars = this.cache.get(k) ?? [];
    if (limit !== undefined && limit < bars.length) {
      return bars.slice(bars.length - limit);
    }
    return [...bars];
  }

  latest(symbol: string, timeframe: string): OHLCBody | undefined {
    const bars = this.cache.get(this.key(symbol, timeframe));
    return bars && bars.length > 0 ? bars[bars.length - 1] : undefined;
  }

  clear(symbol: string, timeframe: string): void {
    this.cache.delete(this.key(symbol, timeframe));
  }
}
