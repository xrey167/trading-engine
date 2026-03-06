import type { TestPosition } from './factories.js';
import type { Result } from '../lib/result.js';
import type { DomainError } from '../lib/errors.js';
import { ok, err } from '../lib/result.js';
import { notFound } from '../lib/errors.js';

export interface MinimalBrokerAdapter {
  getPositions(userId: string): Promise<Result<TestPosition[], DomainError>>;
  getBalance(userId: string): Promise<Result<number, DomainError>>;
  closePosition(userId: string, ticket: number): Promise<Result<boolean, DomainError>>;
}

export class MockBrokerAdapter implements MinimalBrokerAdapter {
  private positions: Map<string, TestPosition[]> = new Map();
  private balances: Map<string, number> = new Map();

  setPositions(userId: string, positions: TestPosition[]): void {
    this.positions.set(userId, [...positions]);
  }

  setBalance(userId: string, balance: number): void {
    this.balances.set(userId, balance);
  }

  async getPositions(userId: string): Promise<Result<TestPosition[], DomainError>> {
    const positions = this.positions.get(userId);
    if (!positions) return ok([]);
    return ok([...positions]);
  }

  async getBalance(userId: string): Promise<Result<number, DomainError>> {
    const balance = this.balances.get(userId);
    if (balance === undefined) return err(notFound('Balance not found', userId));
    return ok(balance);
  }

  async closePosition(userId: string, ticket: number): Promise<Result<boolean, DomainError>> {
    const positions = this.positions.get(userId);
    if (!positions) return err(notFound('Position not found', String(ticket)));
    const idx = positions.findIndex(p => p.ticket === ticket);
    if (idx === -1) return err(notFound('Position not found', String(ticket)));
    positions.splice(idx, 1);
    return ok(true);
  }
}

export interface MinimalIndicatorAdapter {
  getATR(symbol: string, timeframe: string, period: number, barIndex: number): number | null;
}

export class MockIndicatorAdapter implements MinimalIndicatorAdapter {
  private atrValues: Map<string, number> = new Map();

  setATR(symbol: string, timeframe: string, period: number, barIndex: number, value: number): void {
    const key = `${symbol}:${timeframe}:${period}:${barIndex}`;
    this.atrValues.set(key, value);
  }

  setDefaultATR(value: number): void {
    this.atrValues.set('__default__', value);
  }

  getATR(symbol: string, timeframe: string, period: number, barIndex: number): number | null {
    const key = `${symbol}:${timeframe}:${period}:${barIndex}`;
    const specific = this.atrValues.get(key);
    if (specific !== undefined) return specific;
    const defaultVal = this.atrValues.get('__default__');
    if (defaultVal !== undefined) return defaultVal;
    return null;
  }
}
