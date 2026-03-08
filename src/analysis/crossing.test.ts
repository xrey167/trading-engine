import { describe, it, expect } from 'vitest';
import { isCrossingAbove, isCrossingBelow } from './crossing.js';

// ─────────────────────────────────────────────────────────────
// T2.4 – Crossing helpers
// ─────────────────────────────────────────────────────────────

describe('T2.4 – isCrossingAbove / isCrossingBelow', () => {
  it('isCrossingAbove: prev A <= B, cur A > B', () => {
    expect(isCrossingAbove(5, 3, 2, 3)).toBe(true);
  });

  it('isCrossingAbove: false when already above', () => {
    expect(isCrossingAbove(5, 3, 4, 3)).toBe(false);
  });

  it('isCrossingAbove: true when prev equal, cur above', () => {
    expect(isCrossingAbove(5, 3, 3, 3)).toBe(true);
  });

  it('isCrossingBelow: prev A >= B, cur A < B', () => {
    expect(isCrossingBelow(2, 3, 4, 3)).toBe(true);
  });

  it('isCrossingBelow: false when already below', () => {
    expect(isCrossingBelow(2, 3, 1, 3)).toBe(false);
  });

  it('isCrossingBelow: true when prev equal, cur below', () => {
    expect(isCrossingBelow(2, 3, 3, 3)).toBe(true);
  });
});
