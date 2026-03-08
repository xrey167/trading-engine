import type { Bars } from '../market-data/bars.js';
import { BarsAtrMode, BarBase } from '../shared/domain/engine-enums.js';
import type { Result } from '../shared/lib/result.js';
import type { DomainError } from '../shared/lib/errors.js';
import { ok, err } from '../shared/lib/result.js';
import { insufficientData } from '../shared/lib/errors.js';

export function calculateATR(
  bars: Bars,
  period: number,
  shift: number,
  barsMode: BarsAtrMode = BarsAtrMode.Normal,
  barBase: BarBase = BarBase.HiLo,
): number | null {
  let count = 0;
  let totalTR = 0;
  for (let i = shift; count < period && i + 1 < bars.length; i++) {
    const open  = bars.open(i);
    const close = bars.close(i);
    if (barsMode === BarsAtrMode.Bullish && close <= open) continue;
    if (barsMode === BarsAtrMode.Bearish && close >= open) continue;
    const tr = barBase === BarBase.OpenClose
      ? Math.abs(close - open)
      : Math.max(
          bars.high(i) - bars.low(i),
          Math.abs(bars.high(i) - bars.close(i + 1)),
          Math.abs(bars.low(i)  - bars.close(i + 1)),
        );
    totalTR += tr;
    count++;
  }
  if (count < period) return null;
  return totalTR / period;
}

export function calculateATRResult(
  bars: Bars,
  period: number,
  shift: number,
  barsMode: BarsAtrMode = BarsAtrMode.Normal,
  barBase: BarBase = BarBase.HiLo,
): Result<number, DomainError> {
  const val = calculateATR(bars, period, shift, barsMode, barBase);
  if (val === null) {
    return err(insufficientData(period + shift + 1, bars.length));
  }
  return ok(val);
}

export { BarsAtrMode, BarBase };
