import Redis from 'ioredis';
import { randomUUID } from 'node:crypto';
import type { TypedEventBus } from '../event-bus.js';
import type { AppEventMap } from '../services/event-map.js';
import type { Logger } from './logger.js';

/** Events worth bridging across instances (not low-level engine events). */
export type BridgeableEvent = 'signal' | 'order' | 'risk' | 'normalized_bar' | 'screener' | 'tick';

interface RedisEnvelope {
  readonly instanceId: string;
  readonly type: string;
  readonly payload: unknown;
}

/**
 * Bridges selected {@link AppEventMap} events across process boundaries via
 * Redis Pub/Sub.
 *
 * - **Publish**: listens on the local `TypedEventBus` and publishes to Redis
 * - **Subscribe**: listens on Redis channels and re-emits on the local bus
 * - **Echo prevention**: each instance has a unique `instanceId`; messages
 *   from self are ignored on the subscribe side
 *
 * Channel naming: `te:{eventType}` (e.g. `te:signal`, `te:normalized_bar`)
 */
export class RedisEventBridge {
  private readonly instanceId = randomUUID();
  private readonly pub: Redis;
  private readonly sub: Redis;
  private readonly localHandlers = new Map<string, (payload: unknown) => void>();
  private started = false;

  constructor(
    private readonly eventBus: TypedEventBus<AppEventMap>,
    redisUrl: string,
    private readonly events: readonly BridgeableEvent[],
    private readonly logger: Logger,
  ) {
    // Pub/Sub requires separate connections
    this.pub = new Redis(redisUrl, { lazyConnect: true, maxRetriesPerRequest: 3 });
    this.sub = new Redis(redisUrl, { lazyConnect: true, maxRetriesPerRequest: 3 });
  }

  async start(): Promise<void> {
    if (this.started) return;
    await Promise.all([this.pub.connect(), this.sub.connect()]);

    // Subscribe to Redis channels
    const channels = this.events.map((e) => `te:${e}`);
    if (channels.length > 0) {
      await this.sub.subscribe(...channels);
    }

    // On Redis message → re-emit locally (skip own messages)
    this.sub.on('message', (_channel: string, message: string) => {
      try {
        const envelope: RedisEnvelope = JSON.parse(message);
        if (envelope.instanceId === this.instanceId) return; // echo prevention
        const eventType = envelope.type as BridgeableEvent;
        this.eventBus.emit(eventType, envelope.payload as AppEventMap[typeof eventType]);
      } catch (err) {
        this.logger.error(`Redis bridge parse error: ${(err as Error).message}`);
      }
    });

    // Local bus → publish to Redis
    for (const event of this.events) {
      const handler = (payload: unknown) => {
        const envelope: RedisEnvelope = {
          instanceId: this.instanceId,
          type: event,
          payload,
        };
        this.pub.publish(`te:${event}`, JSON.stringify(envelope)).catch((err) =>
          this.logger.error(`Redis bridge publish error: ${err.message}`),
        );
      };
      this.localHandlers.set(event, handler);
      this.eventBus.on(event, handler as (p: AppEventMap[typeof event]) => void);
    }

    this.started = true;
    this.logger.info(`Redis event bridge started (instance=${this.instanceId.slice(0, 8)}…, events=${this.events.join(',')})`);
  }

  async stop(): Promise<void> {
    if (!this.started) return;

    // Remove local listeners
    for (const [event, handler] of this.localHandlers) {
      this.eventBus.off(event as BridgeableEvent, handler as (p: AppEventMap[BridgeableEvent]) => void);
    }
    this.localHandlers.clear();

    // Unsubscribe and disconnect
    await this.sub.unsubscribe();
    this.sub.disconnect();
    this.pub.disconnect();

    this.started = false;
    this.logger.info('Redis event bridge stopped');
  }

  get isStarted(): boolean {
    return this.started;
  }
}
