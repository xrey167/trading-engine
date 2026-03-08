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

export const DealInfoVOFactory = {
  make(overrides: Partial<DealInfoVO> & Pick<DealInfoVO, 'userId' | 'symbol'>): DealInfoVO {
    const defaults: DealInfoVO = {
      ticket:     0,
      userId:     overrides.userId,
      symbol:     overrides.symbol,
      type:       'BUY',
      entry:      'IN',
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
