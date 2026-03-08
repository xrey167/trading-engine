import type { OHLC } from './ohlc.js';
import { Bar } from './bar.js';
import { AtrMethod, BarsAtrMode, BarBase } from '../shared/domain/engine-enums.js';

export class Bars {
  constructor(private readonly data: OHLC[]) {}

  get length(): number { return this.data.length; }

  bar(shift = 0): Bar {
    const b = this.data[shift];
    if (!b) throw new RangeError(`shift ${shift} out of range (len=${this.data.length})`);
    return new Bar(b.open, b.high, b.low, b.close, b.time, b.volume);
  }

  high(shift = 0):  number { return this.data[shift].high;  }
  low(shift = 0):   number { return this.data[shift].low;   }
  open(shift = 0):  number { return this.data[shift].open;  }
  close(shift = 0): number { return this.data[shift].close; }
  time(shift = 0):  Date   { return this.data[shift].time;  }

  highestHigh(periods: number, shift = 0): number {
    let max = -Infinity;
    for (let i = shift; i < shift + periods && i < this.data.length; i++) {
      if (this.data[i].high > max) max = this.data[i].high;
    }
    return max;
  }

  lowestLow(periods: number, shift = 0): number {
    let min = Infinity;
    for (let i = shift; i < shift + periods && i < this.data.length; i++) {
      if (this.data[i].low < min) min = this.data[i].low;
    }
    return min;
  }

  sma(periods: number, shift = 0): number {
    let sum = 0, cnt = 0;
    for (let i = shift; i < shift + periods && i < this.data.length; i++) {
      sum += this.data[i].close; cnt++;
    }
    return cnt === 0 ? 0 : sum / cnt;
  }

  atr(
    periods: number,
    shift = 0,
    method: AtrMethod = AtrMethod.Sma,
    barsMode: BarsAtrMode = BarsAtrMode.Normal,
    barBase: BarBase = BarBase.HiLo,
  ): number {
    const trs: number[] = [];
    for (let i = shift; trs.length < periods && i + 1 < this.data.length; i++) {
      const c = this.data[i];
      if (barsMode === BarsAtrMode.Bullish && c.close <= c.open) continue;
      if (barsMode === BarsAtrMode.Bearish && c.close >= c.open) continue;
      const p = this.data[i + 1];
      const tr = barBase === BarBase.OpenClose
        ? Math.abs(c.close - c.open)
        : Math.max(c.high - c.low, Math.abs(c.high - p.close), Math.abs(c.low - p.close));
      trs.push(tr);
    }
    if (trs.length === 0) return 0;
    if (method === AtrMethod.Sma) return trs.reduce((a, b) => a + b, 0) / trs.length;
    const k = 2 / (trs.length + 1);
    return [...trs].reverse().reduce((ema, v, i) => i === 0 ? v : v * k + ema * (1 - k), 0);
  }

  rsi(periods = 14, shift = 0): number {
    if (this.data.length < shift + periods * 2 + 1) return 50;
    const base = shift + periods;
    let avgGain = 0, avgLoss = 0;
    for (let i = base; i < base + periods; i++) {
      const diff = this.data[i].close - this.data[i + 1].close;
      if (diff > 0) { avgGain += diff; } else { avgLoss -= diff; }
    }
    avgGain /= periods;
    avgLoss /= periods;
    for (let i = base - 1; i >= shift; i--) {
      const diff = this.data[i].close - this.data[i + 1].close;
      const g = diff > 0 ? diff : 0;
      const l = diff < 0 ? -diff : 0;
      avgGain = (avgGain * (periods - 1) + g) / periods;
      avgLoss = (avgLoss * (periods - 1) + l) / periods;
    }
    return avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }

  isLocalHigh(lookback: number, shift = 0, tol = 0): boolean {
    const peak = this.data[shift].high;
    for (let i = shift + 1; i <= shift + lookback && i < this.data.length; i++) {
      if (this.data[i].high + tol > peak) return false;
    }
    return true;
  }

  isLocalLow(lookback: number, shift = 0, tol = 0): boolean {
    const trough = this.data[shift].low;
    for (let i = shift + 1; i <= shift + lookback && i < this.data.length; i++) {
      if (this.data[i].low - tol < trough) return false;
    }
    return true;
  }

  ema(periods: number, shift = 0): number {
    const end = Math.min(shift + periods * 3, this.data.length);
    if (end <= shift) return 0;
    const seedStart = Math.max(end - periods, shift);
    let seed = 0, cnt = 0;
    for (let i = seedStart; i < end; i++) { seed += this.data[i].close; cnt++; }
    if (cnt === 0) return this.data[shift].close;
    seed /= cnt;
    const k = 2 / (periods + 1);
    let ema = seed;
    for (let i = seedStart - 1; i >= shift; i--) {
      ema = this.data[i].close * k + ema * (1 - k);
    }
    return ema;
  }

  isEngulfingLong(shift = 0): boolean {
    if (shift + 1 >= this.data.length) return false;
    return this.data[shift].low < this.data[shift + 1].low
        && this.data[shift].close > this.data[shift + 1].high;
  }

  isEngulfingShort(shift = 0): boolean {
    if (shift + 1 >= this.data.length) return false;
    return this.data[shift].high > this.data[shift + 1].high
        && this.data[shift].close < this.data[shift + 1].low;
  }

  isReversingLong(shift = 0): boolean {
    if (shift + 1 >= this.data.length) return false;
    const cur = this.data[shift], prev = this.data[shift + 1];
    return cur.high > prev.high && cur.close > prev.close
        && cur.close > prev.open && cur.close > cur.open;
  }

