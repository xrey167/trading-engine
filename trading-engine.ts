// ============================================================
//  Live Trading Engine — TypeScript
//  All business logic ported from _StereoAPI_MT5.mqh
//  (StereoTrader by Dirk Hilger) — no StereoTrader dependency.
//
//  Supports:
//   • Long and short positions simultaneously (hedging)
//   • Market, Limit, Stop, Trailing-entry, MIT orders
//   • OCO / CO / CS / REV / bracket order attributes
//   • Limit-pullback (trailing pending order)
//   • All trailing-stop modes: Dst, EOP, MA, PlhPeak, PlhClose, Prx
//   • SL / TP / Break-even with activation flags
//   • ATR, RSI, SMA, local-high/low calculations
// ============================================================

// ─────────────────────────────────────────────────────────────
// Enums
// ─────────────────────────────────────────────────────────────

export const Side = { None: 0, Long: 1, Short: -1 } as const;
export type Side = (typeof Side)[keyof typeof Side];

export const TrailMode = {
  None:     0,
  Dst:      1,  // fixed distance from latest high/low
  Eop:      2,  // lowest-low / highest-high over N periods
  Ma:       3,  // moving average ± distance
  // 4 intentionally unused (reserved in original MQL enum)
  PlhPeak:  5,  // peak/low tracker — updates only on new extreme
  PlhClose: 6,  // same, triggered by new close extreme
  Prx:      7,  // close-based, distance can be relative to bar range
} as const;
export type TrailMode = (typeof TrailMode)[keyof typeof TrailMode];

export const AtrMethod = { Sma: 0, Ema: 1 } as const;
export type AtrMethod = (typeof AtrMethod)[keyof typeof AtrMethod];

/** Filter which candles contribute to ATR calculation */
export const BarsAtrMode = {
  Normal:  0,  // all bars (default)
  Bullish: 1,  // only bullish bars (close > open)
  Bearish: -1, // only bearish bars (close < open)
} as const;
export type BarsAtrMode = (typeof BarsAtrMode)[keyof typeof BarsAtrMode];

/** Which price range forms the base of each TR measurement */
export const BarBase = {
  HiLo:       'BASE_HILO',       // High - Low  (standard True Range, default)
  OpenClose:  'BASE_OPENCLOSE',  // |Open - Close|  (body range only)
} as const;
export type BarBase = (typeof BarBase)[keyof typeof BarBase];

export const OrderAttr = {
  OCO:  'ORDER_ATTR_OCO',   // One Cancels Other — fill cancels all other pending orders
  CO:   'ORDER_ATTR_CO',    // Cancel Others on fill — cancel same-side pending orders
  CS:   'ORDER_ATTR_CS',    // Cancel on Side — cancel all orders on same side when filled
  REV:  'ORDER_ATTR_REV',   // Reverse — close current position and open opposite of same size
  NET:  'ORDER_ATTR_NET',   // Net — reduce opposite position by the fill size
  SLTP: 'ORDER_ATTR_SLTP',  // Transfer SL/TP — copy SL/TP levels to the filled position
  ROL:  'ORDER_ATTR_ROL',   // Reverse On Loss — reverse position if closed at a loss
  ROP:  'ORDER_ATTR_ROP',   // Reverse On Profit — reverse position if closed at a profit
  MIT:  'ORDER_ATTR_MIT',   // Market If Touched — convert to market order when price is touched
  FC:   'ORDER_ATTR_FC',    // Fill or Cancel — cancel order if not filled immediately
} as const;
export type OrderAttr = (typeof OrderAttr)[keyof typeof OrderAttr];

export const LimitConfirm = {
  None:      'LIMIT_CONFIRM_NONE',
  Wick:      'LIMIT_CONFIRM_WICK',      // price must wick back from limit level
  WickBreak: 'LIMIT_CONFIRM_WICKBREAK', // wick + body must break back
  WickColor: 'LIMIT_CONFIRM_WICKCOLOR', // wick + confirming candle color
} as const;
export type LimitConfirm = (typeof LimitConfirm)[keyof typeof LimitConfirm];

// ─────────────────────────────────────────────────────────────
// OHLC / Bar
// ─────────────────────────────────────────────────────────────

export interface OHLC {
  open: number; high: number; low: number; close: number;
  time: Date; volume?: number | undefined;
}

/**
 * Single candlestick value object with analysis methods.
 *
 * Provides directional classification, proportional measurements (body/wick/tail
 * as fraction of range), single-bar patterns (hammer, shooting star, doji, solid),
 * price-action breakout/touch detection, time filtering, Fibonacci retracement,
 * and classic pivot points.
 *
 * All proportion and pattern methods accept an optional {@link BarBase} parameter:
 * - `BASE_HILO` (default) — uses high/low for range
 * - `BASE_OPENCLOSE` — uses open/close for range (body-only, ignores wicks)
 */
export class Bar implements OHLC {
  constructor(
    public open:   number,
    public high:   number,
    public low:    number,
    public close:  number,
    public time:   Date,
    public volume?: number,
  ) {}

  /** True when close > open. */
  isBullish(): boolean { return this.close > this.open; }
  /** True when close < open. */
  isBearish(): boolean { return this.close < this.open; }
  /** True when |open − close| ≤ `tol`. */
  isDoji(tol = 0): boolean { return Math.abs(this.open - this.close) <= tol; }

  /** High price (or max(open,close) with `BASE_OPENCLOSE`). */
  effectiveHigh(base: BarBase = BarBase.HiLo): number {
    return base === BarBase.HiLo ? this.high : Math.max(this.open, this.close);
  }
  /** Low price (or min(open,close) with `BASE_OPENCLOSE`). */
  effectiveLow(base: BarBase = BarBase.HiLo): number {
    return base === BarBase.HiLo ? this.low : Math.min(this.open, this.close);
  }

  /** Total range: effectiveHigh − effectiveLow. */
  range(base: BarBase = BarBase.HiLo): number { return this.effectiveHigh(base) - this.effectiveLow(base); }
  /** Upper shadow: high − max(open, close). */
  wickRange(): number { return this.high - Math.max(this.open, this.close); }
  /** Lower shadow: min(open, close) − low. */
  tailRange(): number { return Math.min(this.open, this.close) - this.low; }
  /** Body size: |open − close|. */
  bodyRange(): number { return Math.abs(this.open - this.close); }

  /** Body as fraction of total range [0..1]. */
  bodyPart(base: BarBase = BarBase.HiLo): number { const r = this.range(base); return r === 0 ? 0 : this.bodyRange() / r; }
  /** Lower shadow as fraction of total range [0..1]. */
  tailPart(base: BarBase = BarBase.HiLo): number { const r = this.range(base); return r === 0 ? 0 : this.tailRange() / r; }
  /** Upper shadow as fraction of total range [0..1]. */
  wickPart(base: BarBase = BarBase.HiLo): number { const r = this.range(base); return r === 0 ? 0 : this.wickRange() / r; }

  /** Hammer pattern: long lower shadow, small upper shadow. */
  isHammer(tailMin = 0.55, base: BarBase = BarBase.HiLo): boolean {
    return this.tailPart(base) >= tailMin && this.wickPart(base) <= this.tailPart(base) * 0.5;
  }
  /** Shooting star pattern: long upper shadow, small lower shadow. */
  isShootingStar(wickMin = 0.55, base: BarBase = BarBase.HiLo): boolean {
    return this.wickPart(base) >= wickMin && this.tailPart(base) <= this.wickPart(base) * 0.5;
  }
  /** Solid (marubozu-like): both shadows below thresholds. */
  isSolid(wickMax = 0.15, tailMax = 0.15, base: BarBase = BarBase.HiLo): boolean {
    return this.tailPart(base) <= tailMax && this.wickPart(base) <= wickMax;
  }
  /** Bullish bar with small upper shadow. */
  isSolidBullish(wickMax = 0.15, base: BarBase = BarBase.HiLo): boolean { return this.isBullish() && this.wickPart(base) <= wickMax; }
  /** Bearish bar with small lower shadow. */
  isSolidBearish(tailMax = 0.15, base: BarBase = BarBase.HiLo): boolean { return this.isBearish() && this.tailPart(base) <= tailMax; }

  /** Price opened on one side and closed on the other. */
  isBreaking(price: number): boolean {
    return (this.open > price && this.close < price) || (this.open < price && this.close > price);
  }
  /** Broke upward through `price`, optionally by at least `exceed`. */
  isBreakingLong(price: number, exceed = 0): boolean {
    return this.open < price && this.close > price && this.close > price + exceed;
  }
  /** Broke downward through `price`, optionally by at least `exceed`. */
  isBreakingShort(price: number, exceed = 0): boolean {
    return this.open > price && this.close < price && this.close < price - exceed;
  }
  /** High/low range includes `price`. */
  isCrossing(price: number): boolean { return this.high >= price && this.low <= price; }
  /** Wick touched `price` from above (low ≤ price, body above). */
  isTouchingLow(price: number): boolean {
    return this.low <= price && Math.min(this.open, this.close) >= price;
  }
  /** Wick touched `price` from below (high ≥ price, body below). */
  isTouchingHigh(price: number): boolean {
    return this.high >= price && Math.max(this.open, this.close) <= price;
  }

  /** True if bar's UTC time falls within the given hour:minute range (supports overnight). */
  isInTimeRange(beginH: number, beginM: number, endH: number, endM: number): boolean {
    const begin = beginH * 60 + beginM;
    const end   = endH   * 60 + endM;
    const cur   = this.time.getUTCHours() * 60 + this.time.getUTCMinutes();
    if (end < begin) return cur >= begin || cur <= end;  // overnight
    return cur >= begin && cur <= end;
  }

  /** Fibonacci retracement: `low + range * level` (0 = low, 1 = high, 0.618 = golden ratio). */
  fiboPrice(level: number): number { return this.low + this.range() * level; }

  /**
   * Classic floor trader pivot points.
   * @param type - `PP` (pivot), `R1`/`R2` (resistance), `S1`/`S2` (support)
   */
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

// ─────────────────────────────────────────────────────────────
// Bars series (index 0 = most-recent closed bar)
// ─────────────────────────────────────────────────────────────

/**
 * Time-series of OHLC bars with built-in indicators and pattern detection.
 *
 * Index 0 is the **most recent** closed bar; higher indices are older.
 * All shift parameters follow this convention.
 *
 * **Indicators:** SMA, EMA, LWMA, SMMA, ATR, RSI, Stochastic
 *
 * **Patterns:** Engulfing (long/short), Reversing (long/short), Outside bar
 *
 * **Lookups:** highestHigh/lowestLow (value + shift), binary search by time,
 * daily OHLC aggregation, volume average/ratio, MA slope detection
 */
export class Bars {
  constructor(private readonly data: OHLC[]) {}

  /** Number of bars in the series. */
  get length(): number { return this.data.length; }

  /** Get the {@link Bar} value object at `shift`. Throws if out of range. */
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

  /** Maximum high over `periods` bars starting at `shift`. */
  highestHigh(periods: number, shift = 0): number {
    let max = -Infinity;
    for (let i = shift; i < shift + periods && i < this.data.length; i++) {
      if (this.data[i].high > max) max = this.data[i].high;
    }
    return max;
  }

  /** Minimum low over `periods` bars starting at `shift`. */
  lowestLow(periods: number, shift = 0): number {
    let min = Infinity;
    for (let i = shift; i < shift + periods && i < this.data.length; i++) {
      if (this.data[i].low < min) min = this.data[i].low;
    }
    return min;
  }

  /** Simple Moving Average of close prices. */
  sma(periods: number, shift = 0): number {
    let sum = 0, cnt = 0;
    for (let i = shift; i < shift + periods && i < this.data.length; i++) {
      sum += this.data[i].close; cnt++;
    }
    return cnt === 0 ? 0 : sum / cnt;
  }

  /**
   * Average True Range. Supports SMA/EMA smoothing, directional filtering,
   * and body-only base ({@link BarBase}).
   */
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

  /** Wilder's RSI (Relative Strength Index). Returns 50 if insufficient data. */
  rsi(periods = 14, shift = 0): number {
    // Wilder's RSI needs shift + 2*periods + 1 bars:
    // one set of `periods` changes to seed the SMA, one set to smooth toward shift.
    if (this.data.length < shift + periods * 2 + 1) return 50;
    // Bootstrap: SMA of the oldest `periods` changes
    const base = shift + periods;
    let avgGain = 0, avgLoss = 0;
    for (let i = base; i < base + periods; i++) {
      const diff = this.data[i].close - this.data[i + 1].close;
      if (diff > 0) { avgGain += diff; } else { avgLoss -= diff; }
    }
    avgGain /= periods;
    avgLoss /= periods;
    // Wilder's smoothing from base-1 toward most-recent bar at `shift`
    for (let i = base - 1; i >= shift; i--) {
      const diff = this.data[i].close - this.data[i + 1].close;
      const g = diff > 0 ? diff : 0;
      const l = diff < 0 ? -diff : 0;
      avgGain = (avgGain * (periods - 1) + g) / periods;
      avgLoss = (avgLoss * (periods - 1) + l) / periods;
    }
    return avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }

  /** True if bar at `shift` has the highest high in the `lookback` window behind it. */
  isLocalHigh(lookback: number, shift = 0, tol = 0): boolean {
    const peak = this.data[shift].high;
    for (let i = shift + 1; i <= shift + lookback && i < this.data.length; i++) {
      if (this.data[i].high + tol > peak) return false;
    }
    return true;
  }

  /** True if bar at `shift` has the lowest low in the `lookback` window behind it. */
  isLocalLow(lookback: number, shift = 0, tol = 0): boolean {
    const trough = this.data[shift].low;
    for (let i = shift + 1; i <= shift + lookback && i < this.data.length; i++) {
      if (this.data[i].low - tol < trough) return false;
    }
    return true;
  }

  /** Exponential Moving Average (SMA-seeded, k = 2/(periods+1)). */
  ema(periods: number, shift = 0): number {
    const end = Math.min(shift + periods * 3, this.data.length);
    if (end <= shift) return 0;
    // Seed with SMA of exactly `periods` bars at the deepest end of the window
    const seedStart = Math.max(end - periods, shift);
    let seed = 0, cnt = 0;
    for (let i = seedStart; i < end; i++) { seed += this.data[i].close; cnt++; }
    if (cnt === 0) return this.data[shift].close;
    seed /= cnt;
    // Apply EMA from the bar before the seed range toward shift
    const k = 2 / (periods + 1);
    let ema = seed;
    for (let i = seedStart - 1; i >= shift; i--) {
      ema = this.data[i].close * k + ema * (1 - k);
    }
    return ema;
  }

