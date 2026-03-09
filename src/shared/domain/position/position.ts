import { Type, type Static } from '@sinclair/typebox';
import type { CanonicalId } from '../../lib/canonical-id/index.js';

export const PositionType = { BUY: 'BUY', SELL: 'SELL' } as const;
export type PositionType = (typeof PositionType)[keyof typeof PositionType];

// ─────────────────────────────────────────────────────────────
// Schema + VO (serialization / API boundary)
// ─────────────────────────────────────────────────────────────

const PositionTypeSchema = Type.Union(Object.values(PositionType).map(v => Type.Literal(v)));

export const PositionInfoVOSchema = Type.Object({
  ticket:         Type.Number(),
  userId:         Type.String(),
  brokerId:       Type.Optional(Type.String()),
  symbol:         Type.String(),
  type:           PositionTypeSchema,
  magic:          Type.Number(),
  identifier:     Type.Number(),
  time:           Type.String({ format: 'date-time' }),
  timeUpdate:     Type.Optional(Type.String({ format: 'date-time' })),
  priceOpen:      Type.Number(),
  priceCurrent:   Type.Number(),
  stopLoss:       Type.Number(),
  takeProfit:     Type.Number(),
  priceStopLimit: Type.Number(),
  volume:         Type.Number(),
  commission:     Type.Number(),
  swap:           Type.Number(),
  profit:         Type.Number(),
  comment:        Type.String(),
  externalId:     Type.String(),
  reason:      Type.Number(),
  canonicalId: Type.Optional(Type.String()),
});
export type PositionInfoVO = Static<typeof PositionInfoVOSchema>;

export const PositionVOFactory = {
  make(overrides: Partial<PositionInfoVO> & Pick<PositionInfoVO, 'userId' | 'symbol'>): PositionInfoVO {
    const defaults: PositionInfoVO = {
      ticket:         0,
      userId:         overrides.userId,
      brokerId:       '',
      symbol:         overrides.symbol,
      type:           PositionType.BUY,
      magic:          0,
      identifier:     0,
      time:           new Date().toISOString(),
      priceOpen:      0,
      priceCurrent:   0,
      stopLoss:       0,
      takeProfit:     0,
      priceStopLimit: 0,
      volume:         0,
      commission:     0,
      swap:           0,
      profit:         0,
      comment:        '',
      externalId:     '',
      reason:         0,
    };
    return { ...defaults, ...overrides };
  },
};

export class Position {
  constructor(
    public readonly ticket:         number,
    public readonly userId:         string,
    public readonly brokerId:       string,
    public readonly symbol:         string,
    public readonly type:           PositionType,
    public readonly magic:          number,
    public readonly identifier:     number,
    public readonly time:           Date,
    public readonly timeUpdate:     Date | undefined,
    public readonly priceOpen:      number,
    public readonly priceCurrent:   number,
    public readonly stopLoss:       number,
    public readonly takeProfit:     number,
    public readonly priceStopLimit: number,
    public readonly volume:         number,
    public readonly commission:     number,
    public readonly swap:           number,
    public readonly profit:         number,
    public readonly comment:        string,
    public readonly externalId:     string,
    public readonly reason:         number,
    public readonly canonicalId?:   CanonicalId,
  ) {}

  // ── Direction ─────────────────────────────────────────────
  isBuy():  boolean { return this.type === PositionType.BUY;  }
  isSell(): boolean { return this.type === PositionType.SELL; }

  // ── SL / TP ────────────────────────────────────────────────
  hasStopLoss():   boolean { return this.stopLoss   > 0; }
  hasTakeProfit(): boolean { return this.takeProfit > 0; }

  /** SL at or past open price in the profitable direction → position cannot lose. */
  isBreakeven(): boolean {
    if (!this.hasStopLoss()) return false;
    const delta = this.isBuy()
      ? this.stopLoss  - this.priceOpen   // buy:  SL >= open → breakeven
      : this.priceOpen - this.stopLoss;   // sell: open >= SL → breakeven
    return delta >= 0;
  }

  // ── P&L ───────────────────────────────────────────────────
  /** Gross profit plus commission and swap (both stored as signed negative costs). */
  netProfit(): number { return this.profit + this.commission + this.swap; }
  isProfitable(): boolean { return this.netProfit() > 0; }

  // ── Conversion ───────────────────────────────────────────
  static fromVO(vo: PositionInfoVO): Position {
    return new Position(
      vo.ticket,
      vo.userId,
      vo.brokerId ?? '',
      vo.symbol,
      vo.type,
      vo.magic,
      vo.identifier,
      new Date(vo.time),
      vo.timeUpdate !== undefined ? new Date(vo.timeUpdate) : undefined,
      vo.priceOpen,
      vo.priceCurrent,
      vo.stopLoss,
      vo.takeProfit,
      vo.priceStopLimit,
      vo.volume,
      vo.commission,
      vo.swap,
      vo.profit,
      vo.comment,
      vo.externalId,
      vo.reason,
      vo.canonicalId as CanonicalId | undefined,
    );
  }

  toVO(): PositionInfoVO {
    return {
      ticket:         this.ticket,
      userId:         this.userId,
      brokerId:       this.brokerId,
      symbol:         this.symbol,
      type:           this.type,
      magic:          this.magic,
      identifier:     this.identifier,
      time:           this.time.toISOString(),
      ...(this.timeUpdate ? { timeUpdate: this.timeUpdate.toISOString() } : {}),
      priceOpen:      this.priceOpen,
      priceCurrent:   this.priceCurrent,
      stopLoss:       this.stopLoss,
      takeProfit:     this.takeProfit,
      priceStopLimit: this.priceStopLimit,
      volume:         this.volume,
      commission:     this.commission,
      swap:           this.swap,
      profit:         this.profit,
      comment:        this.comment,
      externalId:     this.externalId,
      reason:         this.reason,
      ...(this.canonicalId !== undefined ? { canonicalId: this.canonicalId } : {}),
    };
  }
}
