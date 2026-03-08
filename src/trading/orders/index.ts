import { Side, type TrailMode, type LimitConfirm } from '../../shared/domain/engine-enums.js';
import type { Bar } from '../../shared/domain/bar/bar.js';
import type { Bars } from '../../market-data/bars.js';
import type { SymbolInfoBase } from '../../engine/core/symbol.js';

export type OrderEntryType =
  | 'BUY_LIMIT'
  | 'BUY_STOP'
  | 'SELL_LIMIT'
  | 'SELL_STOP'
  | 'BUY_MIT'
  | 'SELL_MIT'
  | 'BUY_STOP_LIMIT'
  | 'SELL_STOP_LIMIT'
  | 'BUY_MTO'
  | 'SELL_MTO';

export interface OrderParams {
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

export abstract class Order {
  readonly id:            string;
  readonly type:          OrderEntryType;
  readonly side:          Side;
  price:                  number;
  readonly size:          number;
  readonly time:          Date;
  oco:           boolean;
  co:            boolean;
  cs:            boolean;
  rev:           boolean;
  bracketSL?:    number;
  bracketTP?:    number;
  limitConfirm?: LimitConfirm;
  pullbackPts?:  number;
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

  get fillsAtMarket(): boolean { return false; }

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

  toJSON(): { id: string; type: OrderEntryType; side: Side; price: number; size: number; time: Date } {
    return { id: this.id, type: this.type, side: this.side, price: this.price, size: this.size, time: this.time };
  }
}

export class LimitOrder extends Order {
  isFilled(bar: Bar): boolean {
    return this.side === Side.Long ? bar.low <= this.price : bar.high >= this.price;
  }
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
  isFilled(bar: Bar): boolean {
    return this.side === Side.Long ? bar.low <= this.price : bar.high >= this.price;
  }
  computeFillPrice(bar: Bar): number { return bar.close; }
  override get fillsAtMarket(): boolean { return true; }
}

export class StopLimitOrder extends Order {
  readonly limitPrice: number;

  constructor(p: OrderParams & { limitPrice: number }) {
    super(p);
    this.limitPrice = p.limitPrice;
  }
  isFilled(bar: Bar): boolean {
    return this.side === Side.Long ? bar.high >= this.price : bar.low <= this.price;
  }
  computeFillPrice(bar: Bar): number {
    return this.side === Side.Long ? Math.max(this.limitPrice, bar.open) : Math.min(this.limitPrice, bar.open);
  }
  limitCovered(bar: Bar): boolean {
    return this.side === Side.Long ? bar.low <= this.limitPrice : bar.high >= this.limitPrice;
  }
  override toJSON() {
    return { ...super.toJSON(), limitPrice: this.limitPrice };
  }
}

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
    if (this.pullbackPts != null) { super.updateTrailingRef(bar, _bars, symbol); return; }
    this._updateTrailRef(bar, symbol);
  }

  protected abstract _updateTrailRef(bar: Bar, symbol: SymbolInfoBase): void;
}

export class TrailingLimitOrder extends TrailingOrder {
  protected override _updateTrailRef(bar: Bar, symbol: SymbolInfoBase): void {
    const dist = symbol.pointsToPrice(this.trailEntry.distPts);
    if (this.side === Side.Long) {
      if (bar.high > (this._trailRef ?? -Infinity)) { this._trailRef = bar.high; this.price = bar.high - dist; }
    } else {
      if (bar.low < (this._trailRef ?? Infinity)) { this._trailRef = bar.low; this.price = bar.low + dist; }
    }
  }
  isFilled(bar: Bar): boolean {
    return this.side === Side.Long ? bar.low <= this.price : bar.high >= this.price;
  }
  computeFillPrice(bar: Bar): number {
    return this.side === Side.Long ? Math.max(this.price, bar.open) : Math.min(this.price, bar.open);
  }
}

export class TrailingStopOrder extends TrailingOrder {
  protected override _updateTrailRef(bar: Bar, symbol: SymbolInfoBase): void {
    const dist = symbol.pointsToPrice(this.trailEntry.distPts);
    if (this.side === Side.Long) {
      if (bar.low < (this._trailRef ?? Infinity)) { this._trailRef = bar.low; this.price = bar.low + dist; }
    } else {
      if (bar.high > (this._trailRef ?? -Infinity)) { this._trailRef = bar.high; this.price = bar.high - dist; }
    }
  }
  isFilled(bar: Bar): boolean {
    return this.side === Side.Long ? bar.high >= this.price : bar.low <= this.price;
  }
  computeFillPrice(bar: Bar): number {
    return this.side === Side.Long ? Math.max(this.price, bar.open) : Math.min(this.price, bar.open);
  }
}

export class MTOOrder extends TrailingStopOrder {
  computeFillPrice(bar: Bar): number { return bar.close; }
  override get fillsAtMarket(): boolean { return true; }
}

export function isTrailingOrder(o: Order): o is TrailingOrder   { return o instanceof TrailingOrder;   }
export function isStopLimitOrder(o: Order): o is StopLimitOrder { return o instanceof StopLimitOrder; }

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
  if (params.type === 'BUY_MTO' || params.type === 'SELL_MTO') {
    return new MTOOrder(params as CreateMTOParams);
  }
  if (params.type === 'BUY_STOP_LIMIT' || params.type === 'SELL_STOP_LIMIT') {
    return new StopLimitOrder(params as CreateStopLimitParams);
  }
  if ('trailEntry' in params) {
    if (params.type === 'BUY_LIMIT' || params.type === 'SELL_LIMIT') {
      return new TrailingLimitOrder(params as CreateTrailingLimitParams);
    }
    return new TrailingStopOrder(params as CreateTrailingStopParams);
  }
  switch (params.type) {
    case 'BUY_LIMIT':  case 'SELL_LIMIT': return new LimitOrder(params);
    case 'BUY_STOP':   case 'SELL_STOP':  return new StopOrder(params);
    case 'BUY_MIT':    case 'SELL_MIT':   return new MITOrder(params);
  }
}
