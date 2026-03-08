import { Type, type Static } from '@sinclair/typebox';

export const DealInfoVOSchema = Type.Object({
  ticket:     Type.Number(),
  userId:     Type.String(),
  order:      Type.Number(),
  positionId: Type.Number(),
  symbol:     Type.String(),
  type:       Type.String(),
  entry:      Type.String(),
  volume:     Type.Number(),
  price:      Type.Number(),
  commission: Type.Number(),
  swap:       Type.Number(),
  profit:     Type.Number(),
  time:       Type.String({ format: 'date-time' }),
  comment:    Type.String(),
});
export type DealInfoVO = Static<typeof DealInfoVOSchema>;
