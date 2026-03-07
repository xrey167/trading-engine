import { describe, it, expect } from 'vitest';
import { CircuitBreaker } from './circuit-breaker.js';

describe('CircuitBreaker', () => {
  it('starts in CLOSED state', () => {
    const cb = new CircuitBreaker({ failureThreshold: 3, resetTimeoutMs: 1000 });
    expect(cb.state).toBe('CLOSED');
  });

  it('stays CLOSED on successful calls', async () => {
    const cb = new CircuitBreaker({ failureThreshold: 3, resetTimeoutMs: 1000 });
    const result = await cb.call(() => Promise.resolve(42));
    expect(result).toBe(42);
    expect(cb.state).toBe('CLOSED');
  });

  it('opens after reaching failure threshold', async () => {
    const cb = new CircuitBreaker({ failureThreshold: 2, resetTimeoutMs: 1000 });
    const fail = () => Promise.reject(new Error('fail'));

    await expect(cb.call(fail)).rejects.toThrow('fail');
    expect(cb.state).toBe('CLOSED');

    await expect(cb.call(fail)).rejects.toThrow('fail');
    expect(cb.state).toBe('OPEN');
  });

  it('rejects calls immediately when OPEN', async () => {
    const cb = new CircuitBreaker({ failureThreshold: 1, resetTimeoutMs: 60_000 });
    await expect(cb.call(() => Promise.reject(new Error('x')))).rejects.toThrow('x');
    expect(cb.state).toBe('OPEN');

    await expect(cb.call(() => Promise.resolve('nope'))).rejects.toThrow('Circuit breaker is OPEN');
  });

  it('transitions to HALF_OPEN after reset timeout', async () => {
    const cb = new CircuitBreaker({ failureThreshold: 1, resetTimeoutMs: 10 });
    await expect(cb.call(() => Promise.reject(new Error('x')))).rejects.toThrow();
    expect(cb.state).toBe('OPEN');

    await new Promise(r => setTimeout(r, 15));
    const result = await cb.call(() => Promise.resolve('recovered'));
    expect(result).toBe('recovered');
    expect(cb.state).toBe('CLOSED');
  });

  it('resets failure count on success', async () => {
    const cb = new CircuitBreaker({ failureThreshold: 3, resetTimeoutMs: 1000 });
    await expect(cb.call(() => Promise.reject(new Error('x')))).rejects.toThrow();
    await expect(cb.call(() => Promise.reject(new Error('x')))).rejects.toThrow();
    // 2 failures, then a success resets
    await cb.call(() => Promise.resolve('ok'));
    expect(cb.state).toBe('CLOSED');
    // Now it should take 3 more failures to open
    await expect(cb.call(() => Promise.reject(new Error('x')))).rejects.toThrow();
    await expect(cb.call(() => Promise.reject(new Error('x')))).rejects.toThrow();
    expect(cb.state).toBe('CLOSED');
  });
});
