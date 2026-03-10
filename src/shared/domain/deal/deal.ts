import { Type, type Static } from '@sinclair/typebox';
import { enumSchema } from '../../schemas/common.js';
import { DealType, DealEntry, DealReason } from '../history/history.js';
import type { CanonicalId } from '../../lib/canonical-id/index.js';

// ─────────────────────────────────────────────────────────────
// Schema + VO (serialization / API boundary)
// ─────────────────────────────────────────────────────────────

const DealTypeSchema  = enumSchema(DealType);
const DealEntrySchema = enumSchema(DealEntry);

export const DealInfoVOSchema = Type.Object({
  ticket:     Type.Number(),
  userId:     Type.String(),
  brokerId:   Type.Optional(Type.String()),
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
  comment:     Type.String(),
  reason:      Type.Optional(enumSchema(DealReason)),
  canonicalId: Type.Optional(Type.String()),
});
export type DealInfoVO = Static<typeof DealInfoVOSchema>;

export const DealInfoVOFactory = {
  make(overrides: Partial<DealInfoVO> & Pick<DealInfoVO, 'userId' | 'symbol'>): DealInfoVO {
    const defaults: DealInfoVO = {
      ticket:     0,
      userId:     overrides.userId,
      brokerId:   '',
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
    public readonly brokerId:   string,
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
    public readonly reason?:    DealReason,
    public readonly canonicalId?: CanonicalId,
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

  /** Gross profit plus commission and swap (both are signed — commissions and swaps are stored as negative costs). */
  netProfit(): number { return this.profit + this.commission + this.swap; }

  isProfitable(): boolean { return this.netProfit() > 0; }

  // ── Reason predicates ─────────────────────────────────────
  /** True when this deal was closed by a stop-loss trigger. */
  isClosedBySL(): boolean { return this.reason === DealReason.SL; }
  /** True when this deal was closed by a take-profit trigger. */
  isClosedByTP(): boolean { return this.reason === DealReason.TP; }
  /** True when this deal was triggered by a stop-out. */
  isStopOut():    boolean { return this.reason === DealReason.SO; }
  /** True when this deal was placed by an EA/script. */
  isExpert():     boolean { return this.reason === DealReason.Expert; }

  // ── Conversion ───────────────────────────────────────────

  /** Construct a Deal from a serialized VO. */
  static fromVO(vo: DealInfoVO): Deal {
    return new Deal(
      vo.ticket,
      vo.userId,
      vo.brokerId ?? '',
      vo.order,
      vo.positionId,
      vo.symbol,
      vo.type,
      vo.entry,
      vo.volume,
      vo.price,
      vo.commission,
      vo.swap,
      vo.profit,
      new Date(vo.time),
      vo.comment,
      vo.reason,
      vo.canonicalId as CanonicalId | undefined,
    );
  }

  /** Serialize back to a VO for transport or persistence. */
  toVO(): DealInfoVO {
    return {
      ticket:     this.ticket,
      userId:     this.userId,
      brokerId:   this.brokerId,
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
      ...(this.reason    !== undefined ? { reason:      this.reason      } : {}),
      ...(this.canonicalId !== undefined ? { canonicalId: this.canonicalId } : {}),
    };
  }
}
