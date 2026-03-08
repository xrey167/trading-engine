/** True when A crosses above B: previously A ≤ B, now A > B. Works with any indicator pair. */
export function isCrossingAbove(valueA: number, valueB: number, prevA: number, prevB: number): boolean {
  return prevA <= prevB && valueA > valueB;
}

/** True when A crosses below B: previously A ≥ B, now A < B. Works with any indicator pair. */
export function isCrossingBelow(valueA: number, valueB: number, prevA: number, prevB: number): boolean {
  return prevA >= prevB && valueA < valueB;
}
