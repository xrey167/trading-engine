import { describe, it, expect } from 'vitest';
import { CorrelatorService } from './correlator.js';
import { createLogger } from '../lib/logger.js';

// ─────────────────────────────────────────────────────────────
// CorrelatorService
// ─────────────────────────────────────────────────────────────

describe('CorrelatorService', () => {
  const logger = createLogger('test');
  const svc = new CorrelatorService(logger);

  it('returns r=1 for identical series', () => {
    const prices = [1.0, 1.1, 1.2, 1.15, 1.25];
    const result = svc.correlate('A', prices, 'B', prices);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.r).toBeCloseTo(1, 5);
  });

  it('returns r=-1 for perfectly inverse log-return series', () => {
    // prices where log-returns alternate +1/-1 vs -1/+1 → exact Pearson r = -1
    const a = [1, Math.E, 1, Math.E, 1];
    const b = [1, 1 / Math.E, 1, 1 / Math.E, 1];
    const result = svc.correlate('A', a, 'B', b);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.r).toBeCloseTo(-1, 5);
  });

  it('errors on length mismatch', () => {
    const result = svc.correlate('A', [1, 2, 3], 'B', [1, 2]);
    expect(result.ok).toBe(false);
  });

  it('errors on series with fewer than 2 points', () => {
    const result = svc.correlate('A', [1], 'B', [1]);
    expect(result.ok).toBe(false);
  });

  it('correlateMany filters out errors', () => {
    const a = [1, 2, 3, 4, 5];
    const results = svc.correlateMany('A', a, [
      { symbol: 'B', prices: [1, 2, 3, 4, 5] },
      { symbol: 'C', prices: [1, 2] },           // length mismatch → filtered
    ]);
    expect(results).toHaveLength(1);
    expect(results[0].symbolB).toBe('B');
  });
});
