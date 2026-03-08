import type amqplib from 'amqplib';
import { randomUUID } from 'node:crypto';
import type { TypedEventBus } from '../event-bus.js';
import type { AppEventMap } from '../services/event-map.js';
import type { BridgeableEvent } from './redis-event-bridge.js';
import type { Logger } from './logger.js';
import { CircuitBreaker, type CircuitBreakerOptions } from './circuit-breaker.js';

interface AmqpEnvelope {
  readonly instanceId: string;
  readonly type: string;
  readonly payload: unknown;
  readonly timestamp: string;
}

const EXCHANGE = 'te.events';

/** Persistent delivery mode for critical events (disk-backed). */
const PERSISTENT_EVENTS = new Set<string>(['order', 'risk']);

/**
 * Bridges selected AppEventMap events across process boundaries via AMQP
 * (RabbitMQ) topic exchange.
 *
 * Mirrors RedisEventBridge: echo prevention, type validation, local handler cleanup.
 * Additionally uses ConfirmChannel for publisher confirms and persistent messages
 * for critical events.
 */
export class AmqpEventBridge {
  private readonly instanceId = randomUUID();
  private readonly allowedEvents: ReadonlySet<string>;
  private readonly localHandlers = new Map<string, (payload: unknown) => void>();
  private readonly cb: CircuitBreaker;
  private consumerTag: string | null = null;
  private queueName: string;
  private started = false;

  constructor(
    private readonly eventBus: TypedEventBus<AppEventMap>,
    private readonly channel: amqplib.ConfirmChannel,
    private readonly events: readonly BridgeableEvent[],
    private readonly logger: Logger,
    cbOpts?: CircuitBreakerOptions,
  ) {
    this.allowedEvents = new Set(events);
    this.queueName = `te.instance.${this.instanceId}`;
    this.cb = new CircuitBreaker(cbOpts ?? { failureThreshold: 5, resetTimeoutMs: 30_000 });
  }

  async start(): Promise<void> {
    if (this.started) return;

    // Declare durable topic exchange (idempotent)
    await this.channel.assertExchange(EXCHANGE, 'topic', { durable: true });

    // Per-instance queue: auto-delete, non-durable
    await this.channel.assertQueue(this.queueName, {
      autoDelete: true,
      durable: false,
    });

    // Bind each event type
    for (const event of this.events) {
      await this.channel.bindQueue(this.queueName, EXCHANGE, `event.${event}`);
    }

    // Consume from per-instance queue
    const { consumerTag } = await this.channel.consume(
      this.queueName,
      (msg) => {
        if (!msg) return; // consumer cancelled by broker
        try {
          const envelope: AmqpEnvelope = JSON.parse(msg.content.toString());
          this.channel.ack(msg);
          if (envelope.instanceId === this.instanceId) return; // echo prevention
          if (!this.allowedEvents.has(envelope.type)) return; // type validation
          const eventType = envelope.type as BridgeableEvent;
          this.eventBus.emit(eventType, envelope.payload as AppEventMap[typeof eventType]);
        } catch (err) {
          this.channel.ack(msg); // ack bad messages to avoid redelivery loops
          this.logger.error(`AMQP bridge parse error: ${(err as Error).message}`);
        }
      },
      { noAck: false },
    );
    this.consumerTag = consumerTag;

    // Local bus → publish to AMQP
    for (const event of this.events) {
      const handler = (payload: unknown) => {
        const envelope: AmqpEnvelope = {
          instanceId: this.instanceId,
          type: event,
          payload,
          timestamp: new Date().toISOString(),
        };
        const content = Buffer.from(JSON.stringify(envelope));
        const options: amqplib.Options.Publish = {
          contentType: 'application/json',
          ...(PERSISTENT_EVENTS.has(event) ? { deliveryMode: 2 } : {}),
        };

        this.cb.call(async () => {
          const drained = this.channel.publish(EXCHANGE, `event.${event}`, content, options);
          if (!drained) throw new Error('AMQP channel backpressure — too many unconfirmed messages');
        }).catch((err) =>
          this.logger.error(`AMQP bridge publish error: ${(err as Error).message}`),
        );
      };
      this.localHandlers.set(event, handler);
      this.eventBus.on(event, handler as (p: AppEventMap[typeof event]) => void);
    }

    this.started = true;
    this.logger.info(
      `AMQP event bridge started (instance=${this.instanceId.slice(0, 8)}…, events=${this.events.join(',')})`,
    );
  }

  async stop(): Promise<void> {
    if (!this.started) return;

    // Remove local listeners
    for (const [event, handler] of this.localHandlers) {
      this.eventBus.off(event as BridgeableEvent, handler as (p: AppEventMap[BridgeableEvent]) => void);
    }
    this.localHandlers.clear();

    // Cancel consumer
    if (this.consumerTag) {
      try { await this.channel.cancel(this.consumerTag); } catch { /* already cancelled */ }
      this.consumerTag = null;
    }

    // Delete per-instance queue (cleanup)
    try { await this.channel.deleteQueue(this.queueName); } catch { /* already gone */ }

    this.started = false;
    this.logger.info('AMQP event bridge stopped');
  }

  get isStarted(): boolean {
    return this.started;
  }
}
