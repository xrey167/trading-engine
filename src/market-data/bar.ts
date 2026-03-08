import type { OHLC } from './ohlc.js';
import { BarBase } from '../shared/domain/engine-enums.js';

export class Bar implements OHLC {
  constructor(
    public open:   number,
    public high:   number,
    public low:    number,
    public close:  number,
    public time:   Date,
    public volume?: number,
  ) {}

  isBullish(): boolean { return this.close > this.open; }
  isBearish(): boolean { return this.close < this.open; }
  isDoji(tol = 0): boolean { return Math.abs(this.open - this.close) <= tol; }

  effectiveHigh(base: BarBase = BarBase.HiLo): number {
    return base === BarBase.HiLo ? this.high : Math.max(this.open, this.close);
  }
  effectiveLow(base: BarBase = BarBase.HiLo): number {
    return base === BarBase.HiLo ? this.low : Math.min(this.open, this.close);
  }

  range(base: BarBase = BarBase.HiLo): number { return this.effectiveHigh(base) - this.effectiveLow(base); }
  wickRange(): number { return this.high - Math.max(this.open, this.close); }
  tailRange(): number { return Math.min(this.open, this.close) - this.low; }
  bodyRange(): number { return Math.abs(this.open - this.close); }

  bodyPart(base: BarBase = BarBase.HiLo): number { const r = this.range(base); return r === 0 ? 0 : this.bodyRange() / r; }
  tailPart(base: BarBase = BarBase.HiLo): number { const r = this.range(base); return r === 0 ? 0 : this.tailRange() / r; }
  wickPart(base: BarBase = BarBase.HiLo): number { const r = this.range(base); return r === 0 ? 0 : this.wickRange() / r; }

  isHammer(tailMin = 0.55, base: BarBase = BarBase.HiLo): boolean {
    return this.tailPart(base) >= tailMin && this.wickPart(base) <= this.tailPart(base) * 0.5;
  }
  isShootingStar(wickMin = 0.55, base: BarBase = BarBase.HiLo): boolean {
    return this.wickPart(base) >= wickMin && this.tailPart(base) <= this.wickPart(base) * 0.5;
  }
  isSolid(wickMax = 0.15, tailMax = 0.15, base: BarBase = BarBase.HiLo): boolean {
    return this.tailPart(base) <= tailMax && this.wickPart(base) <= wickMax;
  }
  isSolidBullish(wickMax = 0.15, base: BarBase = BarBase.HiLo): boolean { return this.isBullish() && this.wickPart(base) <= wickMax; }
  isSolidBearish(tailMax = 0.15, base: BarBase = BarBase.HiLo): boolean { return this.isBearish() && this.tailPart(base) <= tailMax; }

  isBreaking(price: number): boolean {
    return (this.open > price && this.close < price) || (this.open < price && this.close > price);
  }
  isBreakingLong(price: number, exceed = 0): boolean {
    return this.open < price && this.close > price && this.close > price + exceed;
  }
  isBreakingShort(price: number, exceed = 0): boolean {
    return this.open > price && this.close < price && this.close < price - exceed;
  }
  isCrossing(price: number): boolean { return this.high >= price && this.low <= price; }
  isTouchingLow(price: number): boolean {
    return this.low <= price && Math.min(this.open, this.close) >= price;
  }
  isTouchingHigh(price: number): boolean {
    return this.high >= price && Math.max(this.open, this.close) <= price;
  }

  isInTimeRange(beginH: number, beginM: number, endH: number, endM: number): boolean {
    const begin = beginH * 60 + beginM;
    const end   = endH   * 60 + endM;
    const cur   = this.time.getUTCHours() * 60 + this.time.getUTCMinutes();
    if (end < begin) return cur >= begin || cur <= end;
    return cur >= begin && cur <= end;
  }

  fiboPrice(level: number): number { return this.low + this.range() * level; }

  pivotPrice(type: 'PP' | 'R1' | 'R2' | 'S1' | 'S2'): number {
    const pp = (this.high + this.low + this.close) / 3;
    switch (type) {
      case 'PP': return pp;
      case 'R1': return 2 * pp - this.low;
      case 'R2': return pp + (this.high - this.low);
      case 'S1': return 2 * pp - this.high;
      case 'S2': return pp - (this.high - this.low);
    }
  }
}