  isReversingShort(shift = 0): boolean {
    if (shift + 1 >= this.data.length) return false;
    const cur = this.data[shift], prev = this.data[shift + 1];
    return cur.low < prev.low && cur.close < prev.close
        && cur.close < prev.open && cur.open > cur.close;
  }

  tickVolumeAverage(periods: number, shift = 0): number {
    let sum = 0, cnt = 0;
    for (let i = shift; i < shift + periods && i < this.data.length; i++) {
      sum += this.data[i].volume ?? 0; cnt++;
    }
    return cnt === 0 ? 0 : sum / cnt;
  }

  volumeRatio(periods: number, shift = 0): number {
    const avg = this.tickVolumeAverage(periods, shift + 1);
    return avg === 0 ? 0 : (this.data[shift]?.volume ?? 0) / avg;
  }

  isMaSloping(type: 'sma' | 'ema', periods: number, span: number, shift = 0, up = true): boolean {
    if (span < 2) return false;
    const maFn = type === 'sma' ? (s: number) => this.sma(periods, s) : (s: number) => this.ema(periods, s);
    let prev = maFn(shift + span - 1);
    for (let i = shift + span - 2; i >= shift; i--) {
      const cur = maFn(i);
      if (up ? cur <= prev : cur >= prev) return false;
      prev = cur;
    }
    return true;
  }

  stochastic(periodK: number, periodD: number, slowing: number, shift = 0): { main: number; signal: number } {
    const rawKValues: number[] = [];
    const needed = shift + slowing + periodD - 1;
    for (let i = shift; i <= needed && i + periodK - 1 < this.data.length; i++) {
      const hh = this.highestHigh(periodK, i);
      const ll = this.lowestLow(periodK, i);
      rawKValues.push(hh === ll ? 50 : ((this.data[i].close - ll) / (hh - ll)) * 100);
    }
    const slowedK: number[] = [];
    for (let i = 0; i + slowing <= rawKValues.length; i++) {
      let sum = 0;
      for (let j = i; j < i + slowing; j++) sum += rawKValues[j];
      slowedK.push(sum / slowing);
    }
    const main = slowedK.length > 0 ? slowedK[0] : 50;
    let signal = main;
    if (slowedK.length >= periodD) {
      let sum = 0;
      for (let i = 0; i < periodD; i++) sum += slowedK[i];
      signal = sum / periodD;
    }
    return { main, signal };
  }

  highestHighShift(periods: number, shift = 0): number {
    let max = -Infinity, idx = shift;
    for (let i = shift; i < shift + periods && i < this.data.length; i++) {
      if (this.data[i].high > max) { max = this.data[i].high; idx = i; }
    }
    return idx;
  }

  lowestLowShift(periods: number, shift = 0): number {
    let min = Infinity, idx = shift;
    for (let i = shift; i < shift + periods && i < this.data.length; i++) {
      if (this.data[i].low < min) { min = this.data[i].low; idx = i; }
    }
    return idx;
  }

  getBarShift(datetime: Date): number {
    let lo = 0, hi = this.data.length - 1;
    const target = datetime.getTime();
    while (lo <= hi) {
      const mid = (lo + hi) >>> 1;
      const t = this.data[mid].time.getTime();
      if (t === target) return mid;
      if (t > target) lo = mid + 1; else hi = mid - 1;
    }
    return lo < this.data.length ? lo : this.data.length - 1;
  }

  findOutsideBar(shift = 0, maxScan = 100): number {
    const ref = this.data[shift];
    if (!ref) return -1;
    const limit = Math.min(shift + 1 + maxScan, this.data.length);
    for (let i = shift + 1; i < limit; i++) {
      if (this.data[i].high >= ref.high && this.data[i].low <= ref.low) return i;
    }
    return -1;
  }

  dayOHLC(daysBack = 0): { open: number; high: number; low: number; close: number; timeBegin: Date; timeEnd: Date } | null {
    let currentDate = '';
    let dayCount = -1;
    let startIdx = -1, endIdx = -1;
    for (let i = 0; i < this.data.length; i++) {
      const d = this.data[i].time.toISOString().slice(0, 10);
      if (d !== currentDate) {
        dayCount++;
        if (dayCount === daysBack) startIdx = i;
        if (dayCount === daysBack + 1) { endIdx = i; break; }
        currentDate = d;
      }
    }
    if (startIdx === -1) return null;
    if (endIdx === -1) endIdx = this.data.length;
    let high = -Infinity, low = Infinity;
    for (let i = startIdx; i < endIdx; i++) {
      if (this.data[i].high > high) high = this.data[i].high;
      if (this.data[i].low < low) low = this.data[i].low;
    }
    return {
      open: this.data[endIdx - 1].open,
      high,
      low,
      close: this.data[startIdx].close,
      timeBegin: this.data[endIdx - 1].time,
      timeEnd: this.data[startIdx].time,
    };
  }

  lwma(periods: number, shift = 0): number {
    let weightedSum = 0, weightTotal = 0;
    for (let i = 0; i < periods && shift + i < this.data.length; i++) {
      const w = periods - i;
      weightedSum += this.data[shift + i].close * w;
      weightTotal += w;
    }
    return weightTotal === 0 ? 0 : weightedSum / weightTotal;
  }

  smma(periods: number, shift = 0): number {
    const deepEnd = Math.min(shift + periods * 2, this.data.length);
    if (deepEnd <= shift) return 0;
    const seedStart = Math.min(shift + periods, deepEnd);
    let sum = 0, cnt = 0;
    for (let i = seedStart; i < deepEnd; i++) { sum += this.data[i].close; cnt++; }
    if (cnt === 0) return this.data[shift].close;
    let smma = sum / cnt;
    for (let i = seedStart - 1; i >= shift; i--) {
      smma = (smma * (periods - 1) + this.data[i].close) / periods;
    }
    return smma;
  }
}
