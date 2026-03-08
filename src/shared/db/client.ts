import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from './schema.js';
import type { Logger } from '../lib/logger.js';

export type DrizzleDB = ReturnType<typeof drizzle<typeof schema>>;

export interface DatabaseConnection {
  db: DrizzleDB;
  pool: pg.Pool;
}

/**
 * Creates a Drizzle ORM instance backed by a pg Pool.
 * Returns `null` when no `DATABASE_URL` env var is provided.
 */
export function createDatabase(logger: Logger): DatabaseConnection | null {
  const url = process.env.DATABASE_URL;
  if (!url) return null;

  const pool = new pg.Pool({ connectionString: url, max: 10 });
  pool.on('error', (err) => logger.error(`PG pool error: ${err.message}`));

  const db = drizzle(pool, { schema });
  logger.info('PostgreSQL connected');
  return { db, pool };
}
