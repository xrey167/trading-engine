import { Type, type Static } from '@sinclair/typebox';

export const SymbolInfoVOSchema = Type.Object({
  name:             Type.String(),
  description:      Type.String(),
  digits:           Type.Integer(),
  point:            Type.Number(),
  tickSize:         Type.Number(),
  tickValue:        Type.Number(),
  spread:           Type.Integer(),
  spreadFloat:      Type.Boolean(),
  lotsMin:          Type.Number(),
  lotsMax:          Type.Number(),
  lotsStep:         Type.Number(),
  contractSize:     Type.Number(),
  bid:              Type.Number(),
  ask:              Type.Number(),
  currencyBase:     Type.String(),
  currencyProfit:   Type.String(),
  currencyMargin:   Type.String(),
});
export type SymbolInfoVO = Static<typeof SymbolInfoVOSchema>;

export const TickSchema = Type.Object({
  time:   Type.String({ format: 'date-time' }),
  bid:    Type.Number(),
  ask:    Type.Number(),
  last:   Type.Optional(Type.Number()),
  volume: Type.Optional(Type.Number()),
});
export type Tick = Static<typeof TickSchema>;
