import type amqplib from 'amqplib';
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

const EXCHANGE = 'te.events';
const AUDIT_QUEUE = 'te.audit';
const DEFAULT_BUFFER_SIZE = 1000;

/**
 * Consumes ALL bridged events from a durable queue and stores them in a ring buffer
 * for query/replay. The queue survives broker restarts.
 */
export class AuditConsumer {
  private readonly buffer: AuditEntry[] = [];
  private readonly maxSize: number;
  private nextId = 1;
  private consumerTag: string | null = null;
  private started = false;

  private readonly db: DrizzleDB | null;

  constructor(
    channel: amqplib.ConfirmChannel,
    logger: Logger,
    opts?: { bufferSize?: number; db?: DrizzleDB },
  );
  /** @deprecated Use options object instead */
  constructor(channel: amqplib.ConfirmChannel, logger: Logger, bufferSize?: number);
  constructor(
    private readonly channel: amqplib.ConfirmChannel,
    private readonly logger: Logger,
    optsOrSize?: number | { bufferSize?: number; db?: DrizzleDB },
  ) {
    const opts = typeof optsOrSize === 'object' ? optsOrSize : { bufferSize: optsOrSize };
    this.maxSize = opts?.bufferSize ?? DEFAULT_BUFFER_SIZE;
    this.db = opts?.db ?? null;
  }

  async start(): Promise<void> {
    if (this.started) return;

    // Ensure exchange exists (idempotent)
    await this.channel.assertExchange(EXCHANGE, 'topic', { durable: true });

    // Durable audit queue — survives broker restarts
    await this.channel.assertQueue(AUDIT_QUEUE, { durable: true });
    await this.channel.bindQueue(AUDIT_QUEUE, EXCHANGE, 'event.#');

    await this.channel.prefetch(50);

    const { consumerTag } = await this.channel.consume(
      AUDIT_QUEUE,
      (msg) => {
        if (!msg) return;
        try {
          const envelope = JSON.parse(msg.content.toString());
          const entry: AuditEntry = {
            id: this.nextId++,
            instanceId: envelope.instanceId ?? 'unknown',
            type: envelope.type ?? 'unknown',
            payload: envelope.payload,
            timestamp: envelope.timestamp ?? new Date().toISOString(),
            receivedAt: new Date().toISOString(),
          };

          // Ring buffer: shift oldest when full
          if (this.buffer.length >= this.maxSize) {
            this.buffer.shift();
          }
          this.buffer.push(entry);

          // Write-through to Postgres before acking (at-least-once delivery to DB)
          void (async () => {
            if (this.db) {
              try {
                const now = new Date();
                await this.db.insert(auditEvents).values({
                  instanceId: entry.instanceId,
                  type: entry.type,
                  payload: entry.payload as Record<string, unknown>,
                  timestamp: new Date(entry.timestamp),
                  receivedAt: now,
                });
              } catch (err) {
                // Log and continue — ack still fires to prevent infinite requeue loops
                this.logger.error(`Audit PG write error: ${(err as Error).message}`);
              }
            }
            this.channel.ack(msg);
          })();
        } catch (err) {
          this.channel.ack(msg); // ack bad messages to prevent redelivery loops
          this.logger.error(`Audit consumer parse error: ${(err as Error).message}`);
        }
      },
      { noAck: false },
    );
    this.consumerTag = consumerTag;

    this.started = true;
    this.logger.info(`Audit consumer started (buffer=${this.maxSize})`);
  }

  async stop(): Promise<void> {
    if (!this.started) return;

    if (this.consumerTag) {
      try { await this.channel.cancel(this.consumerTag); } catch { /* already cancelled */ }
      this.consumerTag = null;
    }

    this.started = false;
    this.logger.info('Audit consumer stopped');
  }

  query(opts?: { type?: string; since?: string; limit?: number }): AuditEntry[] {
    // Filter order: type → since → limit (most-recent N). Changing order alters results.
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
}
