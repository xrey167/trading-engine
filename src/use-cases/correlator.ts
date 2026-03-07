// CorrelatorService — ported from quant-lib/application
// Computes the Pearson correlation between two symbol return series.
// Accepts pre-built price arrays; callers are responsible for fetching bars.
import type { Logger } from '../lib/logger.js';
import type { Result } from '../lib/result.js';
import { ok, err } from '../lib/result.js';
import type { DomainError } from '../lib/errors.js';
import { insufficientData, invalidInput } from '../lib/errors.js';

export interface CorrelationResult {
  symbolA: string;
  symbolB: string;
  /** Pearson r ∈ [-1, 1] */
  r: number;
  /** Number of observations used */
  n: number;
}

export class CorrelatorService {
  constructor(private readonly logger: Logger) {}

  /**
   * Compute Pearson correlation between two equal-length price series.
   * Returns an error if the series have fewer than 2 data points or
   * have different lengths.
   */
  correlate(
    symbolA: string,
    pricesA: readonly number[],
    symbolB: string,
    pricesB: readonly number[],
  ): Result<CorrelationResult, DomainError> {
    if (pricesA.length !== pricesB.length) {
      return err(
        invalidInput(
          `Series length mismatch: ${symbolA}=${pricesA.length} vs ${symbolB}=${pricesB.length}`,
        ),
      );
    }
    const n = pricesA.length;
    if (n < 2) {
      return err(insufficientData(2, n, 'Need at least 2 data points to compute correlation'));
    }

    // Convert price arrays to log-return arrays (length n-1)
    const returnsA = toLogReturns(pricesA);
    const returnsB = toLogReturns(pricesB);

    const r = pearson(returnsA, returnsB);
    this.logger.debug(`Correlator: ${symbolA}↔${symbolB} r=${r.toFixed(4)} n=${returnsA.length}`);
    return ok({ symbolA, symbolB, r, n: returnsA.length });
  }

  /**
   * Batch-correlate one base symbol against many others.
   * Results for pairs that error are silently omitted.
   */
  correlateMany(
    symbolA: string,
    pricesA: readonly number[],
    others: Array<{ symbol: string; prices: readonly number[] }>,
  ): CorrelationResult[] {
    return others.flatMap(({ symbol, prices }) => {
      const r = this.correlate(symbolA, pricesA, symbol, prices);
      return r.ok ? [r.value] : [];
    });
  }
}

// ── helpers ──────────────────────────────────────────────────────────────────

function toLogReturns(prices: readonly number[]): number[] {
  const returns: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    returns.push(Math.log(prices[i] / prices[i - 1]));
  }
  return returns;
}

function mean(xs: number[]): number {
  return xs.reduce((s, x) => s + x, 0) / xs.length;
}

function pearson(a: number[], b: number[]): number {
  const ma = mean(a);
  const mb = mean(b);
  let num = 0;
  let da2 = 0;
  let db2 = 0;
  for (let i = 0; i < a.length; i++) {
    const da = a[i] - ma;
    const db = b[i] - mb;
    num += da * db;
    da2 += da * da;
    db2 += db * db;
  }
  const denom = Math.sqrt(da2 * db2);
  return denom === 0 ? 0 : num / denom;
}
