import { Type, type Static } from '@sinclair/typebox';

export const PositionType = { BUY: 'BUY', SELL: 'SELL' } as const;
export type PositionType = (typeof PositionType)[keyof typeof PositionType];

export const PositionInfoVOSchema = Type.Object({
  ticket:         Type.Number(),
  userId:         Type.String(),
  symbol:         Type.String(),
  type:           Type.Union([Type.Literal('BUY'), Type.Literal('SELL')]),
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
  reason:         Type.Number(),
});
export type PositionInfoVO = Static<typeof PositionInfoVOSchema>;

export const PositionVOFactory = {
  make(overrides: Partial<PositionInfoVO> & Pick<PositionInfoVO, 'userId' | 'symbol'>): PositionInfoVO {
    const defaults: PositionInfoVO = {
      ticket:         0,
      userId:         overrides.userId,
      symbol:         overrides.symbol,
      type:           'BUY',
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
