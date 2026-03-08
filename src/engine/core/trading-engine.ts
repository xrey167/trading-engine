import { Side, TrailMode, LimitConfirm } from '../../shared/domain/engine-enums.js';
import { Bar } from '../../market-data/bar.js';
import type { Bars } from '../../market-data/bars.js';
import type { SymbolInfoBase } from './symbol.js';
import type { PositionSlot, DealRecord, DealStats, IBrokerAdapter, ExecutionReport } from './position.js';
import { dealStatsComputed } from './position.js';
import type { TrailConfig, TrailState } from '../../trading/trailing-stop.js';
import { calcTrailingSL, checkSLTP } from '../../trading/trailing-stop.js';
import type { CreateOrderParams, OrderParams, OrderEntryType } from '../../trading/orders/index.js';
import { type Order, LimitOrder, isStopLimitOrder, createOrder } from '../../trading/orders/index.js';

export { dealStatsComputed };
export type { DealRecord, DealStats, IBrokerAdapter, ExecutionReport, PositionSlot };

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

/** Maximum number of deal records retained before oldest entries are discarded. */
const MAX_DEALS = 10_000;

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
  onOrderExpired?: (orders: Order[]) => void;

  // Spread cache
  private _spreadAbs = 0;

  // Last bar timestamp — used for deterministic deal close-time in _closeSlot
  private _lastBarTime: Date = new Date(0);
  private _lastBars: Bars | null = null;

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
    this._lastBars = bars;
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

  /**
   * Process a single price tick.
   * Runs fill checks and SL/TP exits using a synthetic bar (all OHLC = price).
   * Indicator updates (ATR, trailing entry) are bar-level — NOT run here.
   * Requires at least one prior onBar call to establish bar context.
   */
  async onTick(price: number, time: Date): Promise<void> {
    if (!this._lastBars) {
      throw new Error('onTick requires at least one onBar call first');
    }
    this._spreadAbs = await this.broker.getSpread(this.symbol.name);

    const tick = new Bar(price, price, price, price, time);

    for (const slot of [this.longPos, this.shortPos]) {
      if (slot.size === 0) continue;
      await this._checkExits(slot, tick);
    }
    await this._checkOrderFills(tick, this._lastBars);
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
    const id = this._nextOrderId();
    const p  = this._consumeNextParams(id, 'BUY_STOP_LIMIT', Side.Long, stopPrice, size);
    this._resetNextAttrs();
    return this._registerOrder(createOrder({ ...p, limitPrice } as CreateOrderParams)).id;
  }

  /**
   * Stop-limit sell: triggers when price drops to `stopPrice`, then fills as a
   * limit sell only if the bar's high reaches `limitPrice` (must be ≥ stopPrice).
   */
  addSellStopLimit(stopPrice: number, limitPrice: number, size?: number): string {
    const id = this._nextOrderId();
    const p  = this._consumeNextParams(id, 'SELL_STOP_LIMIT', Side.Short, stopPrice, size);
    this._resetNextAttrs();
    return this._registerOrder(createOrder({ ...p, limitPrice } as CreateOrderParams)).id;
  }

  /**
   * MTO (Market Trail Order) buy: a trailing stop order that fills as a market
   * order when triggered. The stop price trails below the market by `distancePts`,
   * anchoring lower each bar. When the bar's high crosses the stop price a
   * market buy is executed.
   */
  addBuyMTO(mode: TrailMode, distancePts: number, periods = 0): string {
    const id = this._nextOrderId();
    const p  = this._consumeNextParams(id, 'BUY_MTO', Side.Long, Infinity);
    this._resetNextAttrs();
    return this._registerOrder(createOrder({ ...p, trailEntry: { mode, distPts: distancePts, periods }, _trailRef: Infinity } as CreateOrderParams)).id;
  }

  /**
   * MTO (Market Trail Order) sell: a trailing stop order that fills as a market
   * order when triggered. The stop price trails above the market by `distancePts`,
   * anchoring higher each bar. When the bar's low crosses the stop price a
   * market sell is executed.
   */
  addSellMTO(mode: TrailMode, distancePts: number, periods = 0): string {
    const id = this._nextOrderId();
    const p  = this._consumeNextParams(id, 'SELL_MTO', Side.Short, -Infinity);
    this._resetNextAttrs();
    return this._registerOrder(createOrder({ ...p, trailEntry: { mode, distPts: distancePts, periods }, _trailRef: -Infinity } as CreateOrderParams)).id;
  }

  /**
   * Trailing buy-limit — entry order whose price trails below the market.
   * The limit price is set to market - distancePts, and re-anchored upward
   * each bar as long as price rises.
   */
  addBuyLimitTrail(mode: TrailMode, distancePts: number, periods = 0): string {
    const id = this._nextOrderId();
    const p  = this._consumeNextParams(id, 'BUY_LIMIT', Side.Long, 0);
    this._resetNextAttrs();
    return this._registerOrder(createOrder({ ...p, trailEntry: { mode, distPts: distancePts, periods }, _trailRef: -Infinity } as CreateOrderParams)).id;
  }

  addSellLimitTrail(mode: TrailMode, distancePts: number, periods = 0): string {
    const id = this._nextOrderId();
    const p  = this._consumeNextParams(id, 'SELL_LIMIT', Side.Short, 0);
    this._resetNextAttrs();
    return this._registerOrder(createOrder({ ...p, trailEntry: { mode, distPts: distancePts, periods }, _trailRef: Infinity } as CreateOrderParams)).id;
  }

  /** Trailing buy-stop — stop price trails above the market. */
  addBuyStopTrail(mode: TrailMode, distancePts: number, periods = 0): string {
    const id = this._nextOrderId();
    const p  = this._consumeNextParams(id, 'BUY_STOP', Side.Long, Infinity);
    this._resetNextAttrs();
    return this._registerOrder(createOrder({ ...p, trailEntry: { mode, distPts: distancePts, periods }, _trailRef: Infinity } as CreateOrderParams)).id;
  }

  addSellStopTrail(mode: TrailMode, distancePts: number, periods = 0): string {
    const id = this._nextOrderId();
    const p  = this._consumeNextParams(id, 'SELL_STOP', Side.Short, 0);
    this._resetNextAttrs();
    return this._registerOrder(createOrder({ ...p, trailEntry: { mode, distPts: distancePts, periods }, _trailRef: -Infinity } as CreateOrderParams)).id;
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
      // Use last bar time so order creation timestamps are deterministic during historical replay.
      // Falls back to epoch (new Date(0)) before the first onBar call, which is acceptable.
      time: this._lastBarTime,
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

  private _nextOrderId(): string {
    return `ord_${++this._orderSeq}`;
  }

  private _registerOrder(o: Order): Order {
    this.orders.push(o);
    return o;
  }

  /** Factory for simple (non-trailing, non-stop-limit) order types. */
  private _addOrder(type: 'BUY_LIMIT' | 'SELL_LIMIT' | 'BUY_STOP' | 'SELL_STOP' | 'BUY_MIT' | 'SELL_MIT',
    side: Side, price: number, size?: number,
  ): Order {
    const id = this._nextOrderId();
    const p  = this._consumeNextParams(id, type, side, price, size);
    this._resetNextAttrs();
    return this._registerOrder(createOrder(p as CreateOrderParams));
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
          pullbackPts: o.pullbackPts,
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
    if (this._removeOrdersOnFlat && this.getCntPos() === 0) {
      if (this.onOrderExpired && this.orders.length > 0) {
        this.onOrderExpired([...this.orders]);
      }
      this.orders = [];
    }
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
