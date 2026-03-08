import { Type, type Static } from '@sinclair/typebox';
import { DealType, DealEntry } from '../history/history.js';

// ─────────────────────────────────────────────────────────────
// Schema + VO (serialization / API boundary)
// ─────────────────────────────────────────────────────────────

const DealTypeSchema  = Type.Union(Object.values(DealType).map(v  => Type.Literal(v)));
const DealEntrySchema = Type.Union(Object.values(DealEntry).map(v => Type.Literal(v)));

export const DealInfoVOSchema = Type.Object({
  ticket:     Type.Number(),
  userId:     Type.String(),
  order:      Type.Number(),
  positionId: Type.Number(),
  symbol:     Type.String(),
  type:       DealTypeSchema,
  entry:      DealEntrySchema,
  volume:     Type.Number(),
  price:      Type.Number(),
  commission: Type.Number(),
  swap:       Type.Number(),
  profit:     Type.Number(),
  time:       Type.String({ format: 'date-time' }),
  comment:    Type.String(),
});
export type DealInfoVO = Static<typeof DealInfoVOSchema>;

export const DealInfoVOFactory = {
  make(overrides: Partial<DealInfoVO> & Pick<DealInfoVO, 'userId' | 'symbol'>): DealInfoVO {
    const defaults: DealInfoVO = {
      ticket:     0,
      userId:     overrides.userId,
      symbol:     overrides.symbol,
      type:       DealType.Buy,
      entry:      DealEntry.In,
      order:      0,
      positionId: 0,
      volume:     0,
      price:      0,
      commission: 0,
      swap:       0,
      profit:     0,
      time:       new Date().toISOString(),
      comment:    '',
    };
    return { ...defaults, ...overrides };
  },
};

// ─────────────────────────────────────────────────────────────
// Deal — domain class with computed behaviour
// ─────────────────────────────────────────────────────────────

export class Deal {
  constructor(
    public readonly ticket:     number,
    public readonly userId:     string,
    public readonly order:      number,
    public readonly positionId: number,
    public readonly symbol:     string,
    public readonly type:       DealType,
    public readonly entry:      DealEntry,
    public readonly volume:     number,
    public readonly price:      number,
    public readonly commission: number,
    public readonly swap:       number,
    public readonly profit:     number,
    public readonly time:       Date,
    public readonly comment:    string,
  ) {}

  // ── Direction ─────────────────────────────────────────────

  isBuy():  boolean { return this.type === DealType.Buy;  }
  isSell(): boolean { return this.type === DealType.Sell; }

  // ── Entry / exit ─────────────────────────────────────────

  /** `true` when this deal opens or partially opens a position. */
  isEntry(): boolean {
    return this.entry === DealEntry.In || this.entry === DealEntry.InOut;
  }

  /** `true` when this deal closes or partially closes a position. */
  isExit(): boolean {
    return this.entry === DealEntry.Out
        || this.entry === DealEntry.OutBy
        || this.entry === DealEntry.InOut;
  }

  // ── P&L ──────────────────────────────────────────────────

  /** Gross profit minus commission and swap charges. */
  netProfit(): number { return this.profit - this.commission - this.swap; }

  isProfitable(): boolean { return this.netProfit() > 0; }

  // ── Conversion ───────────────────────────────────────────

  /** Construct a Deal from a serialized VO. */
  static fromVO(vo: DealInfoVO): Deal {
    return new Deal(
      vo.ticket,
      vo.userId,
      vo.order,
      vo.positionId,
      vo.symbol,
      vo.type as DealType,
      vo.entry as DealEntry,
      vo.volume,
      vo.price,
      vo.commission,
      vo.swap,
      vo.profit,
      new Date(vo.time),
      vo.comment,
    );
  }

  /** Serialize back to a VO for transport or persistence. */
  toVO(): DealInfoVO {
    return {
      ticket:     this.ticket,
      userId:     this.userId,
      order:      this.order,
      positionId: this.positionId,
      symbol:     this.symbol,
      type:       this.type,
      entry:      this.entry,
      volume:     this.volume,
      price:      this.price,
      commission: this.commission,
      swap:       this.swap,
      profit:     this.profit,
      time:       this.time.toISOString(),
      comment:    this.comment,
    };
  }
}
