import { Type, type Static } from '@sinclair/typebox';
import { OrderState } from '../history/history.js';

export const Side = { None: 0, Long: 1, Short: -1 } as const;
export type Side = (typeof Side)[keyof typeof Side];

export const OrderAttr = {
  OCO:  'ORDER_ATTR_OCO',
  CO:   'ORDER_ATTR_CO',
  CS:   'ORDER_ATTR_CS',
  REV:  'ORDER_ATTR_REV',
  NET:  'ORDER_ATTR_NET',
  SLTP: 'ORDER_ATTR_SLTP',
  ROL:  'ORDER_ATTR_ROL',
  ROP:  'ORDER_ATTR_ROP',
  MIT:  'ORDER_ATTR_MIT',
  FC:   'ORDER_ATTR_FC',
} as const;
export type OrderAttr = (typeof OrderAttr)[keyof typeof OrderAttr];

export const LimitConfirm = {
  None:      'LIMIT_CONFIRM_NONE',
  Wick:      'LIMIT_CONFIRM_WICK',
  WickBreak: 'LIMIT_CONFIRM_WICKBREAK',
  WickColor: 'LIMIT_CONFIRM_WICKCOLOR',
} as const;
export type LimitConfirm = (typeof LimitConfirm)[keyof typeof LimitConfirm];

export type ExitReason = 'SL' | 'TP' | 'SL_BOTH' | 'TP_BOTH';

export const OrderSide = {
  BUY: 'BUY',
  SELL: 'SELL',
} as const;
export type OrderSide = (typeof OrderSide)[keyof typeof OrderSide];

export const OrderType = {
  Buy:          'BUY',
  Sell:         'SELL',
  BuyLimit:     'BUY_LIMIT',
  SellLimit:    'SELL_LIMIT',
  BuyStop:      'BUY_STOP',
  SellStop:     'SELL_STOP',
  BuyStopLimit: 'BUY_STOP_LIMIT',
  SellStopLimit:'SELL_STOP_LIMIT',
  CloseBy:      'CLOSE_BY',
} as const;
export type OrderType = (typeof OrderType)[keyof typeof OrderType];

export const OrderFilling = {
  FOK:    'FOK',
  IOC:    'IOC',
  Return: 'RETURN',
} as const;
export type OrderFilling = (typeof OrderFilling)[keyof typeof OrderFilling];

/** All order entry types accepted by the HTTP API (superset of engine's pending-only OrderEntryType). */
export const OrderEntryType = {
  BuyMarket:      'BUY_MARKET',
  SellMarket:     'SELL_MARKET',
  BuyLimit:       'BUY_LIMIT',
  BuyStop:        'BUY_STOP',
  SellLimit:      'SELL_LIMIT',
  SellStop:       'SELL_STOP',
  BuyMIT:         'BUY_MIT',
  SellMIT:        'SELL_MIT',
  BuyStopLimit:   'BUY_STOP_LIMIT',
  SellStopLimit:  'SELL_STOP_LIMIT',
  BuyMTO:         'BUY_MTO',
  SellMTO:        'SELL_MTO',
  BuyLimitTrail:  'BUY_LIMIT_TRAIL',
  BuyStopTrail:   'BUY_STOP_TRAIL',
  SellLimitTrail: 'SELL_LIMIT_TRAIL',
  SellStopTrail:  'SELL_STOP_TRAIL',
} as const;
export type OrderEntryType = (typeof OrderEntryType)[keyof typeof OrderEntryType];

// ─────────────────────────────────────────────────────────────
// Schema + VO (serialization / API boundary)
// ─────────────────────────────────────────────────────────────

const OrderTypeSchema  = Type.Union(Object.values(OrderType).map(v  => Type.Literal(v)));
const OrderStateSchema = Type.Union(Object.values(OrderState).map(v => Type.Literal(v)));

export const HistoryOrderInfoVOSchema = Type.Object({
  ticket:        Type.Number(),
  userId:        Type.String(),
  brokerId:      Type.String(),
  symbol:        Type.String(),
  type:          OrderTypeSchema,
  state:         OrderStateSchema,
  volumeInitial: Type.Number(),
  volumeCurrent: Type.Number(),
  priceOpen:     Type.Number(),
  stopLoss:      Type.Number(),
  takeProfit:    Type.Number(),
  timeSetup:     Type.String({ format: 'date-time' }),
  timeDone:      Type.String({ format: 'date-time' }),
  comment:       Type.String(),
});
export type HistoryOrderInfoVO = Static<typeof HistoryOrderInfoVOSchema>;

