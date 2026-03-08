import { Type, type Static } from '@sinclair/typebox';
import { DealType, DealEntry } from '../history/history.js';

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
