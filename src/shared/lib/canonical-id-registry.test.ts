import { describe, it, expect, beforeEach } from 'vitest';
import { CanonicalIdRegistry, NO_STRATEGY } from './canonical-id-registry.js';

describe('CanonicalIdRegistry', () => {
  let reg: CanonicalIdRegistry;

  beforeEach(() => { reg = new CanonicalIdRegistry(); });

  it('assigns sequential codes to symbols starting at 1', () => {
    const a = reg.registerSymbol('EURUSD');
    const b = reg.registerSymbol('GBPUSD');
    expect(a).toBe(1);
    expect(b).toBe(2);
  });

  it('returns same code for same symbol (idempotent)', () => {
    const a = reg.registerSymbol('EURUSD');
    const b = reg.registerSymbol('EURUSD');
    expect(a).toBe(b);
  });

  it('looks up symbol name from code', () => {
    const code = reg.registerSymbol('EURUSD');
    expect(reg.lookupSymbol(code)).toBe('EURUSD');
  });

  it('throws on unknown symbol code', () => {
    expect(() => reg.lookupSymbol(99)).toThrow();
  });

  it('throws when symbol limit exceeded (255 max)', () => {
    for (let i = 1; i <= 255; i++) reg.registerSymbol(`SYM${i}`);
    expect(() => reg.registerSymbol('OVERFLOW')).toThrow(/full/i);
  });

  it('NO_STRATEGY is 0', () => {
    expect(NO_STRATEGY).toBe(0);
  });

  it('assigns sequential codes to strategies starting at 1', () => {
    const a = reg.registerStrategy('candle-atr');
    const b = reg.registerStrategy('volume-breakout');
    expect(a).toBe(1);
    expect(b).toBe(2);
  });

  it('returns same code for same strategy (idempotent)', () => {
    const a = reg.registerStrategy('candle-atr');
    const b = reg.registerStrategy('candle-atr');
    expect(a).toBe(b);
  });

  it('throws when strategy limit exceeded (255 max)', () => {
    for (let i = 1; i <= 255; i++) reg.registerStrategy(`STRAT${i}`);
    expect(() => reg.registerStrategy('OVERFLOW')).toThrow(/full/i);
  });

  it('stores and retrieves nativeId by canonical id', () => {
    reg.setNativeId('ord_abc', 12345);
    expect(reg.getNativeId('ord_abc')).toBe(12345);
  });

  it('returns undefined for unknown canonical id', () => {
    expect(reg.getNativeId('unknown')).toBeUndefined();
  });

  it('stores bigint nativeId', () => {
    reg.setNativeId('ord_ext', 999_999_999_999n);
    expect(reg.getNativeId('ord_ext')).toBe(999_999_999_999n);
  });

  it('lookupStrategy returns undefined for code 0 (NO_STRATEGY)', () => {
    expect(reg.lookupStrategy(NO_STRATEGY)).toBeUndefined();
  });

  it('lookupStrategy returns undefined for unregistered code (does not throw)', () => {
    expect(reg.lookupStrategy(99)).toBeUndefined();
  });

  it('lookupSymbol(0) throws (code 0 is reserved, never assigned)', () => {
    expect(() => reg.lookupSymbol(0)).toThrow();
  });

  it('throws on empty symbol name', () => {
    expect(() => reg.registerSymbol('')).toThrow();
  });

  it('throws on empty strategy id', () => {
    expect(() => reg.registerStrategy('')).toThrow();
  });
});
