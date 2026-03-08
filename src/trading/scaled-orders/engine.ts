import { Side } from '../../shared/domain/engine-enums.js';
import type { Bars } from '../../market-data/bars.js';
import type { SymbolInfoBase } from '../../engine/core/symbol.js';
import type { TradingEngine } from '../../engine/core/trading-engine.js';

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
      if (p.attrCO)  this.engine.orderAttrCO(true);
      if (p.attrREV) this.engine.orderAttrREV(true);
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

      if (p.attrCO)  this.engine.orderAttrCO(true);
      if (p.attrREV) this.engine.orderAttrREV(true);
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
