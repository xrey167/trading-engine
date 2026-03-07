import { eq, and, desc } from 'drizzle-orm';
import { bars } from '../shared/db/schema.js';
import type { DrizzleDB } from '../shared/db/client.js';
import type { OHLCBody } from '../shared/schemas/common.js';
import type { Logger } from '../shared/lib/logger.js';
import type { IBarCache } from './data-provider-types.js';
import { InMemoryBarCache } from './bar-cache.js';

/**
 * Postgres-backed bar cache that implements {@link IBarCache} with synchronous reads.
 *
 * Uses a **write-through** pattern:
 * - Reads always come from the in-memory mirror (fast, sync)
 * - Writes go to both in-memory and Postgres (async, fire-and-forget)
 * - On {@link hydrate}, loads existing bars from Postgres into memory
 */
export class PostgresBarCache implements IBarCache {
  private readonly local: InMemoryBarCache;

  constructor(
    private readonly db: DrizzleDB,
    private readonly logger: Logger,
    private readonly maxBars = 500,
  ) {
    this.local = new InMemoryBarCache(maxBars);
  }

  push(symbol: string, timeframe: string, bar: OHLCBody): void {
    this.local.push(symbol, timeframe, bar);

    // Write-through to Postgres (fire-and-forget)
    this.db.insert(bars).values({
      symbol,
      timeframe,
      time: new Date(bar.time),
      open: bar.open,
      high: bar.high,
      low: bar.low,
      close: bar.close,
      volume: bar.volume ?? null,
    }).onConflictDoNothing()
      .then(() => {})
      .catch((err) => this.logger.error(`PG bar push error: ${(err as Error).message}`));
  }

  getBars(symbol: string, timeframe: string, limit?: number): OHLCBody[] {
    return this.local.getBars(symbol, timeframe, limit);
  }

  latest(symbol: string, timeframe: string): OHLCBody | undefined {
    return this.local.latest(symbol, timeframe);
  }

  clear(symbol: string, timeframe: string): void {
    this.local.clear(symbol, timeframe);
    this.db.delete(bars)
      .where(and(eq(bars.symbol, symbol), eq(bars.timeframe, timeframe)))
      .then(() => {})
      .catch((err) => this.logger.error(`PG bar clear error: ${(err as Error).message}`));
  }

  /**
   * Hydrates the in-memory mirror from Postgres for the given symbol/timeframe.
   * Call this on startup to restore state from a previous session.
   */
  async hydrate(symbol: string, timeframe: string, limit = 1000): Promise<number> {
    try {
      const rows = await this.db
        .select()
        .from(bars)
        .where(and(eq(bars.symbol, symbol), eq(bars.timeframe, timeframe)))
        .orderBy(desc(bars.time))
        .limit(limit);

      // Rows come in descending order, reverse for chronological push
      rows.reverse();
      let loaded = 0;
      for (const row of rows) {
        this.local.push(symbol, timeframe, {
          open: row.open,
          high: row.high,
          low: row.low,
          close: row.close,
          time: row.time.toISOString(),
          volume: row.volume ?? undefined,
        });
        loaded++;
      }
      return loaded;
    } catch (err) {
      this.logger.error(`PG bar hydrate error: ${(err as Error).message}`);
      return 0;
    }
  }
}
