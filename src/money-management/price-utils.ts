export function priceDelta(entry: number, stopLoss: number): number {
  return Math.abs(entry - stopLoss);
}

export function targetPrice(entry: number, delta: number, multiplier: number, direction: 'BUY' | 'SELL'): number {
  const distance = delta * multiplier;
  return direction === 'BUY' ? entry + distance : entry - distance;
}

export function percentageToPrice(entryPrice: number, percentage: number, direction: 'BUY' | 'SELL'): number {
  const delta = entryPrice * (percentage / 100);
  return direction === 'BUY' ? entryPrice - delta : entryPrice + delta;
}
