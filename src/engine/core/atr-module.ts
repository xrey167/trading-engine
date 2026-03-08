import type { AtrMethod, BarsAtrMode, BarBase } from '../../shared/domain/engine-enums.js';
import type { Bars } from '../../shared/domain/bar/bars.js';
import type { SymbolInfoBase } from './symbol.js';
import type { TradingEngine } from './trading-engine.js';

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
