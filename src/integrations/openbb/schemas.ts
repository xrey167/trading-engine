import { Type } from '@sinclair/typebox';

export const OpenBBPositionRowSchema = Type.Object({
  side:      Type.Union([Type.Literal('LONG'), Type.Literal('SHORT')]),
  size:      Type.Number(),
  openPrice: Type.Union([Type.Number(), Type.Null()]),
  sl:        Type.Union([Type.Number(), Type.Null()]),
  tp:        Type.Union([Type.Number(), Type.Null()]),
  pl:        Type.Number(),
  status:    Type.Union([Type.Literal('OPEN'), Type.Literal('FLAT')]),
});

export const OpenBBMetricSchema = Type.Object({
  value: Type.Number(),
  label: Type.String(),
  delta: Type.Number(),
});

export const OpenBBDealRowSchema = Type.Object({
  ticket:     Type.Number(),
  symbol:     Type.String(),
  type:       Type.String(),
  volume:     Type.Number(),
  price:      Type.Number(),
  profit:     Type.Number(),
  swap:       Type.Number(),
  commission: Type.Number(),
  time:       Type.String({ format: 'date-time' }),
});

export const OpenBBOmniContentSchema = Type.Object({
  content: Type.String(),
  type:    Type.String(),
});
