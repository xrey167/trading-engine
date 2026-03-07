import { Bars } from '../../trading-engine.js';
import type { Result } from '../shared/lib/result.js';
import type { DomainError } from '../shared/lib/errors.js';
import { ok, err } from '../shared/lib/result.js';
import { insufficientData } from '../shared/lib/errors.js';

export function calculateATR(bars: Bars, period: number, shift: number): number | null {
  const required = period + shift + 1;
  if (bars.length < required) return null;

  let totalTR = 0;
  for (let i = shift; i < shift + period; i++) {
    const hl = bars.high(i) - bars.low(i);
    const hpc = Math.abs(bars.high(i) - bars.close(i + 1));
    const lpc = Math.abs(bars.low(i) - bars.close(i + 1));
    totalTR += Math.max(hl, hpc, lpc);
  }
  return totalTR / period;
}

export function calculateATRResult(bars: Bars, period: number, shift: number): Result<number, DomainError> {
  const val = calculateATR(bars, period, shift);
  if (val === null) {
    return err(insufficientData(period + shift + 1, bars.length));
  }
  return ok(val);
}
