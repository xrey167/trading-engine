import Redis from 'ioredis';
import type { Logger } from './logger.js';

export interface RedisClientOptions {
  url?: string;
  keyPrefix?: string;
  lazyConnect?: boolean;
}

/**
 * Creates a configured ioredis instance with reconnection backoff and logging.
 * Returns `null` when no `REDIS_URL` env var or `url` option is provided.
 */
export function createRedisClient(
  logger: Logger,
  opts: RedisClientOptions = {},
): Redis | null {
  const url = opts.url ?? process.env.REDIS_URL;
  if (!url) return null;

  const client = new Redis(url, {
    keyPrefix: opts.keyPrefix,
    lazyConnect: opts.lazyConnect ?? false,
    maxRetriesPerRequest: 3,
    retryStrategy(times) {
      // Linear backoff: 100ms, 200ms, 300ms… capped at 5s
      return Math.min(times * 100, 5000);
    },
  });

  client.on('connect', () => logger.info('Redis connected'));
  client.on('error', (err) => logger.error(`Redis error: ${err.message}`));
  client.on('close', () => logger.warn('Redis connection closed'));

  return client;
}