  /** Bullish engulfing: current bar's low < prev low, close > prev high. */
  isEngulfingLong(shift = 0): boolean {
    if (shift + 1 >= this.data.length) return false;
    return this.data[shift].low < this.data[shift + 1].low
        && this.data[shift].close > this.data[shift + 1].high;
  }

  /** Bearish engulfing: current bar's high > prev high, close < prev low. */
  isEngulfingShort(shift = 0): boolean {
    if (shift + 1 >= this.data.length) return false;
    return this.data[shift].high > this.data[shift + 1].high
        && this.data[shift].close < this.data[shift + 1].low;
  }

  /** Bullish reversal: higher high, higher close, bullish close above prev open. */
  isReversingLong(shift = 0): boolean {
    if (shift + 1 >= this.data.length) return false;
    const cur = this.data[shift], prev = this.data[shift + 1];
    return cur.high > prev.high && cur.close > prev.close
        && cur.close > prev.open && cur.close > cur.open;
  }

  /** Bearish reversal: lower low, lower close, bearish close below prev open. */
  isReversingShort(shift = 0): boolean {
    if (shift + 1 >= this.data.length) return false;
    const cur = this.data[shift], prev = this.data[shift + 1];
    return cur.low < prev.low && cur.close < prev.close
        && cur.close < prev.open && cur.open > cur.close;
  }

  /** Average tick volume over `periods` bars. */
  tickVolumeAverage(periods: number, shift = 0): number {
    let sum = 0, cnt = 0;
    for (let i = shift; i < shift + periods && i < this.data.length; i++) {
      sum += this.data[i].volume ?? 0; cnt++;
    }
    return cnt === 0 ? 0 : sum / cnt;
  }

  /** Current bar's volume divided by the average of the next `periods` bars. */
  volumeRatio(periods: number, shift = 0): number {
    const avg = this.tickVolumeAverage(periods, shift + 1);
    return avg === 0 ? 0 : (this.data[shift]?.volume ?? 0) / avg;
  }

  /** True if the MA forms a monotonic up (or down) slope over `span` consecutive bars. */
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

  /**
   * Stochastic oscillator returning `{ main, signal }` (both 0–100).
   * @param periodK - %K lookback period
   * @param periodD - %D smoothing period (SMA of slowed %K)
   * @param slowing - smoothing applied to raw %K before %D (1 = fast stochastic)
   */
  stochastic(periodK: number, periodD: number, slowing: number, shift = 0): { main: number; signal: number } {
    // Compute raw %K values, then apply slowing (SMA of raw %K), then %D (SMA of slowed %K)
    const rawKValues: number[] = [];
    const needed = shift + slowing + periodD - 1;
    for (let i = shift; i <= needed && i + periodK - 1 < this.data.length; i++) {
      const hh = this.highestHigh(periodK, i);
      const ll = this.lowestLow(periodK, i);
      rawKValues.push(hh === ll ? 50 : ((this.data[i].close - ll) / (hh - ll)) * 100);
    }
    // Slowed %K values = SMA(rawK, slowing)
    const slowedK: number[] = [];
    for (let i = 0; i + slowing <= rawKValues.length; i++) {
      let sum = 0;
      for (let j = i; j < i + slowing; j++) sum += rawKValues[j];
      slowedK.push(sum / slowing);
    }
    const main = slowedK.length > 0 ? slowedK[0] : 50;
    // %D = SMA of slowed %K
    let signal = main;
    if (slowedK.length >= periodD) {
      let sum = 0;
      for (let i = 0; i < periodD; i++) sum += slowedK[i];
      signal = sum / periodD;
    }
    return { main, signal };
  }

  /** Returns the **shift index** (not value) of the highest high in the window. */
  highestHighShift(periods: number, shift = 0): number {
    let max = -Infinity, idx = shift;
    for (let i = shift; i < shift + periods && i < this.data.length; i++) {
      if (this.data[i].high > max) { max = this.data[i].high; idx = i; }
    }
    return idx;
  }

  /** Returns the **shift index** (not value) of the lowest low in the window. */
  lowestLowShift(periods: number, shift = 0): number {
    let min = Infinity, idx = shift;
    for (let i = shift; i < shift + periods && i < this.data.length; i++) {
      if (this.data[i].low < min) { min = this.data[i].low; idx = i; }
    }
    return idx;
  }

