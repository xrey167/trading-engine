import type Redis from 'ioredis';
import type { OHLCBody } from '../shared/schemas/common.js';
import type { Logger } from '../shared/lib/logger.js';
import type { IBarCache } from './data-provider-types.js';
import { InMemoryBarCache } from './bar-cache.js';

/**
 * Redis-backed bar cache that implements {@link IBarCache} with synchronous reads.
 *
 * Uses a **write-through** pattern:
 * - Reads always come from the in-memory mirror (fast, sync)
 * - Writes go to both in-memory and Redis (async, fire-and-forget)
 * - On {@link hydrate}, loads existing bars from Redis into memory
 *
 * Key schema: `bars:{symbol}:{timeframe}` → Redis List (oldest→newest via RPUSH)
 */
export class RedisBarCache implements IBarCache {
  private readonly local: InMemoryBarCache;

  constructor(
    private readonly redis: Redis,
    private readonly logger: Logger,
    private readonly maxBars = 500,
  ) {
    this.local = new InMemoryBarCache(maxBars);
  }

  private key(symbol: string, timeframe: string): string {
    return `bars:${symbol}:${timeframe}`;
  }

  push(symbol: string, timeframe: string, bar: OHLCBody): void {
    this.local.push(symbol, timeframe, bar);

    // Write-behind to Redis (fire-and-forget)
    const k = this.key(symbol, timeframe);
    this.redis
      .rpush(k, JSON.stringify(bar))
      .then(() => this.redis.ltrim(k, -this.maxBars, -1))
      .catch((err) => this.logger.error(`Redis push error: ${err.message}`));
  }

  getBars(symbol: string, timeframe: string, limit?: number): OHLCBody[] {
    return this.local.getBars(symbol, timeframe, limit);
  }

  latest(symbol: string, timeframe: string): OHLCBody | undefined {
    return this.local.latest(symbol, timeframe);
  }

  clear(symbol: string, timeframe: string): void {
    this.local.clear(symbol, timeframe);
    this.redis.del(this.key(symbol, timeframe)).catch((err) =>
      this.logger.error(`Redis clear error: ${err.message}`),
    );
  }

  /**
   * Hydrates the in-memory mirror from Redis for the given symbol/timeframe.
   * Call this on startup to restore state from a previous session.
   */
  async hydrate(symbol: string, timeframe: string): Promise<number> {
    const k = this.key(symbol, timeframe);
    try {
      const raw = await this.redis.lrange(k, 0, -1);
      let loaded = 0;
      for (const json of raw) {
        try {
          const bar: OHLCBody = JSON.parse(json);
          this.local.push(symbol, timeframe, bar);
          loaded++;
        } catch {
          // Skip malformed entries — per-entry error isolation
          this.logger.warn(`Redis hydrate: skipping malformed bar entry in ${k}`);
        }
      }
      return loaded;
    } catch (err) {
      this.logger.error(`Redis hydrate error: ${(err as Error).message}`);
      return 0;
    }
  }
}
