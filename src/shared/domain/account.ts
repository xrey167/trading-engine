import { Type, type Static } from '@sinclair/typebox';

export const AccountType = { Demo: 0, Contest: 1, Real: 2 } as const;
export type AccountType = (typeof AccountType)[keyof typeof AccountType];

export const AccountTradeMode = {
  SingleHedge:   'SINGLE_HEDGE',   // single position per symbol, hedging allowed
  SingleNoHedge: 'SINGLE_NOHEDGE', // single position per symbol, no hedging (netting)
  Future:        'FUTURE',         // futures-style: both sides allowed, margined separately
  Hedge:         'HEDGE',          // full hedge: independent long & short tickets per symbol
} as const;
export type AccountTradeMode = (typeof AccountTradeMode)[keyof typeof AccountTradeMode];

export const AccountTradeModeSchema = Type.Union([
  Type.Literal('SINGLE_HEDGE'),
  Type.Literal('SINGLE_NOHEDGE'),
  Type.Literal('FUTURE'),
  Type.Literal('HEDGE'),
]);

export const AccountMarginMode = { Retail: 0, Exchange: 2 } as const;
export type AccountMarginMode = (typeof AccountMarginMode)[keyof typeof AccountMarginMode];

export const AccountInfoVOSchema = Type.Object({
  login:                 Type.Number(),
  tradeMode:             AccountTradeModeSchema,
  leverage:              Type.Number(),
  marginMode:            Type.Union([Type.Literal(0), Type.Literal(2)]),
  stopOutMode:           Type.Number(),
  marginSoMode:          Type.Number(),
  tradeAllowed:          Type.Boolean(),
  tradeExpertAllowed:    Type.Boolean(),
  limitOrders:           Type.Number(),
  balance:               Type.Number(),
  credit:                Type.Number(),
  profit:                Type.Number(),
  equity:                Type.Number(),
  margin:                Type.Number(),
  freeMargin:            Type.Number(),
  marginLevel:           Type.Number(),
  marginInitial:         Type.Number(),
  marginMaintenance:     Type.Number(),
  assets:                Type.Number(),
  liabilities:           Type.Number(),
  commission:            Type.Number(),
  currency:              Type.String(),
  name:                  Type.String(),
  server:                Type.String(),
  company:               Type.String(),
});
export type AccountInfoVO = Static<typeof AccountInfoVOSchema>;

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