  /** Binary search for the bar closest to `datetime`. Returns shift index. */
  getBarShift(datetime: Date): number {
    // Binary search — data is sorted descending by time (index 0 = newest)
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

  /** Scan backward for the nearest bar whose range fully encloses bar at `shift`. Returns shift or -1. */
  findOutsideBar(shift = 0, maxScan = 100): number {
    // Scan backward from shift+1 for a bar whose range encloses bar[shift]
    const ref = this.data[shift];
    if (!ref) return -1;
    const limit = Math.min(shift + 1 + maxScan, this.data.length);
    for (let i = shift + 1; i < limit; i++) {
      if (this.data[i].high >= ref.high && this.data[i].low <= ref.low) return i;
    }
    return -1;
  }

  /** Aggregate intraday bars into daily OHLC. `daysBack=0` = today (most recent day). Returns null if day not found. */
  dayOHLC(daysBack = 0): { open: number; high: number; low: number; close: number; timeBegin: Date; timeEnd: Date } | null {
    // Group intraday bars by UTC date, then pick the Nth day back
    let currentDate = '';
    let dayCount = -1; // will increment to 0 on first date change
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
    // open = oldest bar of the day (highest index), close = newest (lowest index)
    return {
      open: this.data[endIdx - 1].open,
      high,
      low,
      close: this.data[startIdx].close,
      timeBegin: this.data[endIdx - 1].time,
      timeEnd: this.data[startIdx].time,
    };
  }

  /** Linearly Weighted Moving Average — newest bar gets weight `periods`, oldest gets 1. */
  lwma(periods: number, shift = 0): number {
    let weightedSum = 0, weightTotal = 0;
    for (let i = 0; i < periods && shift + i < this.data.length; i++) {
      const w = periods - i; // newest bar gets highest weight
      weightedSum += this.data[shift + i].close * w;
      weightTotal += w;
    }
    return weightTotal === 0 ? 0 : weightedSum / weightTotal;
  }

  /** Smoothed Moving Average (Wilder's): `prev × (n−1)/n + close/n`. SMA-seeded. */
  smma(periods: number, shift = 0): number {
    // Wilder's smoothed MA: seed with SMA of deeper bars, then smooth toward shift
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

// ─────────────────────────────────────────────────────────────
// Crossing helpers (standalone — work on any two value series)
// ─────────────────────────────────────────────────────────────

/** True when A crosses above B: previously A ≤ B, now A > B. Works with any indicator pair. */
export function isCrossingAbove(valueA: number, valueB: number, prevA: number, prevB: number): boolean {
  return prevA <= prevB && valueA > valueB;
}

/** True when A crosses below B: previously A ≥ B, now A < B. Works with any indicator pair. */
export function isCrossingBelow(valueA: number, valueB: number, prevA: number, prevB: number): boolean {
  return prevA >= prevB && valueA < valueB;
}

// ─────────────────────────────────────────────────────────────
// Symbol metadata
// ─────────────────────────────────────────────────────────────

/** Discriminator for the symbol class hierarchy. */
export const AssetType = {
  Forex:  'FOREX',
  Stock:  'STOCK',
  Future: 'FUTURE',
  Crypto: 'CRYPTO',
  Index:  'INDEX',
} as const;
export type AssetType = (typeof AssetType)[keyof typeof AssetType];

/**
 * Abstract base for all symbol descriptors.
 *
 * Holds the symbol `name`, decimal `digits`, and the derived `pointSize`
 * (`10 ** -digits`). Shared conversion helpers are defined here so every
 * subclass inherits identical math.
 *
 * @example
 * // Subclass for a custom asset type
 * class SymbolInfoCrypto extends SymbolInfoBase {
 *   readonly assetType = AssetType.Crypto;
 * }
 */
export abstract class SymbolInfoBase {
  /** Smallest price increment: `10 ** -digits`. */
  readonly pointSize: number;
  /** Asset-class discriminator — set by each concrete subclass. */
  abstract readonly assetType: AssetType;

  constructor(
    /** Broker symbol name, e.g. `'EURUSD'` or `'AAPL'`. */
    public readonly name: string,
    /** Number of decimal places in the price, e.g. `5` for forex. */
    public readonly digits: number,
  ) {
    this.pointSize = 10 ** -digits;
  }

  /** Convert a raw price value to points (integer multiples of `pointSize`). */
  priceToPoints(price: number): number  { return price / this.pointSize; }
  /** Convert points back to a price value. */
  pointsToPrice(points: number): number { return points * this.pointSize; }
  /** Round `price` to `digits` decimal places. */
  normalize(price: number): number { return parseFloat(price.toFixed(this.digits)); }
}

/**
 * Symbol descriptor for forex currency pairs.
 *
 * Automatically extracts `baseCurrency` and `quoteCurrency` from the
 * first six characters of `name`.
 *
 * @example
 * const sym = new SymbolInfoForex('EURUSD', 5);
 * sym.baseCurrency;          // 'EUR'
 * sym.quoteCurrency;         // 'USD'
 * sym.pointSize;             // 0.00001
 * sym.priceToPoints(0.0001); // 10
 */
export class SymbolInfoForex extends SymbolInfoBase {
  readonly assetType = AssetType.Forex;
  /** First three characters of the symbol name (base currency). */
  readonly baseCurrency: string;
  /** Characters 3–5 of the symbol name (quote currency). */
  readonly quoteCurrency: string;

  constructor(name: string, digits: number) {
    super(name, digits);
    this.baseCurrency  = name.slice(0, 3).toUpperCase();
    this.quoteCurrency = name.slice(3, 6).toUpperCase();
  }
}

/**
 * Symbol descriptor for equities.
 *
 * @example
 * const sym = new SymbolInfoStock('AAPL', 2, 'NASDAQ');
 * sym.exchange; // 'NASDAQ'
 */
export class SymbolInfoStock extends SymbolInfoBase {
  readonly assetType = AssetType.Stock;

  constructor(
    name: string,
    digits: number,
    /** Optional exchange identifier, e.g. `'NYSE'` or `'NASDAQ'`. */
    readonly exchange?: string,
  ) {
    super(name, digits);
  }
}

/**
 * Symbol descriptor for futures contracts.
 *
 * @example
 * const sym = new SymbolInfoFuture('ES', 2, 50); // E-mini S&P 500
 * sym.contractSize; // 50
 */
export class SymbolInfoFuture extends SymbolInfoBase {
  readonly assetType = AssetType.Future;

  constructor(
    name: string,
    digits: number,
    /** Number of underlying units per contract (default `1`). */
    readonly contractSize: number = 1,
  ) {
    super(name, digits);
  }
}

/** @deprecated Use {@link SymbolInfoForex} directly. Kept for backward compatibility. */
export { SymbolInfoForex as SymbolInfo };

// ─────────────────────────────────────────────────────────────
// Trailing-stop calculation (per-bar, pure function)
// ─────────────────────────────────────────────────────────────

export interface TrailConfig {
  mode:        TrailMode;
  distancePts: number;
  periods:     number;
}

export interface TrailState {
  active: boolean;
  plhRef: number;
}

/**
 * Returns the updated SL price after applying the trail rule.
 * Call once per new closed bar while a position is open.
 */
export function calcTrailingSL(p: {
  side:          Side;
  bar:           Bar;
  bars:          Bars;
  posPrice:      number;
  currentSL:     number;   // -1 = not yet set
  spreadAbs:     number;
  trailBeginPts: number;
  trail:         TrailConfig;
  state:         TrailState; // mutable
  symbol:        SymbolInfoBase;
}): number {
  const { side, bar, bars, posPrice, spreadAbs, trail, state, symbol } = p;
  let { currentSL } = p;
  if (trail.mode === TrailMode.None) return currentSL;

  const beginPrice = symbol.pointsToPrice(p.trailBeginPts);
  const distPrice  = symbol.pointsToPrice(Math.abs(trail.distancePts));
  const distFrac   = trail.distancePts < 0 ? Math.abs(trail.distancePts) / 1000 : 0;

  if (side === Side.Long) {
    if (bar.high < posPrice + beginPrice) return currentSL;
    state.active = true;
    let cand = -Infinity;
    switch (trail.mode) {
      case TrailMode.Dst:      cand = bar.high - distPrice; break;
      case TrailMode.Eop:      cand = bars.lowestLow(trail.periods)  - distPrice; break;
      case TrailMode.Ma:       cand = bars.sma(trail.periods)        - distPrice; break;
      case TrailMode.PlhPeak:  if (bar.high > state.plhRef) { state.plhRef = bar.high;  cand = bar.low  - distPrice; } break;
      case TrailMode.PlhClose: if (bar.close > state.plhRef){ state.plhRef = bar.close; cand = bar.low  - distPrice; } break;
      case TrailMode.Prx:
        if (bar.close > state.plhRef) {
          state.plhRef = bar.high;
          cand = distFrac > 0 ? bar.low - bar.range() * distFrac : bar.low - distPrice;
        }
        break;
      default: break;
    }
    if (cand > -Infinity) currentSL = Math.max(currentSL === -1 ? -Infinity : currentSL, cand);

  } else if (side === Side.Short) {
    if (bar.low + spreadAbs > posPrice - beginPrice) return currentSL;
    state.active = true;
    let cand = Infinity;
    switch (trail.mode) {
      case TrailMode.Dst:      cand = bar.low  + distPrice; break;
      case TrailMode.Eop:      cand = bars.highestHigh(trail.periods) + distPrice; break;
      case TrailMode.Ma:       cand = bars.sma(trail.periods)         + distPrice; break;
      case TrailMode.PlhPeak:  if (bar.low  < state.plhRef) { state.plhRef = bar.low;   cand = bar.high + distPrice; } break;
      case TrailMode.PlhClose: if (bar.close < state.plhRef){ state.plhRef = bar.close; cand = bar.high + distPrice; } break;
      case TrailMode.Prx:
        if (bar.close < state.plhRef) {
          state.plhRef = bar.low;
          cand = distFrac > 0 ? bar.high + bar.range() * distFrac : bar.high + distPrice;
        }
        break;
      default: break;
    }
    cand += spreadAbs;
    if (cand < Infinity)
      currentSL = currentSL === -1 ? cand : Math.min(currentSL, cand);
  }

  return currentSL;
}

// ─────────────────────────────────────────────────────────────
// SL/TP hit detection (pure function)
// ─────────────────────────────────────────────────────────────

export type ExitReason = 'SL' | 'TP' | 'SL_BOTH' | 'TP_BOTH';

export interface HitResult {
  reason:    ExitReason;
  exitPrice: number;
}

export function checkSLTP(p: {
  side:        Side;
  bar:         Bar;
  sl:          number;      // -1 = disabled
  tp:          number;      // -1 = disabled
  slActive:    boolean;
  tpActive:    boolean;
  trailActive: boolean;     // trail started → SL is enforced
  spreadAbs:   number;
}): HitResult | null {
  const { side, bar, sl, tp, slActive, tpActive, trailActive, spreadAbs } = p;
  const slOn = (slActive || trailActive) && sl > 0;
  const tpOn = tpActive && tp > 0;

  if (side === Side.Long) {
    const slHit = slOn && bar.low  <= sl;
    const tpHit = tpOn && bar.high >= tp;
    if (!slHit && !tpHit) return null;
    if (slHit && tpHit) {
      // MQL rule: Long → SL always wins (conservative worst-case assumption)
      return { reason: 'SL_BOTH', exitPrice: Math.min(bar.open, sl) };
    }
    // Gap clamping matches MQL _SimCheckSLTP:
    //   SL adverse gap (bar.open < sl)  → fill at bar.open (slippage)
    //   TP favorable gap (bar.open > tp) → fill at bar.open (gap benefit)
    if (slHit) return { reason: 'SL', exitPrice: Math.min(bar.open, sl) };
    return          { reason: 'TP', exitPrice: Math.max(bar.open, tp) };
  }

  if (side === Side.Short) {
    const slHit = slOn && bar.high + spreadAbs >= sl;
    const tpHit = tpOn && bar.low  + spreadAbs <= tp;
    if (!slHit && !tpHit) return null;
    if (slHit && tpHit) {
      // MQL rule: Short → TP always wins (conservative worst-case assumption)
      return { reason: 'TP_BOTH', exitPrice: Math.min(bar.open, tp) };
    }
    // Gap clamping matches MQL _SimCheckSLTP:
    //   SL adverse gap (bar.open > sl)  → fill at bar.open (slippage)
    //   TP favorable gap (bar.open < tp) → fill at bar.open (gap benefit)
    if (slHit) return { reason: 'SL', exitPrice: Math.max(bar.open, sl) };
    return          { reason: 'TP', exitPrice: Math.min(bar.open, tp) };
  }

  return null;
}

// ─────────────────────────────────────────────────────────────
// Order book — pending orders with all special attributes
// ─────────────────────────────────────────────────────────────

export type OrderEntryType =
  | 'BUY_LIMIT'       // filled when price drops to limit
  | 'BUY_STOP'        // filled when price rises to stop
  | 'SELL_LIMIT'      // filled when price rises to limit
  | 'SELL_STOP'       // filled when price drops to stop
  | 'BUY_MIT'         // Market-if-Touched — buy at market when price touches level
  | 'SELL_MIT'        // Market-if-Touched — sell at market when price touches level
  | 'BUY_STOP_LIMIT'  // stop-limit buy: stop at price, fill only at or below limitPrice
  | 'SELL_STOP_LIMIT' // stop-limit sell: stop at price, fill only at or above limitPrice
  | 'BUY_MTO'         // Market-To-Order buy: pending limit below market, fills as market when touched
  | 'SELL_MTO';       // Market-To-Order sell: pending limit above market, fills as market when touched

// ─────────────────────────────────────────────────────────────
// Order class hierarchy — polymorphic pending orders
// ─────────────────────────────────────────────────────────────

interface OrderParams {
  id:            string;
  type:          OrderEntryType;
  side:          Side;
  price:         number;
  size:          number;
  time:          Date;
  oco?:          boolean;
  co?:           boolean;
  cs?:           boolean;
  rev?:          boolean;
  bracketSL?:    number;
  bracketTP?:    number;
  limitConfirm?: LimitConfirm;
  pullbackPts?:  number;
}

/** Abstract base for all pending orders. Each subclass owns fill logic. */
export abstract class Order {
  readonly id:            string;
  readonly type:          OrderEntryType;
  readonly side:          Side;
  price:                  number;   // mutable — trailing orders update this each bar
  readonly size:          number;
  readonly time:          Date;
  // Execution modifiers — composable, applicable to any order type
  oco:           boolean;
  co:            boolean;
  cs:            boolean;
  rev:           boolean;
  bracketSL?:    number;
  bracketTP?:    number;
  limitConfirm?: LimitConfirm;
  pullbackPts?:  number;
  // Internal: trailing/pullback reference price
  protected _trailRef?: number;

  constructor(p: OrderParams) {
    this.id           = p.id;
    this.type         = p.type;
    this.side         = p.side;
    this.price        = p.price;
    this.size         = p.size;
    this.time         = p.time;
    this.oco          = p.oco  ?? false;
    this.co           = p.co   ?? false;
    this.cs           = p.cs   ?? false;
    this.rev          = p.rev  ?? false;
    this.bracketSL    = p.bracketSL;
    this.bracketTP    = p.bracketTP;
    this.limitConfirm = p.limitConfirm;
    this.pullbackPts  = p.pullbackPts;
  }

  abstract isFilled(bar: Bar): boolean;
  abstract computeFillPrice(bar: Bar): number;

  /** True when fill must be routed through broker.marketOrder() (MIT and MTO types). */
  get fillsAtMarket(): boolean { return false; }

  /** Per-bar: update this.price for pullback orders. TrailingOrder overrides for trail entry. */
  updateTrailingRef(bar: Bar, _bars: Bars, symbol: SymbolInfoBase): void {
    if (this.pullbackPts == null) return;
    const pullDist = symbol.pointsToPrice(this.pullbackPts);
    if (this.side === Side.Long) {
      if (bar.high > (this._trailRef ?? -Infinity)) {
        this._trailRef = bar.high;
        this.price     = bar.high - pullDist;
      }
    } else {
      if (bar.low < (this._trailRef ?? Infinity)) {
        this._trailRef = bar.low;
        this.price     = bar.low + pullDist;
      }
    }
  }

  /** Returns shape expected by PendingOrderSchema and RedisEventBridge. */
  toJSON(): { id: string; type: OrderEntryType; side: Side; price: number; size: number; time: Date } {
    return { id: this.id, type: this.type, side: this.side, price: this.price, size: this.size, time: this.time };
  }
}

export class LimitOrder extends Order {
  isFilled(bar: Bar): boolean {
    return this.side === Side.Long ? bar.low <= this.price : bar.high >= this.price;
  }
  // Gap clamping: MathMax(price, bar_open) for buys, MathMin for sells (MQL GetFillPrice)
  computeFillPrice(bar: Bar): number {
    return this.side === Side.Long ? Math.max(this.price, bar.open) : Math.min(this.price, bar.open);
  }
}

export class StopOrder extends Order {
  isFilled(bar: Bar): boolean {
    return this.side === Side.Long ? bar.high >= this.price : bar.low <= this.price;
  }
  computeFillPrice(bar: Bar): number {
    return this.side === Side.Long ? Math.max(this.price, bar.open) : Math.min(this.price, bar.open);
  }
}

export class MITOrder extends Order {
  // MIT triggers like a limit — touched from the opposite side
  isFilled(bar: Bar): boolean {
    return this.side === Side.Long ? bar.low <= this.price : bar.high >= this.price;
  }
  computeFillPrice(bar: Bar): number { return bar.close; }
  override get fillsAtMarket(): boolean { return true; }
}

export class StopLimitOrder extends Order {
  readonly limitPrice: number;  // always required — impossible state eliminated at type level

  constructor(p: OrderParams & { limitPrice: number }) {
    super(p);
    this.limitPrice = p.limitPrice;
  }
  // Stop trigger: same as StopOrder
  isFilled(bar: Bar): boolean {
    return this.side === Side.Long ? bar.high >= this.price : bar.low <= this.price;
  }
  computeFillPrice(bar: Bar): number {
    return this.side === Side.Long ? Math.max(this.limitPrice, bar.open) : Math.min(this.limitPrice, bar.open);
  }

  /** True if the bar's range covers the limit price (fill can proceed). */
  limitCovered(bar: Bar): boolean {
    return this.side === Side.Long
      ? bar.low  <= this.limitPrice   // bar reached the buy limit ceiling
      : bar.high >= this.limitPrice;  // bar reached the sell limit floor
  }
}

// ─────────────────────────────────────────────────────────────
// Trailing-entry orders — price follows the market each bar
// ─────────────────────────────────────────────────────────────

interface TrailingOrderParams extends OrderParams {
  trailEntry: { mode: TrailMode; distPts: number; periods: number };
  _trailRef:  number;
}

export abstract class TrailingOrder extends Order {
  readonly trailEntry: { mode: TrailMode; distPts: number; periods: number };

  constructor(p: TrailingOrderParams) {
    super(p);
    this.trailEntry = p.trailEntry;
    this._trailRef  = p._trailRef;
  }

  override updateTrailingRef(bar: Bar, _bars: Bars, symbol: SymbolInfoBase): void {
    // Pullback takes priority
    if (this.pullbackPts != null) { super.updateTrailingRef(bar, _bars, symbol); return; }
    const dist = symbol.pointsToPrice(this.trailEntry.distPts);
    if (this.type === 'BUY_LIMIT') {
      if (bar.high > (this._trailRef ?? -Infinity)) { this._trailRef = bar.high; this.price = bar.high - dist; }
    } else if (this.type === 'SELL_LIMIT') {
      if (bar.low  < (this._trailRef ?? Infinity))  { this._trailRef = bar.low;  this.price = bar.low  + dist; }
    } else if (this.type === 'BUY_STOP' || this.type === 'BUY_MTO') {
      if (bar.low  < (this._trailRef ?? Infinity))  { this._trailRef = bar.low;  this.price = bar.low  + dist; }
    } else if (this.type === 'SELL_STOP' || this.type === 'SELL_MTO') {
      if (bar.high > (this._trailRef ?? -Infinity)) { this._trailRef = bar.high; this.price = bar.high - dist; }
    }
  }
}

export class TrailingLimitOrder extends TrailingOrder {
  isFilled(bar: Bar): boolean {
    return this.side === Side.Long ? bar.low <= this.price : bar.high >= this.price;
  }
  computeFillPrice(bar: Bar): number {
    return this.side === Side.Long ? Math.max(this.price, bar.open) : Math.min(this.price, bar.open);
  }
}

export class TrailingStopOrder extends TrailingOrder {
  isFilled(bar: Bar): boolean {
    return this.side === Side.Long ? bar.high >= this.price : bar.low <= this.price;
  }
  computeFillPrice(bar: Bar): number {
    return this.side === Side.Long ? Math.max(this.price, bar.open) : Math.min(this.price, bar.open);
  }
}

export class MTOOrder extends TrailingOrder {
  // MTO triggers like a stop
  isFilled(bar: Bar): boolean {
    return this.side === Side.Long ? bar.high >= this.price : bar.low <= this.price;
  }
  computeFillPrice(bar: Bar): number { return bar.close; }
  override get fillsAtMarket(): boolean { return true; }
}

// ─────────────────────────────────────────────────────────────
// Type guards
// ─────────────────────────────────────────────────────────────

export function isTrailingOrder(o: Order): o is TrailingOrder   { return o instanceof TrailingOrder;   }
export function isStopLimitOrder(o: Order): o is StopLimitOrder { return o instanceof StopLimitOrder; }

// ─────────────────────────────────────────────────────────────
// OrderFactory — discriminated-union parameter type
// ─────────────────────────────────────────────────────────────

type CreateOrderBase = Omit<OrderParams, 'type'>;

interface CreateLimitParams extends CreateOrderBase {
  type: 'BUY_LIMIT' | 'SELL_LIMIT';
}

interface CreateStopParams extends CreateOrderBase {
  type: 'BUY_STOP' | 'SELL_STOP';
}

interface CreateMITParams extends CreateOrderBase {
  type: 'BUY_MIT' | 'SELL_MIT';
}

interface CreateStopLimitParams extends CreateOrderBase {
  type: 'BUY_STOP_LIMIT' | 'SELL_STOP_LIMIT';
  limitPrice: number;
}

interface CreateTrailingLimitParams extends CreateOrderBase {
  type: 'BUY_LIMIT' | 'SELL_LIMIT';
  trailEntry: { mode: TrailMode; distPts: number; periods: number };
  _trailRef:  number;
}

interface CreateTrailingStopParams extends CreateOrderBase {
  type: 'BUY_STOP' | 'SELL_STOP';
  trailEntry: { mode: TrailMode; distPts: number; periods: number };
  _trailRef:  number;
}

interface CreateMTOParams extends CreateOrderBase {
  type: 'BUY_MTO' | 'SELL_MTO';
  trailEntry: { mode: TrailMode; distPts: number; periods: number };
  _trailRef:  number;
}

export type CreateOrderParams =
  | CreateLimitParams
  | CreateStopParams
  | CreateMITParams
  | CreateStopLimitParams
  | CreateTrailingLimitParams
  | CreateTrailingStopParams
  | CreateMTOParams;

export function createOrder(params: CreateOrderParams): Order {
  // MTO — always trailing
  if (params.type === 'BUY_MTO' || params.type === 'SELL_MTO') {
    return new MTOOrder(params as CreateMTOParams);
  }

  // Stop-limit — needs limitPrice
  if (params.type === 'BUY_STOP_LIMIT' || params.type === 'SELL_STOP_LIMIT') {
    return new StopLimitOrder(params as CreateStopLimitParams);
  }

  // Trailing variants (limit or stop with trailEntry)
  if ('trailEntry' in params) {
    if (params.type === 'BUY_LIMIT' || params.type === 'SELL_LIMIT') {
      return new TrailingLimitOrder(params as CreateTrailingLimitParams);
    }
    return new TrailingStopOrder(params as CreateTrailingStopParams);
  }

  // Simple types
  switch (params.type) {
    case 'BUY_LIMIT':  case 'SELL_LIMIT': return new LimitOrder(params);
    case 'BUY_STOP':   case 'SELL_STOP':  return new StopOrder(params);
    case 'BUY_MIT':    case 'SELL_MIT':   return new MITOrder(params);
  }
}

// ─────────────────────────────────────────────────────────────
// Individual position slot
// Hedging mode allows one Long and one Short simultaneously.
// ─────────────────────────────────────────────────────────────

export interface PositionSlot {
  side:        Side;
  size:        number;
  openPrice:   number;
  openTime:    Date;
  sl:          number;   // -1 = not set
  tp:          number;   // -1 = not set
  slOffsetPts: number;   // 0 = not set; panel setting — preserved across closes
  tpOffsetPts: number;   // 0 = not set; panel setting — preserved across closes
  slActive:    boolean;
  tpActive:    boolean;
  trailCfg:   TrailConfig;
  trailState: TrailState;
  trailActive: boolean;
  trailBeginPts: number;
  beActive:   boolean;
  beAddPts:   number;
  // Per-trade tracking (reset on close)
  barsHeld:    number;   // bars the position has been open
  entryReason: string;   // 'market', order type, etc.
  mae:         number;   // Maximum Adverse Excursion in points (≥ 0)
  mfe:         number;   // Maximum Favorable Excursion in points (≥ 0)
}

function emptySlot(side: Side): PositionSlot {
  return {
    side, size: 0, openPrice: -1, openTime: new Date(0),
    sl: -1, tp: -1, slOffsetPts: 0, tpOffsetPts: 0, slActive: false, tpActive: false,
    trailCfg:   { mode: TrailMode.None, distancePts: 0, periods: 0 },
    trailState: { active: false, plhRef: side === Side.Long ? 0 : Infinity },
    trailActive: false, trailBeginPts: 0,
    beActive: false, beAddPts: 0,
    barsHeld: 0, entryReason: '', mae: 0, mfe: 0,
  };
}

// ─────────────────────────────────────────────────────────────
// Closed-trade record — ported from CSEADeal in SEA_OrderManagement.mqh
// ─────────────────────────────────────────────────────────────

/** Maximum number of deal records retained before oldest entries are discarded. */
const MAX_DEALS = 10_000;

export interface DealRecord {
  id:          number;
  side:        Side;
  entryPrice:  number;
  exitPrice:   number;
  size:        number;
  openTime:    Date;
  closeTime:   Date;
  barsHeld:    number;
  entryReason: string;
  exitReason:  string;
  /** Gross P&L in points from the position holder's perspective. */
  plPoints:    number;
  result:      'win' | 'loss' | 'breakeven';
  /** Maximum Adverse Excursion — worst intra-trade drawdown in points. */
  mae:         number;
  /** Maximum Favorable Excursion — best intra-trade run-up in points. */
  mfe:         number;
}

/** Cumulative backtest statistics — ported from SDealStats in SEA_OrderManagement.mqh. */
export interface DealStats {
  totalDeals:     number;
  winningDeals:   number;
  losingDeals:    number;
  breakevenDeals: number;
  grossProfitPts: number;
  grossLossPts:   number;    // always ≤ 0
  netPLPts:       number;
  maxWinStreak:   number;
  maxLossStreak:  number;
  maxDrawdownPts: number;    // always ≥ 0
  marRatio:       number;    // netPL / maxDrawdown (0 when drawdown = 0)
}

/** Computed statistics derived from DealStats (call after every update). */
export function dealStatsComputed(s: DealStats): {
  winRate:         number;
  profitFactor:    number;
  avgWinPts:       number;
  avgLossPts:      number;
  expectedValuePts: number;
} {
  const winRate      = s.totalDeals > 0 ? s.winningDeals / s.totalDeals : 0;
  const profitFactor = s.grossLossPts !== 0 ? Math.abs(s.grossProfitPts / s.grossLossPts) : Infinity;
  const avgWinPts    = s.winningDeals > 0 ? s.grossProfitPts / s.winningDeals : 0;
  const avgLossPts   = s.losingDeals  > 0 ? s.grossLossPts  / s.losingDeals  : 0;
  const expectedValuePts = winRate * avgWinPts + (1 - winRate) * avgLossPts;
  return { winRate, profitFactor, avgWinPts, avgLossPts, expectedValuePts };
}

// ─────────────────────────────────────────────────────────────
// Broker adapter interface
// ─────────────────────────────────────────────────────────────

export interface ExecutionReport {
  price: number;
  time:  Date;
  id:    string;
}

export interface IBrokerAdapter {
  /** Open a new position (or add to existing) at market. */
  marketOrder(side: Side, size: number, info?: string): Promise<ExecutionReport>;
  /** Close (or partially close) a position at market. */
  closePosition(side: Side, size: number, info?: string): Promise<{ price: number }>;
  /** Push SL/TP to broker (e.g. native stop-loss). Pass null to remove. */
  updateSLTP(side: Side, sl: number | null, tp: number | null): Promise<void>;
  /** Current bid-ask spread in price units. */
  getSpread(symbol: string): Promise<number>;
  /** Account data. */
  getAccount(): Promise<{ equity: number; balance: number }>;
}

// ─────────────────────────────────────────────────────────────
// TradingEngine — main state machine
// ─────────────────────────────────────────────────────────────

/**
 * Core hedging engine — maintains one long slot and one short slot simultaneously.
 *
 * ## Setter-then-act pattern
 * ```ts
 * engine.sl(200);         // 200-point SL offset applied on next fill
 * engine.tp(400);         // 400-point TP offset
 * await engine.buy();     // SL and TP computed from the fill price
 * ```
 *
 * ## Pending orders with bracket
 * ```ts
 * engine.bracketSL(100);
 * engine.addBuyLimit(1.0950);    // bracket SL applied automatically when limit fills
 * await engine.onBar(bar, bars); // drives fills, trail updates, and SL/TP exits
 * ```
 *
 * @param symbol  Instrument metadata (name + decimal digits).
 * @param broker  Live or simulated broker adapter.
 * @param hedging When `false`, entering a new direction closes the opposite position first (net mode).
 */
export class TradingEngine {
  // Hedging: separate slots for long and short
  private longPos:  PositionSlot = emptySlot(Side.Long);
  private shortPos: PositionSlot = emptySlot(Side.Short);

  private orders: Order[] = [];
  private _orderSeq = 0;

  // Defaults applied to next order/position
  private _nextOrderSize      = 1;
  private _nextBracketSL?: number;
  private _nextBracketTP?: number;
  private _nextPullback?: number;
  private _nextOCO     = false;
  private _nextCO      = false;
  private _nextCS      = false;
  private _nextREV     = false;
  private _nextLimitConfirm: LimitConfirm = LimitConfirm.None;
  private _removeOrdersOnFlat = false;

  // Spread cache
  private _spreadAbs = 0;

  // Last bar timestamp — used for deterministic deal close-time in _closeSlot
  private _lastBarTime: Date = new Date(0);

  // Deal history and statistics — ported from CSEADeal / SDealStats
  private _deals: DealRecord[] = [];
  private _dealSeq = 0;
  private _stats: DealStats = {
    totalDeals: 0, winningDeals: 0, losingDeals: 0, breakevenDeals: 0,
    grossProfitPts: 0, grossLossPts: 0, netPLPts: 0,
    maxWinStreak: 0, maxLossStreak: 0, maxDrawdownPts: 0, marRatio: 0,
  };
  private _runningEquityPts  = 0;
  private _maxEquityPeak     = 0;
  private _currentWinStreak  = 0;
  private _currentLossStreak = 0;

  // Global default SL/TP applied when no explicit bracket is set (MQL _ResolveSLDist/_ResolveTPDist)
  private _defaultSLDist = 0;
  private _defaultTPDist = 0;

  constructor(
    private readonly symbol:  SymbolInfoBase,
    private readonly broker:  IBrokerAdapter,
    private readonly hedging  = true,   // false = net-mode (like MT4 non-hedge)
  ) {}

  // ──────────────────────────────────────────────────────────
  // Per-bar main loop
  // ──────────────────────────────────────────────────────────

  /**
   * Call this on every new closed bar.
   * Sequence (matches MQL _SimOnNewBar):
   *   1. Update trailing-entry order prices
   *   2. Increment barsHeld + update MAE/MFE + trailing SL + break-even + SL/TP exits
   *   3. Fill pending orders (exits fire before new fills on the same bar)
   */
  async onBar(bar: Bar, bars: Bars): Promise<void> {
    this._spreadAbs = await this.broker.getSpread(this.symbol.name);
    this._lastBarTime = bar.time;

    await this._updateTrailingEntryOrders(bar, bars);

    for (const slot of [this.longPos, this.shortPos]) {
      if (slot.size === 0) continue;
      slot.barsHeld++;
      this._updateMAEMFE(slot, bar);
      await this._updateTrailingSL(slot, bar, bars);
      await this._updateBreakEven(slot, bar);
      await this._checkExits(slot, bar);
    }

    await this._checkOrderFills(bar, bars);
  }

  // ──────────────────────────────────────────────────────────
  // Market order execution
  // ──────────────────────────────────────────────────────────

  /**
   * Open (or add to) a long position at market.
   * In net mode (`hedging=false`) closes any open short first.
   * Applies pending bracket SL/TP from {@link bracketSL} / {@link bracketTP}.
   */
  async buy(size?: number, info?: string): Promise<boolean> {
    const s = size ?? this._nextOrderSize;
    if (!this.hedging && this.shortPos.size > 0) await this._closeSlot(this.shortPos, info);
    const r = await this.broker.marketOrder(Side.Long, s, info);
    this._applyFill(this.longPos, r.price, s, r.time, info ?? 'market');
    this._applyBracket(this.longPos);
    await this._pushSLTP(this.longPos);
    return true;
  }

  /**
   * Open (or add to) a short position at market.
   * In net mode (`hedging=false`) closes any open long first.
   * Applies pending bracket SL/TP from {@link bracketSL} / {@link bracketTP}.
   */
  async sell(size?: number, info?: string): Promise<boolean> {
    const s = size ?? this._nextOrderSize;
    if (!this.hedging && this.longPos.size > 0) await this._closeSlot(this.longPos, info);
    const r = await this.broker.marketOrder(Side.Short, s, info);
    this._applyFill(this.shortPos, r.price, s, r.time, info ?? 'market');
    this._applyBracket(this.shortPos);
    await this._pushSLTP(this.shortPos);
    return true;
  }

  /**
   * Close the long position.
   * @param minProfit   PL threshold (price-units × size). Close is skipped when PL < minProfit.
   * @param currentPrice  Required to evaluate `minProfit`. When omitted the close always proceeds.
   * @returns `true` if a close was issued, `false` if flat or blocked by the PL guard.
   */
  async closeBuy(minProfit = -Infinity, currentPrice?: number): Promise<boolean> {
    if (this.longPos.size === 0) return false;
    if (minProfit > -Infinity && currentPrice !== undefined && this._slotPL(this.longPos, currentPrice) < minProfit) return false;
    return this._closeSlot(this.longPos);
  }

  /** Close the short position. See {@link closeBuy} for parameter semantics. */
  async closeSell(minProfit = -Infinity, currentPrice?: number): Promise<boolean> {
    if (this.shortPos.size === 0) return false;
    if (minProfit > -Infinity && currentPrice !== undefined && this._slotPL(this.shortPos, currentPrice) < minProfit) return false;
    return this._closeSlot(this.shortPos);
  }

  /** Close both positions. Returns `true` if at least one side was closed. */
  async closeAll(minProfit = -Infinity, currentPrice?: number): Promise<boolean> {
    const a = await this.closeBuy(minProfit, currentPrice);
    const b = await this.closeSell(minProfit, currentPrice);
    return a || b;
  }

  async flat(): Promise<boolean> {
    await this.closeAll();
    await this.deleteAllOrders();
    return true;
  }

  async flatLong():  Promise<boolean> { await this.closeBuy();  await this.deleteBuyOrders();  return true; }
  async flatShort(): Promise<boolean> { await this.closeSell(); await this.deleteSellOrders(); return true; }

  async hedgeAll(): Promise<boolean> {
    if (this.longPos.size  > 0) await this.sell(this.longPos.size);
    if (this.shortPos.size > 0) await this.buy(this.shortPos.size);
    return true;
  }

  // ──────────────────────────────────────────────────────────
  // Pending orders
  // ──────────────────────────────────────────────────────────

  /** Buy-limit: buy when price drops to `price`. */
  addBuyLimit(price: number, size?: number): string {
    return this._addOrder('BUY_LIMIT', Side.Long, price, size).id;
  }

  /** Buy-stop: buy when price rises to `price`. */
  addBuyStop(price: number, size?: number): string {
    return this._addOrder('BUY_STOP', Side.Long, price, size).id;
  }

  /** Sell-limit: sell when price rises to `price`. */
  addSellLimit(price: number, size?: number): string {
    return this._addOrder('SELL_LIMIT', Side.Short, price, size).id;
  }

  /** Sell-stop: sell when price drops to `price`. */
  addSellStop(price: number, size?: number): string {
    return this._addOrder('SELL_STOP', Side.Short, price, size).id;
  }

  /**
   * MIT — Market If Touched.
   * Buy: converts to market buy the first time price touches `price` (from above).
   * Sell: converts to market sell the first time price touches `price` (from below).
   */
  addBuyMIT(price: number, size?: number): string {
    return this._addOrder('BUY_MIT', Side.Long, price, size).id;
  }

  addSellMIT(price: number, size?: number): string {
    return this._addOrder('SELL_MIT', Side.Short, price, size).id;
  }

  /**
   * Stop-limit buy: triggers when price rises to `stopPrice`, then fills as a
   * limit buy only if the bar's low reaches `limitPrice` (must be ≤ stopPrice).
   * If `limitPrice` is not reached on the trigger bar the order converts to a
   * plain BUY_LIMIT at `limitPrice` for subsequent bars.
   */
  addBuyStopLimit(stopPrice: number, limitPrice: number, size?: number): string {
    const id = `ord_${++this._orderSeq}`;
    const p  = this._consumeNextParams(id, 'BUY_STOP_LIMIT', Side.Long, stopPrice, size);
    this._resetNextAttrs();
    const o = createOrder({ ...p, limitPrice });
    this.orders.push(o);
    return o.id;
  }

  /**
   * Stop-limit sell: triggers when price drops to `stopPrice`, then fills as a
   * limit sell only if the bar's high reaches `limitPrice` (must be ≥ stopPrice).
   */
  addSellStopLimit(stopPrice: number, limitPrice: number, size?: number): string {
    const id = `ord_${++this._orderSeq}`;
    const p  = this._consumeNextParams(id, 'SELL_STOP_LIMIT', Side.Short, stopPrice, size);
    this._resetNextAttrs();
    const o = createOrder({ ...p, limitPrice });
    this.orders.push(o);
    return o.id;
  }

  /**
   * MTO (Market Trail Order) buy: a trailing stop order that fills as a market
   * order when triggered. The stop price trails below the market by `distancePts`,
   * anchoring lower each bar. When the bar's high crosses the stop price a
   * market buy is executed.
   */
  addBuyMTO(mode: TrailMode, distancePts: number, periods = 0): string {
    const id = `ord_${++this._orderSeq}`;
    const p  = this._consumeNextParams(id, 'BUY_MTO', Side.Long, Infinity);
    this._resetNextAttrs();
    const o = createOrder({ ...p, trailEntry: { mode, distPts: distancePts, periods }, _trailRef: Infinity });
    this.orders.push(o);
    return o.id;
  }

  /**
   * MTO (Market Trail Order) sell: a trailing stop order that fills as a market
   * order when triggered. The stop price trails above the market by `distancePts`,
   * anchoring higher each bar. When the bar's low crosses the stop price a
   * market sell is executed.
   */
  addSellMTO(mode: TrailMode, distancePts: number, periods = 0): string {
    const id = `ord_${++this._orderSeq}`;
    const p  = this._consumeNextParams(id, 'SELL_MTO', Side.Short, -Infinity);
    this._resetNextAttrs();
    const o = createOrder({ ...p, trailEntry: { mode, distPts: distancePts, periods }, _trailRef: -Infinity });
    this.orders.push(o);
    return o.id;
  }

  /**
   * Trailing buy-limit — entry order whose price trails below the market.
   * The limit price is set to market - distancePts, and re-anchored upward
   * each bar as long as price rises.
   */
  addBuyLimitTrail(mode: TrailMode, distancePts: number, periods = 0): string {
    const id = `ord_${++this._orderSeq}`;
    const p  = this._consumeNextParams(id, 'BUY_LIMIT', Side.Long, 0);
    this._resetNextAttrs();
    const o = createOrder({ ...p, trailEntry: { mode, distPts: distancePts, periods }, _trailRef: -Infinity });
    this.orders.push(o);
    return o.id;
  }

  addSellLimitTrail(mode: TrailMode, distancePts: number, periods = 0): string {
    const id = `ord_${++this._orderSeq}`;
    const p  = this._consumeNextParams(id, 'SELL_LIMIT', Side.Short, 0);
    this._resetNextAttrs();
    const o = createOrder({ ...p, trailEntry: { mode, distPts: distancePts, periods }, _trailRef: Infinity });
    this.orders.push(o);
    return o.id;
  }

  /** Trailing buy-stop — stop price trails above the market. */
  addBuyStopTrail(mode: TrailMode, distancePts: number, periods = 0): string {
    const id = `ord_${++this._orderSeq}`;
    const p  = this._consumeNextParams(id, 'BUY_STOP', Side.Long, Infinity);
    this._resetNextAttrs();
    const o = createOrder({ ...p, trailEntry: { mode, distPts: distancePts, periods }, _trailRef: Infinity });
    this.orders.push(o);
    return o.id;
  }

  addSellStopTrail(mode: TrailMode, distancePts: number, periods = 0): string {
    const id = `ord_${++this._orderSeq}`;
    const p  = this._consumeNextParams(id, 'SELL_STOP', Side.Short, 0);
    this._resetNextAttrs();
    const o = createOrder({ ...p, trailEntry: { mode, distPts: distancePts, periods }, _trailRef: -Infinity });
    this.orders.push(o);
    return o.id;
  }

  /**
   * Bracket order: places an entry + auto SL + auto TP.
   * Returns the entry order id.
   */
  addBracket(opts: {
    entryType:  'BUY_LIMIT' | 'BUY_STOP' | 'SELL_LIMIT' | 'SELL_STOP';
    entryPrice: number;
    slPts:      number;
    tpPts:      number;
    size?:      number;
  }): string {
    const side = opts.entryType.startsWith('BUY') ? Side.Long : Side.Short;
    const o    = this._addOrder(opts.entryType, side, opts.entryPrice, opts.size);
    o.bracketSL = opts.slPts;
    o.bracketTP = opts.tpPts;
    return o.id;
  }

  async deleteBuyOrders():  Promise<void> { this.orders = this.orders.filter(o => o.side !== Side.Long);  }
  async deleteSellOrders(): Promise<void> { this.orders = this.orders.filter(o => o.side !== Side.Short); }
  async deleteAllOrders():  Promise<void> { this.orders = []; }

  moveOrder(id: string, price: number): boolean {
    const o = this._findOrder(id);
    if (!o) return false;
    o.price = price;
    return true;
  }

  deleteOrder(id: string): boolean {
    const before = this.orders.length;
    this.orders = this.orders.filter(o => o.id !== id);
    return this.orders.length < before;
  }

  // ──────────────────────────────────────────────────────────
  // Next-order attribute setters
  // (set before calling buy/sell/addXxx to apply to that order)
  // ──────────────────────────────────────────────────────────

  orderSize(v: number): void { this._nextOrderSize = v; }
  orderAttrOCO(flag = true):  void { this._nextOCO = flag; }
  orderAttrCO(flag = true):   void { this._nextCO  = flag; }
  orderAttrCS(flag = true):   void { this._nextCS  = flag; }
  orderAttrREV(flag = true):  void { this._nextREV = flag; }
  /** No-op: MIT is an order type (addBuyMIT/addSellMIT), not an attribute. */
  orderAttrMIT(_flag = true): void {}
  orderLimitConfirm(v: LimitConfirm): void { this._nextLimitConfirm = v; }
  orderLimitPullback(pts: number): void { this._nextPullback = pts; }
  bracketSL(pts: number): void { this._nextBracketSL = pts; }
  bracketTP(pts: number): void { this._nextBracketTP = pts; }
  aeRemoveOrdersFlat(flag: boolean): void { this._removeOrdersOnFlat = flag; }

  // ──────────────────────────────────────────────────────────
  // SL / TP / Trail setters per slot
  // ──────────────────────────────────────────────────────────

  sl(points: number): void {
    this._setSlOffset(this.longPos,  points);
    this._setSlOffset(this.shortPos, points);
  }
  tp(points: number): void {
    this._setTpOffset(this.longPos,  points);
    this._setTpOffset(this.shortPos, points);
  }
  slBuy(points: number):  void { this._setSlOffset(this.longPos,  points); }
  slSell(points: number): void { this._setSlOffset(this.shortPos, points); }
  tpBuy(points: number):  void { this._setTpOffset(this.longPos,  points); }
  tpSell(points: number): void { this._setTpOffset(this.shortPos, points); }

  slBuyAbsolute(price: number):  void { this.longPos.sl  = price; }
  slSellAbsolute(price: number): void { this.shortPos.sl = price; }
  tpBuyAbsolute(price: number):  void { this.longPos.tp  = price; }
  tpSellAbsolute(price: number): void { this.shortPos.tp = price; }

  slActivate(flag: boolean):     void { this.longPos.slActive  = flag; this.shortPos.slActive  = flag; }
  tpActivate(flag: boolean):     void { this.longPos.tpActive  = flag; this.shortPos.tpActive  = flag; }
  slActivateBuy(flag: boolean):  void { this.longPos.slActive  = flag; }
  slActivateSell(flag: boolean): void { this.shortPos.slActive = flag; }
  tpActivateBuy(flag: boolean):  void { this.longPos.tpActive  = flag; }
  tpActivateSell(flag: boolean): void { this.shortPos.tpActive = flag; }

  trailMode(mode: TrailMode, distPts: number, periods = 0): void {
    this.longPos.trailCfg  = { mode, distancePts: distPts, periods };
    this.shortPos.trailCfg = { mode, distancePts: distPts, periods };
  }
  trailModeBuy(mode: TrailMode, distPts: number, periods = 0):  void { this.longPos.trailCfg  = { mode, distancePts: distPts, periods }; }
  trailModeSell(mode: TrailMode, distPts: number, periods = 0): void { this.shortPos.trailCfg = { mode, distancePts: distPts, periods }; }

  trailBegin(pts: number):     void { this.longPos.trailBeginPts  = pts; this.shortPos.trailBeginPts  = pts; }
  trailBeginBuy(pts: number):  void { this.longPos.trailBeginPts  = pts; }
  trailBeginSell(pts: number): void { this.shortPos.trailBeginPts = pts; }

  trailDistance(pts: number):     void { this.longPos.trailCfg.distancePts  = pts; this.shortPos.trailCfg.distancePts  = pts; }
  trailDistanceBuy(pts: number):  void { this.longPos.trailCfg.distancePts  = pts; }
  trailDistanceSell(pts: number): void { this.shortPos.trailCfg.distancePts = pts; }

  trailActivate(flag: boolean):     void { this.longPos.trailActive  = flag; this.shortPos.trailActive  = flag; }
  trailActivateBuy(flag: boolean):  void { this.longPos.trailActive  = flag; }
  trailActivateSell(flag: boolean): void { this.shortPos.trailActive = flag; }

  be(pts: number):             void { this.longPos.beAddPts  = pts; this.shortPos.beAddPts  = pts; }
  beBuy(pts: number):          void { this.longPos.beAddPts  = pts; }
  beSell(pts: number):         void { this.shortPos.beAddPts = pts; }
  beActivate(flag: boolean):   void { this.longPos.beActive   = flag; this.shortPos.beActive   = flag; }
  beActivateBuy(flag: boolean): void { this.longPos.beActive   = flag; }
  beActivateSell(flag: boolean):void { this.shortPos.beActive  = flag; }

  /** Set SL, TP, trail and break-even all at once. */
  setPoolPanelValues(opts: {
    sl?: number; tp?: number;
    trailBegin?: number; trailDistance?: number;
    trailMode?: TrailMode; trailPeriods?: number;
    separateSides?: boolean;
  }): void {
    const { sl, tp, trailBegin, trailDistance, trailMode: mode, trailPeriods = 0, separateSides = false } = opts;
    if (separateSides) {
      if (sl != null) { this.slBuy(sl); this.slSell(sl); }
      if (tp != null) { this.tpBuy(tp); this.tpSell(tp); }
      if (mode != null) { this.trailModeBuy(mode, trailDistance ?? 0, trailPeriods); this.trailModeSell(mode, trailDistance ?? 0, trailPeriods); }
      else { if (trailBegin != null) { this.trailBeginBuy(trailBegin); this.trailBeginSell(trailBegin); } if (trailDistance != null) { this.trailDistanceBuy(trailDistance); this.trailDistanceSell(trailDistance); } }
    } else {
      if (sl != null) this.sl(sl);
      if (tp != null) this.tp(tp);
      if (mode != null) this.trailMode(mode, trailDistance ?? 0, trailPeriods);
      else { if (trailBegin != null) this.trailBegin(trailBegin); if (trailDistance != null) this.trailDistance(trailDistance); }
    }
  }

  setPoolPanelValuesByFactor(factor: number, opts: Parameters<TradingEngine['setPoolPanelValues']>[0]): void {
    if (factor === 0) return;
    const s = { ...opts };
    if (s.sl != null)            s.sl            *= factor;
    if (s.tp != null)            s.tp            *= factor;
    if (s.trailBegin != null)    s.trailBegin    *= factor;
    if (s.trailDistance != null) s.trailDistance *= factor;
    this.setPoolPanelValues(s);
  }

  // ──────────────────────────────────────────────────────────
  // Counters / getters
  // ──────────────────────────────────────────────────────────

  getCntPosBuy():     number  { return this.longPos.size  > 0 ? 1 : 0; }
  getCntPosSell():    number  { return this.shortPos.size > 0 ? 1 : 0; }
  getCntPos():        number  { return this.getCntPosBuy() + this.getCntPosSell(); }
  getCntOrdersBuy():  number  { return this.orders.filter(o => o.side === Side.Long).length;  }
  getCntOrdersSell(): number  { return this.orders.filter(o => o.side === Side.Short).length; }
  getCntOrders():     number  { return this.orders.length; }
  getOrders(): readonly Order[] { return this.orders; }
  isLong():           boolean { return this.longPos.size  > 0; }
  isShort():          boolean { return this.shortPos.size > 0; }
  isFlat(inclOrders = false): boolean {
    return inclOrders
      ? this.getCntPos() === 0 && this.getCntOrders() === 0
      : this.getCntPos() === 0;
  }

  getSLBuy():  number { return this.longPos.sl;  }
  getSLSell(): number { return this.shortPos.sl; }
  getTPBuy():  number { return this.longPos.tp;  }
  getTPSell(): number { return this.shortPos.tp; }

  getBEBuy():  number { return this.longPos.openPrice;  }
  getBESell(): number { return this.shortPos.openPrice; }

  getOpenTimeBuy():  Date { return this.longPos.openTime;  }
  getOpenTimeSell(): Date { return this.shortPos.openTime; }

  getSizeBuy():  number { return this.longPos.size;  }
  getSizeSell(): number { return this.shortPos.size; }
  getSize():     number { return this.longPos.size + this.shortPos.size; }

  getSlOffsetPtsBuy():    number      { return this.longPos.slOffsetPts;   }
  getSlOffsetPtsSell():   number      { return this.shortPos.slOffsetPts;  }
  getTpOffsetPtsBuy():    number      { return this.longPos.tpOffsetPts;   }
  getTpOffsetPtsSell():   number      { return this.shortPos.tpOffsetPts;  }
  getSlActiveBuy():       boolean     { return this.longPos.slActive;       }
  getSlActiveSell():      boolean     { return this.shortPos.slActive;      }
  getTpActiveBuy():       boolean     { return this.longPos.tpActive;       }
  getTpActiveSell():      boolean     { return this.shortPos.tpActive;      }
  getTrailCfgBuy():       TrailConfig { return this.longPos.trailCfg;       }
  getTrailCfgSell():      TrailConfig { return this.shortPos.trailCfg;      }
  getTrailStateBuy():     TrailState  { return this.longPos.trailState;     }
  getTrailStateSell():    TrailState  { return this.shortPos.trailState;    }
  getTrailActiveBuy():    boolean     { return this.longPos.trailActive;    }
  getTrailActiveSell():   boolean     { return this.shortPos.trailActive;   }
  getTrailBeginPtsBuy():  number      { return this.longPos.trailBeginPts;  }
  getTrailBeginPtsSell(): number      { return this.shortPos.trailBeginPts; }
  getBeActiveBuy():       boolean     { return this.longPos.beActive;       }
  getBeActiveSell():      boolean     { return this.shortPos.beActive;      }
  getBeAddPtsBuy():       number      { return this.longPos.beAddPts;       }
  getBeAddPtsSell():      number      { return this.shortPos.beAddPts;      }

  getPLBuy(price: number):  number { return this._slotPL(this.longPos,  price); }
  getPLSell(price: number): number { return this._slotPL(this.shortPos, price); }
  getPL(price: number):     number { return this.getPLBuy(price) + this.getPLSell(price); }

  // ──────────────────────────────────────────────────────────
  // Private — order book processing
  // ──────────────────────────────────────────────────────────

  /** Build OrderParams from current next-attributes and reset them. */
  private _consumeNextParams<T extends OrderEntryType>(id: string, type: T, side: Side, price: number, size?: number): OrderParams & { type: T } {
    return {
      id, type, side, price,
      size: size ?? this._nextOrderSize,
      time: new Date(),
      oco:  this._nextOCO  ? true : undefined,
      co:   this._nextCO   ? true : undefined,
      cs:   this._nextCS   ? true : undefined,
      rev:  this._nextREV  ? true : undefined,
      bracketSL:    this._nextBracketSL,
      bracketTP:    this._nextBracketTP,
      pullbackPts:  this._nextPullback,
      limitConfirm: this._nextLimitConfirm !== LimitConfirm.None ? this._nextLimitConfirm : undefined,
    };
  }

  private _resetNextAttrs(): void {
    this._nextOCO = false; this._nextCO = false; this._nextCS = false;
    this._nextREV = false;
    this._nextBracketSL = undefined; this._nextBracketTP = undefined;
    this._nextPullback  = undefined;
    this._nextLimitConfirm = LimitConfirm.None;
  }

  /** Factory for simple (non-trailing, non-stop-limit) order types. */
  private _addOrder(type: 'BUY_LIMIT' | 'SELL_LIMIT' | 'BUY_STOP' | 'SELL_STOP' | 'BUY_MIT' | 'SELL_MIT',
    side: Side, price: number, size?: number,
  ): Order {
    const id = `ord_${++this._orderSeq}`;
    const p  = this._consumeNextParams(id, type, side, price, size);
    this._resetNextAttrs();
    const o = createOrder(p as CreateOrderParams);
    this.orders.push(o);
    return o;
  }

  private _findOrder(id: string): Order | undefined {
    return this.orders.find(o => o.id === id);
  }


  /** Per-bar: update trailing-entry order prices — each order class owns its own logic. */
  private async _updateTrailingEntryOrders(bar: Bar, bars: Bars): Promise<void> {
    for (const o of this.orders) o.updateTrailingRef(bar, bars, this.symbol);
  }

  /** Per-bar: check which pending orders were triggered — each class owns isFilled(). */
  private async _checkOrderFills(bar: Bar, bars: Bars): Promise<void> {
    const toFill: Order[] = [];
    for (const o of this.orders) {
      if (o.isFilled(bar)) toFill.push(o);
    }
    for (const o of toFill) {
      // Skip if a prior fill on this bar cancelled this order (OCO / CS).
      if (!this.orders.some(x => x.id === o.id)) continue;
      await this._fillOrder(o, bar, bars);
    }
  }

  private async _fillOrder(o: Order, bar: Bar, _bars: Bars): Promise<void> {
    // Limit-confirm check (require wick / color confirmation)
    if (o.limitConfirm != null) {
      if (!this._checkLimitConfirm(o, bar, o.limitConfirm)) return;
    }

    // Remove this order from the book
    this.orders = this.orders.filter(x => x.id !== o.id);

    // Apply order attributes before executing
    if (o.oco) this.orders = [];
    if (o.cs)  this.orders = this.orders.filter(x => x.side !== o.side);
    if (o.co) {
      if (o.side === Side.Long  && this.shortPos.size > 0) await this._closeSlot(this.shortPos, 'CO');
      if (o.side === Side.Short && this.longPos.size  > 0) await this._closeSlot(this.longPos,  'CO');
    }

    // Execute the fill
    const slot = o.side === Side.Long ? this.longPos : this.shortPos;

    if (o.rev) {
      // Reverse: close current + open opposite of same size
      const curSize = slot.size;
      if (curSize > 0) await this._closeSlot(slot, 'REV');
      if (o.side === Side.Long) {
        await this.broker.marketOrder(Side.Long, o.size + curSize);
        this._applyFill(this.longPos, o.computeFillPrice(bar), o.size + curSize, bar.time, o.type);
      } else {
        await this.broker.marketOrder(Side.Short, o.size + curSize);
        this._applyFill(this.shortPos, o.computeFillPrice(bar), o.size + curSize, bar.time, o.type);
      }
    } else if (isStopLimitOrder(o)) {
      // Stop-limit: only fill if bar's range covers the limit price
      if (!o.limitCovered(bar)) {
        // Re-queue as a plain LimitOrder at limitPrice for subsequent bars
        this.orders.push(new LimitOrder({
          id: o.id,
          type: o.side === Side.Long ? 'BUY_LIMIT' : 'SELL_LIMIT',
          side: o.side, price: o.limitPrice, size: o.size, time: o.time,
          oco: o.oco, co: o.co, cs: o.cs, rev: o.rev,
          bracketSL: o.bracketSL, bracketTP: o.bracketTP, limitConfirm: o.limitConfirm,
        }));
        return;
      }
      this._applyFill(slot, o.computeFillPrice(bar), o.size, bar.time, o.type);
    } else if (o.fillsAtMarket) {
      // MIT / MTO: execute as market order; actual fill price comes from broker
      const r = await this.broker.marketOrder(o.side, o.size);
      this._applyFill(slot, r.price, o.size, r.time, o.type);
    } else {
      // Limit / stop fill at computed price (gap-clamped per MQL GetFillPrice)
      this._applyFill(slot, o.computeFillPrice(bar), o.size, bar.time, o.type);
    }

    // Apply bracket SL/TP
    this._applyBracketPts(slot, o.bracketSL, o.bracketTP);

    await this._pushSLTP(slot);
  }

  /** Check limit-confirmation candle logic */
  private _checkLimitConfirm(o: Order, bar: Bar, confirm: LimitConfirm): boolean {
    switch (confirm) {
      case LimitConfirm.Wick:
        // Price must have wicked through the limit but closed on the other side
        return o.side === Side.Long
          ? bar.low <= o.price && bar.close > o.price
          : bar.high >= o.price && bar.close < o.price;
      case LimitConfirm.WickBreak:
        // Wick + body must have crossed
        return o.side === Side.Long
          ? bar.low <= o.price && Math.min(bar.open, bar.close) > o.price
          : bar.high >= o.price && Math.max(bar.open, bar.close) < o.price;
      case LimitConfirm.WickColor:
        return o.side === Side.Long
          ? bar.low <= o.price && bar.close > o.price && bar.isBullish()
          : bar.high >= o.price && bar.close < o.price && bar.isBearish();
      default:
        return true;
    }
  }

  // ──────────────────────────────────────────────────────────
  // Private — per-slot updates
  // ──────────────────────────────────────────────────────────

  private async _updateTrailingSL(slot: PositionSlot, bar: Bar, bars: Bars): Promise<void> {
    if (slot.trailCfg.mode === TrailMode.None) return;
    const newSL = calcTrailingSL({
      side:          slot.side,
      bar, bars,
      posPrice:      slot.openPrice,
      currentSL:     slot.sl,
      spreadAbs:     this._spreadAbs,
      trailBeginPts: slot.trailBeginPts,
      trail:         slot.trailCfg,
      state:         slot.trailState,
      symbol:        this.symbol,
    });
    if (newSL !== slot.sl) {
      slot.sl          = newSL;
      slot.trailActive = slot.trailState.active;
      await this._pushSLTP(slot);
    }
  }

  private async _updateBreakEven(slot: PositionSlot, bar: Bar): Promise<void> {
    if (!slot.beActive || slot.openPrice < 0) return;
    const triggerDist = this.symbol.pointsToPrice(slot.trailBeginPts);
    const beDist      = this.symbol.pointsToPrice(slot.beAddPts);
    let newSL         = slot.sl;
    // MQL uses bar_close as trigger reference (not high/low) — close-based avoids wick-only activation
    if (slot.side === Side.Long && bar.close >= slot.openPrice + triggerDist) {
      newSL = Math.max(newSL === -1 ? -Infinity : newSL, slot.openPrice + beDist);
    } else if (slot.side === Side.Short && bar.close <= slot.openPrice - triggerDist) {
      newSL = newSL === -1 ? slot.openPrice - beDist : Math.min(newSL, slot.openPrice - beDist);
    }
    if (newSL !== slot.sl) {
      slot.sl = newSL;
      await this._pushSLTP(slot);
    }
  }

  private async _checkExits(slot: PositionSlot, bar: Bar): Promise<void> {
    const hit = checkSLTP({
      side:        slot.side,
      bar,
      sl:          slot.sl,
      tp:          slot.tp,
      slActive:    slot.slActive,
      tpActive:    slot.tpActive,
      trailActive: slot.trailActive,
      spreadAbs:   this._spreadAbs,
    });
    if (!hit) return;
    this._recordDeal(slot, hit.exitPrice, hit.reason.toLowerCase(), bar.time);
    await this.broker.closePosition(slot.side, slot.size, hit.reason);
    this._resetSlot(slot);
    if (this._removeOrdersOnFlat && this.getCntPos() === 0) this.orders = [];
  }

  private async _closeSlot(slot: PositionSlot, info?: string): Promise<boolean> {
    if (slot.size === 0) return false;
    const r = await this.broker.closePosition(slot.side, slot.size, info);
    this._recordDeal(slot, r.price, info ?? 'market', this._lastBarTime);
    this._resetSlot(slot);
    return true;
  }

  private _setSlOffset(slot: PositionSlot, pts: number): void {
    slot.slOffsetPts = pts;
    if (slot.size > 0) {
      slot.sl = slot.side === Side.Long
        ? slot.openPrice - this.symbol.pointsToPrice(pts)
        : slot.openPrice + this.symbol.pointsToPrice(pts);
    }
  }

  private _setTpOffset(slot: PositionSlot, pts: number): void {
    slot.tpOffsetPts = pts;
    if (slot.size > 0) {
      slot.tp = slot.side === Side.Long
        ? slot.openPrice + this.symbol.pointsToPrice(pts)
        : slot.openPrice - this.symbol.pointsToPrice(pts);
    }
  }

  private _applyFill(slot: PositionSlot, price: number, size: number, time: Date, reason = ''): void {
    if (slot.size === 0) {
      slot.openPrice   = price;
      slot.openTime    = time;
      slot.entryReason = reason;
      slot.barsHeld    = 0;
      slot.mae         = 0;
      slot.mfe         = 0;
      slot.trailState  = { active: false, plhRef: slot.side === Side.Long ? 0 : Infinity };
      if (slot.slOffsetPts > 0) {
        slot.sl = slot.side === Side.Long
          ? price - this.symbol.pointsToPrice(slot.slOffsetPts)
          : price + this.symbol.pointsToPrice(slot.slOffsetPts);
      }
      if (slot.tpOffsetPts > 0) {
        slot.tp = slot.side === Side.Long
          ? price + this.symbol.pointsToPrice(slot.tpOffsetPts)
          : price - this.symbol.pointsToPrice(slot.tpOffsetPts);
      }
    } else {
      // Average into existing position
      slot.openPrice = (slot.openPrice * slot.size + price * size) / (slot.size + size);
    }
    slot.size += size;
  }

  private _applyBracketPts(slot: PositionSlot, slPts?: number, tpPts?: number): void {
    // Fall back to engine-level defaults when no explicit bracket is set (MQL _ResolveSLDist pattern)
    const sl = slPts ?? (this._defaultSLDist > 0 ? this._defaultSLDist : undefined);
    const tp = tpPts ?? (this._defaultTPDist > 0 ? this._defaultTPDist : undefined);
    if (sl != null) {
      slot.sl = slot.side === Side.Long
        ? slot.openPrice - this.symbol.pointsToPrice(sl)
        : slot.openPrice + this.symbol.pointsToPrice(sl);
      slot.slActive = true;
    }
    if (tp != null) {
      slot.tp = slot.side === Side.Long
        ? slot.openPrice + this.symbol.pointsToPrice(tp)
        : slot.openPrice - this.symbol.pointsToPrice(tp);
      slot.tpActive = true;
    }
  }

  private _applyBracket(slot: PositionSlot): void {
    this._applyBracketPts(slot, this._nextBracketSL, this._nextBracketTP);
    this._nextBracketSL = undefined;
    this._nextBracketTP = undefined;
  }

  private _resetSlot(slot: PositionSlot): void {
    const side = slot.side;
    const { slOffsetPts, tpOffsetPts } = slot;
    Object.assign(slot, emptySlot(side));
    slot.slOffsetPts = slOffsetPts;
    slot.tpOffsetPts = tpOffsetPts;
  }

  private async _pushSLTP(slot: PositionSlot): Promise<void> {
    await this.broker.updateSLTP(
      slot.side,
      slot.sl > 0 && (slot.slActive || slot.trailActive) ? slot.sl : null,
      slot.tp > 0 && slot.tpActive ? slot.tp : null,
    );
  }

  private _slotPL(slot: PositionSlot, currentPrice: number): number {
    if (slot.size === 0 || currentPrice < 0) return 0;
    const diff = slot.side === Side.Long
      ? currentPrice - slot.openPrice
      : slot.openPrice - currentPrice;
    return diff * slot.size;
  }

  // ──────────────────────────────────────────────────────────
  // Per-bar: MAE/MFE update (ported from CSEADeal concept in SEA_OrderManagement.mqh)
  // ──────────────────────────────────────────────────────────

  private _updateMAEMFE(slot: PositionSlot, bar: Bar): void {
    if (slot.openPrice < 0) return;
    const pt = this.symbol.pointsToPrice(1);
    if (pt === 0) return;
    let adverse: number;
    let favorable: number;
    if (slot.side === Side.Long) {
      adverse   = (slot.openPrice - bar.low)  / pt;
      favorable = (bar.high - slot.openPrice) / pt;
    } else {
      adverse   = (bar.high + this._spreadAbs - slot.openPrice) / pt;
      favorable = (slot.openPrice - bar.low  - this._spreadAbs) / pt;
    }
    if (adverse  > slot.mae) slot.mae = adverse;
    if (favorable > slot.mfe) slot.mfe = favorable;
  }

  // ──────────────────────────────────────────────────────────
  // Deal recording (ported from _SimRecordDeal / _SimUpdateStats in SEA_OrderManagement.mqh)
  // ──────────────────────────────────────────────────────────

  private _recordDeal(slot: PositionSlot, exitPrice: number, exitReason: string, closeTime: Date): void {
    if (slot.size === 0 || slot.openPrice < 0) return;
    const pt = this.symbol.pointsToPrice(1);
    const plPoints = pt > 0
      ? (slot.side === Side.Long
          ? (exitPrice - slot.openPrice) / pt
          : (slot.openPrice - exitPrice) / pt)
      : 0;
    const result: 'win' | 'loss' | 'breakeven' =
      plPoints > 0 ? 'win' : plPoints < 0 ? 'loss' : 'breakeven';
    const deal: DealRecord = {
      id:          ++this._dealSeq,
      side:        slot.side,
      entryPrice:  slot.openPrice,
      exitPrice,
      size:        slot.size,
      openTime:    slot.openTime,
      closeTime,
      barsHeld:    slot.barsHeld,
      entryReason: slot.entryReason,
      exitReason,
      plPoints,
      result,
      mae:         Math.max(0, slot.mae),
      mfe:         Math.max(0, slot.mfe),
    };
    this._deals.push(deal);
    if (this._deals.length > MAX_DEALS) this._deals = this._deals.slice(-MAX_DEALS);
    this._updateStats(deal);
  }

  private _updateStats(deal: DealRecord): void {
    this._stats.totalDeals++;
    this._stats.netPLPts       += deal.plPoints;
    // Note: incremental float addition can accumulate rounding drift over thousands of deals.
    // Acceptable for backtest precision; use Kahan summation if sub-pip accuracy is required.
    this._runningEquityPts     += deal.plPoints;
    if (deal.plPoints > 0) {
      this._stats.winningDeals++;
      this._stats.grossProfitPts += deal.plPoints;
      this._currentWinStreak++;
      this._currentLossStreak = 0;
      if (this._currentWinStreak > this._stats.maxWinStreak)
        this._stats.maxWinStreak = this._currentWinStreak;
    } else if (deal.plPoints < 0) {
      this._stats.losingDeals++;
      this._stats.grossLossPts += deal.plPoints;
      this._currentLossStreak++;
      this._currentWinStreak = 0;
      if (this._currentLossStreak > this._stats.maxLossStreak)
        this._stats.maxLossStreak = this._currentLossStreak;
    } else {
      this._stats.breakevenDeals++;
    }
    if (this._runningEquityPts > this._maxEquityPeak)
      this._maxEquityPeak = this._runningEquityPts;
    const dd = this._maxEquityPeak - this._runningEquityPts;
    if (dd > this._stats.maxDrawdownPts) this._stats.maxDrawdownPts = dd;
    if (this._stats.maxDrawdownPts > 0)
      this._stats.marRatio = this._stats.netPLPts / this._stats.maxDrawdownPts;
  }

  // ──────────────────────────────────────────────────────────
  // Public: deal history, statistics, defaults
  // ──────────────────────────────────────────────────────────

  /** All closed trades since last {@link resetStats}. */
  getDeals(): readonly DealRecord[] { return this._deals; }

  /** Cumulative backtest statistics. Use {@link dealStatsComputed} for derived ratios. */
  getStats(): Readonly<DealStats> { return this._stats; }

  /** Reset deal history and all statistics counters. */
  resetStats(): void {
    this._deals             = [];
    this._dealSeq           = 0;
    this._runningEquityPts  = 0;
    this._maxEquityPeak     = 0;
    this._currentWinStreak  = 0;
    this._currentLossStreak = 0;
    this._stats = {
      totalDeals: 0, winningDeals: 0, losingDeals: 0, breakevenDeals: 0,
      grossProfitPts: 0, grossLossPts: 0, netPLPts: 0,
      maxWinStreak: 0, maxLossStreak: 0, maxDrawdownPts: 0, marRatio: 0,
    };
  }

  /**
   * Set a global default SL distance (points) applied to any fill that has no explicit bracket SL.
   * Matches MQL `_ResolveSLDist` / `m_default_sl_dist`.  Pass 0 to disable.
   */
  setDefaultSLDist(pts: number): void { this._defaultSLDist = pts; }

  /**
   * Set a global default TP distance (points) applied to any fill that has no explicit bracket TP.
   * Matches MQL `_ResolveTPDist` / `m_default_tp_dist`.  Pass 0 to disable.
   */
  setDefaultTPDist(pts: number): void { this._defaultTPDist = pts; }
}

// ─────────────────────────────────────────────────────────────
// Strategy: BarATR_03  (port of CandleATR_03.mq5)
// ─────────────────────────────────────────────────────────────

/**
 * Evaluates one bar.  Call this inside your data-feed's onBar handler.
 *
 * Logic:
 *  - Prev bar range > 2× ATR(14)
 *  - Bearish bar, tail < 50%, is local low of last 5 bars → Sell
 *  - Bullish bar, wick < 50%, is local high of last 5 bars → Buy
 *  - Trail: PlhPeak mode, begin at half bar range, 2-point distance
 */
export async function evaluateCandleATR03(
  bars:   Bars,
  engine: TradingEngine,
  symbol: SymbolInfoBase,
): Promise<void> {
  const prev  = bars.bar(1);
  const atr14 = bars.atr(14, 1);

  if (prev.range() < atr14 * 2.0) return;

  if (prev.isBearish() && engine.getCntPosSell() === 0) {
    if (prev.tailPart() < 0.5 && bars.isLocalLow(5, 1)) {
      await engine.closeBuy();
      engine.slSellAbsolute(prev.high + symbol.pointsToPrice(5));
      engine.slActivateSell(true);
      engine.trailBeginSell(symbol.priceToPoints(prev.range() / 2));
      engine.trailModeSell(TrailMode.PlhPeak, 2);
      engine.trailActivateSell(true);
      await engine.sell();
    }
  } else if (prev.isBullish() && engine.getCntPosBuy() === 0) {
    if (prev.wickPart() < 0.5 && bars.isLocalHigh(5, 1)) {
      await engine.closeSell();
      engine.slBuyAbsolute(prev.low - symbol.pointsToPrice(5));
      engine.slActivateBuy(true);
      engine.trailBeginBuy(symbol.priceToPoints(prev.range() / 2));
      engine.trailModeBuy(TrailMode.PlhPeak, 2);
      engine.trailActivateBuy(true);
      await engine.buy();
    }
  }
}

// ─────────────────────────────────────────────────────────────
// ATR Module  (port of ATR-Base.mq5 + the ATR panel logic)
//
// On each new bar, reads ATR and pushes SL/TP/trail values
// to the engine scaled by the configured ATR multipliers.
// ─────────────────────────────────────────────────────────────

export interface AtrModuleConfig {
  /** ATR lookback period */
  period:       number;
  /** ATR smoothing method */
  method:       AtrMethod;
  /** ATR shift (1 = use last fully-closed bar) */
  shift:        number;
  /** SL = slMultiplier × ATR  (0 = disabled) */
  slMultiplier:  number;
  /** TP = tpMultiplier × ATR  (0 = disabled) */
  tpMultiplier:  number;
  /** Trail-begin = trailBeginMultiplier × ATR  (0 = disabled) */
  trailBeginMultiplier: number;
  /** Trail-distance = trailDistMultiplier × ATR  (0 = disabled) */
  trailDistMultiplier:  number;
  /**
   * When true: only update SL/TP when there is no open position.
   * When false: update every bar regardless.
   */
  onlyWhenFlat: boolean;
  /**
   * Filter which bar types contribute to ATR calculation.
   * Normal = all bars, Bullish = only up-bars, Bearish = only down-bars.
   */
  barsAtrMode: BarsAtrMode;
  /**
   * Which price range forms each TR measurement.
   * HiLo = standard True Range (High-Low + prev-close gaps).
   * OpenClose = body range only (|Open - Close|).
   */
  barBase: BarBase;
}

/**
 * ATR Module — updates pool-panel SL / TP / trail values on each bar
 * using a multiple of the current ATR reading.
 *
 * Call `onBar()` inside your bar-handler before the strategy runs.
 */
export class AtrModule {
  constructor(
    private readonly cfg:    AtrModuleConfig,
    private readonly engine: TradingEngine,
    private readonly symbol: SymbolInfoBase,
  ) {}

  onBar(bars: Bars): void {
    const atrPrice = bars.atr(this.cfg.period, this.cfg.shift, this.cfg.method, this.cfg.barsAtrMode, this.cfg.barBase);
    if (atrPrice === 0) return;
    const atrPts = this.symbol.priceToPoints(atrPrice);

    const isFlat = this.engine.isFlat();
    const update = !this.cfg.onlyWhenFlat || isFlat;

    if (update) {
      if (this.cfg.slMultiplier   > 0) this.engine.sl(atrPts * this.cfg.slMultiplier);
      if (this.cfg.tpMultiplier   > 0) this.engine.tp(atrPts * this.cfg.tpMultiplier);
      if (this.cfg.trailBeginMultiplier > 0)
        this.engine.trailBegin(atrPts * this.cfg.trailBeginMultiplier);
    }
    // Trail distance updated unconditionally (matches MQL logic)
    if (this.cfg.trailDistMultiplier > 0)
      this.engine.trailDistance(atrPts * this.cfg.trailDistMultiplier);
  }
}

// ─────────────────────────────────────────────────────────────
// Scaled Order Engine  (SOrder — port of StrategicOrders.xml logic)
//
// Places a grid of limit / stop orders at progressive ATR-based
// distances, matching all presets in StrategicOrders.xml.
// ─────────────────────────────────────────────────────────────

export type AtrModeString =
  | 'None'
  | `ATR ${number}`      // current-timeframe ATR, e.g. "ATR 14"
  | `ATR ${number}d`;    // daily-timeframe ATR, e.g. "ATR 14d"

export interface ScaledOrderPreset {
  /** Human-readable name */
  name:                 string;
  /** ATR source (current timeframe or daily) */
  atrMode:              AtrModeString;
  /** Base distance as ATR multiplier (or raw points when atrMode="None") */
  distance:             number;
  /** Spacing multiplier between consecutive limit orders */
  progressLimits:       number;
  /** Spacing multiplier between consecutive stop orders */
  progressStops:        number;
  /** Number of limit orders to place */
  countLimits:          number;
  /** Number of stop orders to place */
  countStops:           number;
  /** SL = slRel × base distance */
  slRel:                number;
  /** Trail trigger = trailBegin × base distance */
  trailBegin:           number;
  /** Trail distance = trailDistance × base distance */
  trailDistance:        number;
  /** Size multiplier for long side */
  factorLong:           number;
  /** Size multiplier for short side */
  factorShort:          number;
  /** OCO attribute on all orders */
  attrOCO:              boolean;
  /** CO (close opposite) attribute */
  attrCO:               boolean;
  /** REV (reverse) attribute */
  attrREV:              boolean;
  /**
   * NET mode flag (reduce position, don't add).
   * Declared for compatibility with StereoTrader presets.
   * NOT YET IMPLEMENTED in ScaledOrderEngine._place — setting this to true has no effect.
   */
  attrNET:              boolean;
  /** How the first (instant) order executes: 'MTO' | 'Market' */
  instantOrderType:     'MTO' | 'Market';
  /** Instant order distance as ATR multiplier */
  instantOrderDistance: number;
  /** Chain limit orders: each fill of a closer limit cancels the more distant ones */
  chainLimits:          boolean;
  /** Evaluate on every tick vs. every bar */
  eachTick:             boolean;
}

/** Parse ATR mode string into period + daily flag */
function parseAtrMode(mode: AtrModeString): { period: number; daily: boolean } | null {
  if (mode === 'None') return null;
  const m = mode.match(/^ATR\s+(\d+)(d?)$/);
  if (!m) return null;
  return { period: parseInt(m[1], 10), daily: m[2] === 'd' };
}

/**
 * All built-in presets from StrategicOrders.xml
 */
export const SCALED_ORDER_PRESETS: Record<string, ScaledOrderPreset> = {
  '5xATR':          { name: '5x ATR',         atrMode: 'ATR 14',   distance: 1,    progressLimits: 1,    progressStops: 1,   countLimits: 5,  countStops: 1, slRel: 2.0, trailBegin: 0.8, trailDistance: 0.2, factorLong: 1, factorShort: 1, attrOCO: false, attrCO: false, attrREV: false, attrNET: false, instantOrderType: 'MTO', instantOrderDistance: 0.2, chainLimits: true,  eachTick: false },
  '5xATR_2':        { name: '5x ATR/2',        atrMode: 'ATR 14d',  distance: 0.5,  progressLimits: 1,    progressStops: 1,   countLimits: 5,  countStops: 1, slRel: 2.0, trailBegin: 0.8, trailDistance: 0.2, factorLong: 1, factorShort: 1, attrOCO: false, attrCO: false, attrREV: false, attrNET: false, instantOrderType: 'MTO', instantOrderDistance: 0.2, chainLimits: true,  eachTick: false },
  '5xATR_3':        { name: '5x ATR/3',        atrMode: 'ATR 14d',  distance: 0.33, progressLimits: 1,    progressStops: 1,   countLimits: 5,  countStops: 1, slRel: 2.0, trailBegin: 0.8, trailDistance: 0.2, factorLong: 1, factorShort: 1, attrOCO: false, attrCO: false, attrREV: false, attrNET: false, instantOrderType: 'MTO', instantOrderDistance: 0.2, chainLimits: true,  eachTick: false },
  '5xATR_4':        { name: '5x ATR/4',        atrMode: 'ATR 14d',  distance: 0.25, progressLimits: 1,    progressStops: 1,   countLimits: 5,  countStops: 1, slRel: 2.0, trailBegin: 0.8, trailDistance: 0.2, factorLong: 1, factorShort: 1, attrOCO: false, attrCO: false, attrREV: false, attrNET: false, instantOrderType: 'MTO', instantOrderDistance: 0.2, chainLimits: true,  eachTick: false },
  '10xATR':         { name: '10x ATR',         atrMode: 'ATR 20d',  distance: 1,    progressLimits: 1,    progressStops: 1,   countLimits: 10, countStops: 1, slRel: 4.0, trailBegin: 1.0, trailDistance: 0.2, factorLong: 1, factorShort: 1, attrOCO: false, attrCO: false, attrREV: false, attrNET: false, instantOrderType: 'MTO', instantOrderDistance: 0.2, chainLimits: true,  eachTick: false },
  '10xATR_2':       { name: '10x ATR / 2',     atrMode: 'ATR 20d',  distance: 0.5,  progressLimits: 1,    progressStops: 1,   countLimits: 10, countStops: 1, slRel: 4.0, trailBegin: 1.0, trailDistance: 0.2, factorLong: 1, factorShort: 1, attrOCO: false, attrCO: false, attrREV: false, attrNET: false, instantOrderType: 'MTO', instantOrderDistance: 0.2, chainLimits: true,  eachTick: false },
  '10xATR_3':       { name: '10x ATR / 3',     atrMode: 'ATR 20d',  distance: 0.5,  progressLimits: 1,    progressStops: 1,   countLimits: 10, countStops: 1, slRel: 4.0, trailBegin: 1.0, trailDistance: 0.2, factorLong: 1, factorShort: 1, attrOCO: false, attrCO: false, attrREV: false, attrNET: false, instantOrderType: 'MTO', instantOrderDistance: 0.2, chainLimits: true,  eachTick: false },
  'Swing_I':        { name: 'Swing I',         atrMode: 'ATR 14d',  distance: 2,    progressLimits: 1.2,  progressStops: 0.8, countLimits: 8,  countStops: 4, slRel: 3.0, trailBegin: 2.0, trailDistance: 0.5, factorLong: 1, factorShort: 1, attrOCO: false, attrCO: false, attrREV: false, attrNET: false, instantOrderType: 'MTO', instantOrderDistance: 0.5, chainLimits: true,  eachTick: false },
  'Swing_II':       { name: 'Swing II',        atrMode: 'ATR 14d',  distance: 2,    progressLimits: 1.33, progressStops: 0.8, countLimits: 10, countStops: 5, slRel: 3.0, trailBegin: 2.0, trailDistance: 0.5, factorLong: 1, factorShort: 1, attrOCO: false, attrCO: false, attrREV: false, attrNET: false, instantOrderType: 'MTO', instantOrderDistance: 0.5, chainLimits: true,  eachTick: false },
  'Swing_III':      { name: 'Swing III',       atrMode: 'ATR 14d',  distance: 2,    progressLimits: 1.33, progressStops: 0.8, countLimits: 12, countStops: 6, slRel: 3.0, trailBegin: 2.0, trailDistance: 0.5, factorLong: 1, factorShort: 1, attrOCO: false, attrCO: false, attrREV: false, attrNET: false, instantOrderType: 'MTO', instantOrderDistance: 0.5, chainLimits: true,  eachTick: false },
  'Scalper_I':      { name: 'Scalper I',       atrMode: 'None',     distance: 2,    progressLimits: 1.1,  progressStops: 1,   countLimits: 4,  countStops: 1, slRel: 3.0, trailBegin: 2.0, trailDistance: 0.5, factorLong: 1, factorShort: 1, attrOCO: false, attrCO: false, attrREV: false, attrNET: false, instantOrderType: 'MTO', instantOrderDistance: 0.2, chainLimits: true,  eachTick: false },
  'Scalper_II':     { name: 'Scalper II',      atrMode: 'None',     distance: 0.25, progressLimits: 1.33, progressStops: 1,   countLimits: 4,  countStops: 1, slRel: 3.0, trailBegin: 0.5, trailDistance: 0.15,factorLong: 1, factorShort: 1, attrOCO: false, attrCO: false, attrREV: false, attrNET: false, instantOrderType: 'MTO', instantOrderDistance: 0.2, chainLimits: true,  eachTick: false },
  'Scalper_III':    { name: 'Scalper III',     atrMode: 'ATR 14d',  distance: 0.25, progressLimits: 2,    progressStops: 1,   countLimits: 4,  countStops: 1, slRel: 3.0, trailBegin: 0.25,trailDistance: 0.1, factorLong: 1, factorShort: 1, attrOCO: false, attrCO: false, attrREV: false, attrNET: false, instantOrderType: 'MTO', instantOrderDistance: 0.2, chainLimits: true,  eachTick: false },
  'Scalper_IV':     { name: 'Scalper IV',      atrMode: 'ATR 14d',  distance: 0.33, progressLimits: 2,    progressStops: 1,   countLimits: 4,  countStops: 1, slRel: 3.0, trailBegin: 0.5, trailDistance: 0.15,factorLong: 1, factorShort: 1, attrOCO: false, attrCO: false, attrREV: false, attrNET: false, instantOrderType: 'MTO', instantOrderDistance: 0.2, chainLimits: true,  eachTick: false },
  'Market_Trail':   { name: 'Market Trail',    atrMode: 'None',     distance: 1,    progressLimits: 0,    progressStops: 0,   countLimits: 0,  countStops: 0, slRel: 0,   trailBegin: 0,   trailDistance: 0,   factorLong: 1, factorShort: 1, attrOCO: false, attrCO: false, attrREV: false, attrNET: false, instantOrderType: 'MTO', instantOrderDistance: 1,   chainLimits: false, eachTick: false },
  'Market_Trail_ATR':{ name: 'Market Trail ATR',atrMode: 'ATR 14',  distance: 1,    progressLimits: 0,    progressStops: 0,   countLimits: 0,  countStops: 0, slRel: 0,   trailBegin: 0,   trailDistance: 0,   factorLong: 1, factorShort: 1, attrOCO: false, attrCO: false, attrREV: false, attrNET: false, instantOrderType: 'MTO', instantOrderDistance: 1,   chainLimits: false, eachTick: false },
  'Martingale_Swing':{ name: 'Martingale Swing',atrMode: 'None',    distance: 20,   progressLimits: 1.33, progressStops: 0.8, countLimits: 10, countStops: 0, slRel: 3.0, trailBegin: 20,  trailDistance: 2,   factorLong: 1, factorShort: 1, attrOCO: false, attrCO: false, attrREV: false, attrNET: false, instantOrderType: 'Market',instantOrderDistance: 1,  chainLimits: false, eachTick: false },
  'Progress_4_2':   { name: 'Progress 4/2',    atrMode: 'ATR 14d',  distance: 4,    progressLimits: 1.33, progressStops: 0.8, countLimits: 2,  countStops: 0, slRel: 3.0, trailBegin: 2.0, trailDistance: 0.5, factorLong: 1, factorShort: 1, attrOCO: false, attrCO: false, attrREV: false, attrNET: false, instantOrderType: 'MTO', instantOrderDistance: 0.5, chainLimits: true,  eachTick: false },
  'Progress_4_4':   { name: 'Progress 4/4',    atrMode: 'ATR 14d',  distance: 4,    progressLimits: 1.33, progressStops: 0.8, countLimits: 4,  countStops: 0, slRel: 3.0, trailBegin: 2.0, trailDistance: 0.5, factorLong: 1, factorShort: 1, attrOCO: false, attrCO: false, attrREV: false, attrNET: false, instantOrderType: 'MTO', instantOrderDistance: 0.5, chainLimits: true,  eachTick: false },
  'Progress_8_4':   { name: 'Progress 8/4',    atrMode: 'ATR 14d',  distance: 8,    progressLimits: 1.33, progressStops: 0.8, countLimits: 4,  countStops: 0, slRel: 3.0, trailBegin: 2.0, trailDistance: 0.5, factorLong: 1, factorShort: 1, attrOCO: false, attrCO: false, attrREV: false, attrNET: false, instantOrderType: 'MTO', instantOrderDistance: 0.5, chainLimits: true,  eachTick: false },
  'Progress_8_8':   { name: 'Progress 8/8',    atrMode: 'ATR 14d',  distance: 8,    progressLimits: 1.33, progressStops: 0.8, countLimits: 8,  countStops: 0, slRel: 3.0, trailBegin: 2.0, trailDistance: 0.5, factorLong: 1, factorShort: 1, attrOCO: false, attrCO: false, attrREV: false, attrNET: false, instantOrderType: 'MTO', instantOrderDistance: 0.5, chainLimits: true,  eachTick: false },
};

/** Placement result of a single scaled-order run */
export interface ScaledOrderResult {
  /** IDs of all placed orders (instant + limits + stops) */
  orderIds:    string[];
  /** Effective base distance in price units */
  baseDist:    number;
  /** Computed SL in price units from the entry level */
  slDist:      number;
  /** Trail-begin in price units */
  trailBeginDist: number;
  /** Trail distance in price units */
  trailDistDist:  number;
}

/**
 * ScaledOrderEngine — places a full grid of orders from one preset.
 *
 * For each direction (Long / Short / Both):
 *  1. Calculate ATR-based base distance
 *  2. Place an instant (MIT or market) entry at `instantOrderDistance` from current price
 *  3. Place `countLimits` additional buy/sell limits at progressive distances below/above
 *  4. Place `countStops` stop orders on the same side (for pyramiding in momentum)
 *  5. Apply SL, trail-begin, trail-distance via the engine setters
 *
 * "Chain limits" means each limit order carries the OCO attribute so that when
 * the nearest one fills, all more-distant ones are cancelled.
 */
export class ScaledOrderEngine {
  private _preset: ScaledOrderPreset;
  private _dailyBars: Bars | null = null;

  constructor(
    private readonly engine:  TradingEngine,
    private readonly symbol:  SymbolInfoBase,
    preset: ScaledOrderPreset | string,
  ) {
    this._preset = typeof preset === 'string'
      ? SCALED_ORDER_PRESETS[preset] ?? (() => { throw new Error(`Unknown preset: ${preset}`); })()
      : preset;
  }

  /** Provide daily bars for "ATR Nd" mode (optional, falls back to current bars) */
  setDailyBars(bars: Bars): void { this._dailyBars = bars; }

  // ──────────────────────────────────────────────────────────
  // Entry points
  // ──────────────────────────────────────────────────────────

  /** Place the full grid for a long (buy) position */
  async placeLong(currentBars: Bars, currentPrice: number): Promise<ScaledOrderResult> {
    return this._place(Side.Long, currentBars, currentPrice);
  }

  /** Place the full grid for a short (sell) position */
  async placeShort(currentBars: Bars, currentPrice: number): Promise<ScaledOrderResult> {
    return this._place(Side.Short, currentBars, currentPrice);
  }

  /** Place grids for both long and short simultaneously */
  async placeBoth(currentBars: Bars, currentPrice: number): Promise<{ long: ScaledOrderResult; short: ScaledOrderResult }> {
    const long  = await this._place(Side.Long,  currentBars, currentPrice);
    const short = await this._place(Side.Short, currentBars, currentPrice);
    return { long, short };
  }

  // ──────────────────────────────────────────────────────────
  // Core placement logic
  // ──────────────────────────────────────────────────────────

  private async _place(side: Side, bars: Bars, currentPrice: number): Promise<ScaledOrderResult> {
    const p     = this._preset;
    const sym   = this.symbol;
    const isLong = side === Side.Long;

    // 1. Compute base distance in price units
    const baseDist = this._calcBaseDist(p, bars);

    // 2. Derived distances
    const instantDist  = baseDist * p.instantOrderDistance;
    const slDist       = baseDist * p.slRel;
    const trailBegDist = baseDist * p.trailBegin;
    const trailDstDist = baseDist * p.trailDistance;

    const orderIds: string[] = [];
    const sizeFactor = isLong ? p.factorLong : p.factorShort;

    // 3. Configure SL / trail on the engine
    if (slDist > 0) {
      isLong ? this.engine.slBuy(sym.priceToPoints(slDist))
             : this.engine.slSell(sym.priceToPoints(slDist));
      isLong ? this.engine.slActivateBuy(true) : this.engine.slActivateSell(true);
    }
    if (trailBegDist > 0) {
      isLong ? this.engine.trailBeginBuy(sym.priceToPoints(trailBegDist))
             : this.engine.trailBeginSell(sym.priceToPoints(trailBegDist));
    }
    if (trailDstDist > 0) {
      isLong ? this.engine.trailDistanceBuy(sym.priceToPoints(trailDstDist))
             : this.engine.trailDistanceSell(sym.priceToPoints(trailDstDist));
    }

    // 4. Set order attributes
    if (p.attrOCO) this.engine.orderAttrOCO(true);
    if (p.attrCO)  this.engine.orderAttrCO(true);
    if (p.attrREV) this.engine.orderAttrREV(true);
    // p.attrNET: not implemented — TradingEngine net-mode is set via hedging=false constructor arg
    this.engine.orderSize(sizeFactor);

    // 5. Instant (first) order
    const instantPrice = isLong
      ? currentPrice - instantDist   // buy below current price (MTO)
      : currentPrice + instantDist;  // sell above current price (MTO)

    let instantId: string;
    if (p.instantOrderType === 'Market') {
      // Market order — execute immediately
      if (isLong) await this.engine.buy(sizeFactor);
      else        await this.engine.sell(sizeFactor);
      instantId = 'market';
    } else {
      // MIT — place limit and let it fill when price touches
      instantId = isLong
        ? this.engine.addBuyMIT(instantPrice, sizeFactor)
        : this.engine.addSellMIT(instantPrice, sizeFactor);
    }
    orderIds.push(instantId);

    // 6. Scale-in limit orders (below instant for longs, above for shorts)
    let cumulativeDist = instantDist;
    let stepDist       = baseDist;

    for (let i = 0; i < p.countLimits; i++) {
      cumulativeDist += stepDist;
      const limitPrice = isLong
        ? currentPrice - cumulativeDist
        : currentPrice + cumulativeDist;

      // Chain mode: each limit has OCO so nearest fill cancels the rest
      if (p.chainLimits) this.engine.orderAttrOCO(true);
      this.engine.orderSize(sizeFactor);

      const id = isLong
        ? this.engine.addBuyLimit(limitPrice, sizeFactor)
        : this.engine.addSellLimit(limitPrice, sizeFactor);
      orderIds.push(id);

      stepDist *= p.progressLimits > 0 ? p.progressLimits : 1;
    }

    // 7. Stop orders (momentum continuation, same direction)
    stepDist = baseDist;
    let stopCumulDist = instantDist;
    for (let i = 0; i < p.countStops; i++) {
      stopCumulDist += stepDist;
      // Stop orders go in the direction of momentum (above current for buy-stops)
      const stopPrice = isLong
        ? currentPrice + stopCumulDist
        : currentPrice - stopCumulDist;

      this.engine.orderSize(sizeFactor);
      const id = isLong
        ? this.engine.addBuyStop(stopPrice, sizeFactor)
        : this.engine.addSellStop(stopPrice, sizeFactor);
      orderIds.push(id);

      stepDist *= p.progressStops > 0 ? p.progressStops : 1;
    }

    return { orderIds, baseDist, slDist, trailBeginDist: trailBegDist, trailDistDist: trailDstDist };
  }

  private _calcBaseDist(p: ScaledOrderPreset, bars: Bars): number {
    const atrInfo = parseAtrMode(p.atrMode);
    if (!atrInfo) {
      // "None" mode — distance is in raw points
      return this.symbol.pointsToPrice(p.distance);
    }
    const sourceBars = atrInfo.daily && this._dailyBars ? this._dailyBars : bars;
    const atrPrice   = sourceBars.atr(atrInfo.period, 1);
    return atrPrice * p.distance;
  }
}

// ─────────────────────────────────────────────────────────────
// Usage wiring example
// ─────────────────────────────────────────────────────────────
/*
// 1. Implement IBrokerAdapter for your broker
class MyBroker implements IBrokerAdapter {
  async marketOrder(side, size, info?) { ... }
  async closePosition(side, size, info?) { ... }
  async updateSLTP(side, sl, tp) { ... }
  async getSpread(symbol) { return 0.0001; }
  async getAccount() { return { equity: 10000, balance: 10000 }; }
}

// 2. Set up
const symbol = new SymbolInfoForex('EURUSD', 5);
const engine = new TradingEngine(symbol, new MyBroker(), true); // hedging=true

// 3. Example: OCO bracket order
engine.orderAttrOCO(true);
engine.addBracket({ entryType: 'BUY_STOP', entryPrice: 1.10500, slPts: 20, tpPts: 40 });
engine.orderAttrOCO(true);
engine.addBracket({ entryType: 'SELL_STOP', entryPrice: 1.10300, slPts: 20, tpPts: 40 });

// 4. Example: MIT order
engine.addBuyMIT(1.10200);

// 5. Example: trailing buy-limit (limit pullback)
engine.orderLimitPullback(10);  // 10 points pullback from market high
engine.addBuyLimit(0);          // price set dynamically each bar

// 6. On each bar
async function onBar(allBars: OHLC[]) {
  const bars = new Bars(allBars);
  await engine.onBar(bars.bar(0), bars);
  await evaluateCandleATR03(bars, engine, symbol);
}
*/
