import { Type, type Static } from '@sinclair/typebox';

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
