import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { nullLogger } from '../lib/logger.js';

const mockPool = {
  on: vi.fn(),
  end: vi.fn().mockResolvedValue(undefined),
};

vi.mock('pg', () => {
  const MockPool = vi.fn(function (this: any) {
    Object.assign(this, mockPool);
    return this;
  });
  return { default: { Pool: MockPool } };
});

vi.mock('drizzle-orm/node-postgres', () => ({
  drizzle: vi.fn(() => ({ query: {} })),
}));

import { createDatabase } from './client.js';

describe('createDatabase', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.DATABASE_URL;
  });

  afterEach(() => {
    delete process.env.DATABASE_URL;
  });

  it('returns null when DATABASE_URL is not set', () => {
    const result = createDatabase(nullLogger);
    expect(result).toBeNull();
  });

  it('returns { db, pool } when DATABASE_URL is set', () => {
    process.env.DATABASE_URL = 'postgresql://localhost:5432/test';
    const result = createDatabase(nullLogger);

    expect(result).not.toBeNull();
    expect(result!.db).toBeDefined();
    expect(result!.pool).toBeDefined();
  });

  it('registers error handler on pool', () => {
    process.env.DATABASE_URL = 'postgresql://localhost:5432/test';
    createDatabase(nullLogger);

    expect(mockPool.on).toHaveBeenCalledWith('error', expect.any(Function));
  });
});