export const OrderVOFactory = {
  make(overrides: Partial<HistoryOrderInfoVO> & Pick<HistoryOrderInfoVO, 'userId' | 'symbol'>): HistoryOrderInfoVO {
    const defaults: HistoryOrderInfoVO = {
      ticket:        0,
      userId:        overrides.userId,
      symbol:        overrides.symbol,
      brokerId:      '',
      type:          OrderType.Buy,
      state:         OrderState.Filled,
      volumeInitial: 0,
      volumeCurrent: 0,
      priceOpen:     0,
      stopLoss:      0,
      takeProfit:    0,
      timeSetup:     new Date().toISOString(),
      timeDone:      new Date().toISOString(),
      comment:       '',
    };
    return { ...defaults, ...overrides };
  },
};

// ─────────────────────────────────────────────────────────────
// OrderBase — shared domain logic for all order-like entities
// ─────────────────────────────────────────────────────────────

/** Abstract base for all order representations (history VO, engine active orders). */
export abstract class OrderBase {
  abstract readonly symbol:     string;
  abstract readonly stopLoss:   number;
  abstract readonly takeProfit: number;

  /** Numeric direction: `Side.Long` (+1) for buy-side, `Side.Short` (-1) for sell-side. */
  abstract direction(): Side;

  isBuy():  boolean { return this.direction() === Side.Long;  }
  isSell(): boolean { return this.direction() === Side.Short; }

  hasStopLoss():   boolean { return this.stopLoss   > 0; }
  hasTakeProfit(): boolean { return this.takeProfit > 0; }
}

// ─────────────────────────────────────────────────────────────
// Order — historical VO domain class with behaviour
// ─────────────────────────────────────────────────────────────

export class Order extends OrderBase {
  constructor(
    public readonly ticket:        number,
    public readonly userId:        string,
    public readonly brokerId:      string,
    public readonly symbol:        string,
    public readonly type:          OrderType,
    public readonly state:         OrderState,
    public readonly volumeInitial: number,
    public readonly volumeCurrent: number,
    public readonly priceOpen:     number,
    public readonly stopLoss:      number,
    public readonly takeProfit:    number,
    public readonly timeSetup:     Date,
    public readonly timeDone:      Date,
    public readonly comment:       string,
  ) { super(); }

  // ── Direction (implements OrderBase) ──────────────────────

  direction(): Side { return this.type.startsWith('BUY') ? Side.Long : Side.Short; }

  // ── Type predicates ───────────────────────────────────────

  isMarket():  boolean { return this.type === OrderType.Buy || this.type === OrderType.Sell; }
  isPending(): boolean { return !this.isMarket() && this.type !== OrderType.CloseBy; }

  // ── State predicates ──────────────────────────────────────

  isFilled():   boolean { return this.state === OrderState.Filled;  }
  isPartial():  boolean { return this.state === OrderState.Partial; }
  isActive():   boolean { return this.state === OrderState.Placed || this.state === OrderState.Partial; }
  isCanceled(): boolean {
    return this.state === OrderState.Canceled
        || this.state === OrderState.Rejected
        || this.state === OrderState.Expired;
  }

  // ── SL / TP ───────────────────────────────────────────────

  /** `true` when the SL has been moved to or past the open price in the profitable direction — position cannot lose. */
  isBreakeven(): boolean {
    if (!this.hasStopLoss()) return false;
    const delta = this.isBuy()
      ? this.stopLoss  - this.priceOpen   // buy: SL >= open → breakeven
      : this.priceOpen - this.stopLoss;   // sell: open >= SL → breakeven
    return delta >= 0;
  }

  // ── Volume ────────────────────────────────────────────────

  volumeRemaining(): number { return this.volumeInitial - this.volumeCurrent; }

  // ── Conversion ────────────────────────────────────────────

  /** Construct an Order from a serialized VO. */
  static fromVO(vo: HistoryOrderInfoVO): Order {
    return new Order(
      vo.ticket, vo.userId, vo.brokerId, vo.symbol,
      vo.type as OrderType, vo.state as OrderState,
      vo.volumeInitial, vo.volumeCurrent,
      vo.priceOpen, vo.stopLoss, vo.takeProfit,
      new Date(vo.timeSetup), new Date(vo.timeDone),
      vo.comment,
    );
  }

  /** Serialize back to a VO for transport or persistence. */
  toVO(): HistoryOrderInfoVO {
    return {
      ticket:        this.ticket,
      userId:        this.userId,
      brokerId:      this.brokerId,
      symbol:        this.symbol,
      type:          this.type,
      state:         this.state,
      volumeInitial: this.volumeInitial,
      volumeCurrent: this.volumeCurrent,
      priceOpen:     this.priceOpen,
      stopLoss:      this.stopLoss,
      takeProfit:    this.takeProfit,
      timeSetup:     this.timeSetup.toISOString(),
      timeDone:      this.timeDone.toISOString(),
      comment:       this.comment,
    };
  }
}
