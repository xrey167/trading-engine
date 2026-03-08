import { accountSnapshots } from './schema.js';
import type { DrizzleDB } from './client.js';
import type { Logger } from '../lib/logger.js';
import type { TypedEventBus } from '../event-bus.js';
import type { AppEventMap, OrderEvent } from '../services/event-map.js';
import { desc, gte, lte, and, eq } from 'drizzle-orm';

export interface SnapshotBroker {
  getAccount(): Promise<{ equity: number; balance: number }>;
}

export interface SnapshotContext {
  strategy?: string;
  assetType?: string;
}

export type SnapshotRow = {
  equity: number;
  balance: number;
  strategy: string | null;
  assetType: string | null;
  trigger: string;
  timestamp: Date;
};

export interface SnapshotQuery {
  from?: Date;
  to?: Date;
  strategy?: string;
  assetType?: string;
}

/** Derive asset type from symbol name (e.g., EURUSD → forex, BTCUSD → crypto). */
export function deriveAssetType(symbol: string): string {
  const s = symbol.toUpperCase();
  if (/^(XAU|XAG|XPTUSD|XPDUSD)/.test(s)) return 'metals';
  if (/^(BTC|ETH|LTC|XRP|SOL|DOGE|ADA|DOT|AVAX|MATIC)/.test(s)) return 'crypto';
  if (/(OIL|BRENT|WTI|NATGAS|NG)/.test(s)) return 'energy';
  if (/(US500|US30|NAS100|SPX|NDX|DAX|FTSE|NI225|UK100|DE40)/.test(s)) return 'indices';
  return 'forex';
}

export class SnapshotWriter {
  private timer: ReturnType<typeof setInterval> | null = null;
  private lastEquity = 0;
  private lastEventCaptureMs = 0;
  private readonly threshold: number;
  private readonly cooldownMs: number;
  private orderHandler: ((event: AppEventMap['order']) => void) | null = null;
  private eventEmitter: TypedEventBus<AppEventMap> | null = null;

  constructor(
    private readonly db: DrizzleDB,
    private readonly broker: SnapshotBroker,
    private readonly logger: Logger,
    opts: { threshold?: number; cooldownMs?: number } = {},
  ) {
    this.threshold = opts.threshold ?? 0.01;
    this.cooldownMs = opts.cooldownMs ?? 5_000;
  }

  start(intervalMs = 60_000, emitter?: TypedEventBus<AppEventMap>): void {
    if (this.timer) return;
    this.timer = setInterval(() => this.capture('periodic'), intervalMs);
    this.capture('periodic');

    // Hybrid: also capture on significant equity changes after order fills
    if (emitter) {
      this.eventEmitter = emitter;
      this.orderHandler = (event) => {
        if (event.action === 'FILLED') this.onEquityChange(event);
      };
      emitter.on('order', this.orderHandler);
    }
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    if (this.eventEmitter && this.orderHandler) {
      this.eventEmitter.off('order', this.orderHandler);
      this.eventEmitter = null;
      this.orderHandler = null;
    }
  }

  private onEquityChange(event: OrderEvent): void {
    if (Date.now() - this.lastEventCaptureMs < this.cooldownMs) return;
    if (this.lastEquity === 0) return;

    this.broker.getAccount().then(({ equity }) => {
      if (Math.abs(equity - this.lastEquity) / this.lastEquity <= this.threshold) return;
      this.lastEventCaptureMs = Date.now();
      this.capture('event', {
        strategy: (event.metadata.strategy as string) ?? undefined,
        assetType: deriveAssetType(event.symbol),
      });
    }).catch((err) => this.logger.error(`Equity check error: ${(err as Error).message}`));
  }

  private capture(trigger: string, ctx?: SnapshotContext): void {
    this.broker.getAccount()
      .then(({ equity, balance }) => {
        this.lastEquity = equity;
        return this.db.insert(accountSnapshots).values({
          equity,
          balance,
          trigger,
          strategy: ctx?.strategy ?? null,
          assetType: ctx?.assetType ?? null,
        });
      })
      .then(() => this.logger.debug(`Account snapshot captured (${trigger})`))
      .catch((err) => this.logger.error(`Snapshot error: ${(err as Error).message}`));
  }

  async getSnapshots(query?: SnapshotQuery): Promise<SnapshotRow[]> {
    const conditions = [];
    if (query?.from) conditions.push(gte(accountSnapshots.timestamp, query.from));
    if (query?.to) conditions.push(lte(accountSnapshots.timestamp, query.to));
    if (query?.strategy) conditions.push(eq(accountSnapshots.strategy, query.strategy));
    if (query?.assetType) conditions.push(eq(accountSnapshots.assetType, query.assetType));

    const rows = await this.db
      .select({
        equity: accountSnapshots.equity,
        balance: accountSnapshots.balance,
        strategy: accountSnapshots.strategy,
        assetType: accountSnapshots.assetType,
        trigger: accountSnapshots.trigger,
        timestamp: accountSnapshots.timestamp,
      })
      .from(accountSnapshots)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(accountSnapshots.timestamp))
      .limit(5000);

    return rows;
  }
}
