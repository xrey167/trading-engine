import { randomUUID } from 'node:crypto';
import pg from 'pg';
import type { Pool } from 'pg';
import type { TypedEventBus } from '../event-bus.js';
import type { AppEventMap } from '../services/event-map.js';
import type { BridgeableEvent } from './redis-event-bridge.js';
import type { Logger } from './logger.js';

const CHANNEL = 'te_events';

interface PgEnvelope {
  readonly instanceId: string;
  readonly type: string;
  readonly payload: unknown;
  readonly timestamp: string;
}

export class PostgresEventBridge {
  private readonly instanceId = randomUUID();
  private readonly allowedEvents: ReadonlySet<string>;
  private readonly localHandlers = new Map<string, (payload: unknown) => void>();
  private listenClient: pg.Client | null = null;
  private started = false;

  constructor(
    private readonly pool: Pool,
    private readonly eventBus: TypedEventBus<AppEventMap>,
    private readonly events: readonly BridgeableEvent[],
    private readonly logger: Logger,
  ) {
    this.allowedEvents = new Set(events);
  }

  async start(): Promise<void> {
    if (this.started) return;

    this.listenClient = new pg.Client({ connectionString: process.env.DATABASE_URL });
    await this.listenClient.connect();
    await this.listenClient.query(`LISTEN ${CHANNEL}`);

    this.listenClient.on('notification', (notification) => {
      const rowId = notification.payload;
      if (!rowId) return;
      this.pool.query<{ type: string; payload: unknown; instance_id: string; processed_at: Date | null }>(
        'UPDATE event_queue SET processed_at = NOW() WHERE id = $1 AND processed_at IS NULL RETURNING type, payload, instance_id',
        [rowId],
      ).then((result) => {
        if (result.rows.length === 0) return;
        const row = result.rows[0];
        if (row.instance_id === this.instanceId) return;
        if (!this.allowedEvents.has(row.type)) return;
        const eventType = row.type as BridgeableEvent;
        this.eventBus.emit(eventType, row.payload as AppEventMap[typeof eventType]);
      }).catch((err: Error) => {
        this.logger.error(`PG event bridge NOTIFY handler error: ${err.message}`);
      });
    });

    this.listenClient.on('error', (err) => {
      this.logger.error(`PG event bridge listen client error: ${err.message}`);
    });

    for (const event of this.events) {
      const handler = (payload: unknown) => {
        const envelope: PgEnvelope = {
          instanceId: this.instanceId,
          type: event,
          payload,
          timestamp: new Date().toISOString(),
        };
        this.pool.query<{ id: number }>(
          'INSERT INTO event_queue (type, payload, instance_id) VALUES ($1, $2, $3) RETURNING id',
          [event, JSON.stringify(envelope), this.instanceId],
        ).then((result) => {
          const id = result.rows[0]?.id;
          if (id == null) return;
          return this.pool.query('SELECT pg_notify($1, $2)', [CHANNEL, String(id)]);
        }).catch((err: Error) => {
          this.logger.error(`PG event bridge publish error: ${err.message}`);
        });
      };
      this.localHandlers.set(event, handler);
      this.eventBus.on(event, handler as (p: AppEventMap[typeof event]) => void);
    }

    this.started = true;
    this.logger.info(
      `PG event bridge started (instance=${this.instanceId.slice(0, 8)}…, events=${this.events.join(',')})`,
    );
  }

  async stop(): Promise<void> {
    if (!this.started) return;

    for (const [event, handler] of this.localHandlers) {
      this.eventBus.off(event as BridgeableEvent, handler as (p: AppEventMap[BridgeableEvent]) => void);
    }
    this.localHandlers.clear();

    if (this.listenClient) {
      try { await this.listenClient.end(); } catch { /* already closed */ }
      this.listenClient = null;
    }

    this.started = false;
    this.logger.info('PG event bridge stopped');
  }

  get isStarted(): boolean {
    return this.started;
  }
}
