import pg from 'pg';
import type { Pool } from 'pg';
import type { Logger } from '../shared/lib/logger.js';
import type { DrizzleDB } from '../shared/db/client.js';
import { auditEvents } from '../shared/db/schema.js';

export interface AuditEntry {
  readonly id: number;
  readonly instanceId: string;
  readonly type: string;
  readonly payload: unknown;
  readonly timestamp: string;
  readonly receivedAt: string;
}

const CHANNEL = 'te_events';
const DEFAULT_BUFFER_SIZE = 1000;

export class AuditConsumer {
  private readonly buffer: AuditEntry[] = [];
  private readonly maxSize: number;
  private nextId = 1;
  private listenClient: pg.Client | null = null;
  private started = false;

  private readonly db: DrizzleDB | null;
  private readonly pool: Pool;
  private readonly logger: Logger;

  constructor(
    pool: Pool,
    logger: Logger,
    opts?: { bufferSize?: number; db?: DrizzleDB },
  ) {
    this.pool = pool;
    this.logger = logger;
    this.maxSize = opts?.bufferSize ?? DEFAULT_BUFFER_SIZE;
    this.db = opts?.db ?? null;
  }

  async start(): Promise<void> {
    if (this.started) return;

    await this.hydrate();

    this.listenClient = new pg.Client({ connectionString: process.env.DATABASE_URL });
    await this.listenClient.connect();
    await this.listenClient.query(`LISTEN ${CHANNEL}`);

    this.listenClient.on('notification', (notification) => {
      const rowId = notification.payload;
      if (!rowId) return;
      this.pool.query<{ id: number; type: string; payload: unknown; instance_id: string; created_at: Date }>(
        'UPDATE event_queue SET processed_at = NOW() WHERE id = $1 AND processed_at IS NULL RETURNING id, type, payload, instance_id, created_at',
        [rowId],
      ).then((result) => {
        if (result.rows.length === 0) return;
        const row = result.rows[0];
        const entry: AuditEntry = {
          id: this.nextId++,
          instanceId: row.instance_id,
          type: row.type,
          payload: row.payload,
          timestamp: row.created_at.toISOString(),
          receivedAt: new Date().toISOString(),
        };
        if (this.buffer.length >= this.maxSize) this.buffer.shift();
        this.buffer.push(entry);
        this.persistEntry(entry);
      }).catch((err: Error) => {
        this.logger.error(`Audit consumer NOTIFY handler error: ${err.message}`);
      });
    });

    this.listenClient.on('error', (err) => {
      this.logger.error(`Audit consumer listen client error: ${err.message}`);
    });

    this.started = true;
    this.logger.info(`Audit consumer started (buffer=${this.maxSize})`);
  }

  async stop(): Promise<void> {
    if (!this.started) return;

    if (this.listenClient) {
      try { await this.listenClient.end(); } catch { /* already closed */ }
      this.listenClient = null;
    }

    this.started = false;
    this.logger.info('Audit consumer stopped');
  }

  query(opts?: { type?: string; since?: string; limit?: number }): AuditEntry[] {
    let result = this.buffer;

    if (opts?.type) {
      result = result.filter((e) => e.type === opts.type);
    }
    if (opts?.since) {
      const sinceMs = new Date(opts.since).getTime();
      result = result.filter((e) => new Date(e.timestamp).getTime() >= sinceMs);
    }
    if (opts?.limit && opts.limit > 0) {
      result = result.slice(-opts.limit);
    }

    return result;
  }

  get isStarted(): boolean {
    return this.started;
  }

  get size(): number {
    return this.buffer.length;
  }

  private async hydrate(): Promise<void> {
    try {
      const rows = await this.pool.query<{ id: number; type: string; payload: unknown; instance_id: string; created_at: Date }>(
        'SELECT id, type, payload, instance_id, created_at FROM event_queue WHERE processed_at IS NOT NULL ORDER BY id DESC LIMIT $1',
        [this.maxSize],
      );
      const reversed = rows.rows.reverse();
      for (const row of reversed) {
        const entry: AuditEntry = {
          id: this.nextId++,
          instanceId: row.instance_id,
          type: row.type,
          payload: row.payload,
          timestamp: row.created_at.toISOString(),
          receivedAt: row.created_at.toISOString(),
        };
        this.buffer.push(entry);
      }
      if (reversed.length > 0) {
        this.logger.info(`Audit consumer hydrated ${reversed.length} events from event_queue`);
      }
    } catch (err) {
      this.logger.error(`Audit consumer hydrate error: ${(err as Error).message}`);
    }
  }

  private persistEntry(entry: AuditEntry): void {
    const db = this.db;
    if (!db) return;
    void (async () => {
      try {
        await db.insert(auditEvents).values({
          instanceId: entry.instanceId,
          type: entry.type,
          payload: entry.payload as Record<string, unknown>,
          timestamp: new Date(entry.timestamp),
          receivedAt: new Date(entry.receivedAt),
        });
      } catch (err) {
        this.logger.error(`Audit PG write error: ${(err as Error).message}`);
      }
    })();
  }
}
