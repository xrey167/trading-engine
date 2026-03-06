import { Bars } from '../../trading-engine.js';

export function isLocalHigh(bars: Bars, window: number, shift: number): boolean {
  const center = bars.high(shift);
  for (let i = shift + 1; i <= shift + window && i < bars.length; i++) {
    if (bars.high(i) > center) return false;
  }
  return true;
}

export function isLocalLow(bars: Bars, window: number, shift: number): boolean {
  const center = bars.low(shift);
  for (let i = shift + 1; i <= shift + window && i < bars.length; i++) {
    if (bars.low(i) < center) return false;
  }
  return true;
}
