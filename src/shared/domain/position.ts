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

export const HistoryOrderInfoVOSchema = Type.Object({
  ticket:        Type.Number(),
  userId:        Type.String(),
  symbol:        Type.String(),
  type:          Type.String(),
  state:         Type.String(),
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
