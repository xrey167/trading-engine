import { Type, type TSchema } from '@sinclair/typebox';

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

export const OpenBBOmniTextSchema = Type.Object({
  type:    Type.Literal('text'),
  content: Type.String(),
});

export const OpenBBOmniTableSchema = Type.Object({
  type:    Type.Literal('table'),
  content: Type.Array(Type.Record(Type.String(), Type.Unknown())),
});

export const OpenBBOmniChartSchema = Type.Object({
  type:    Type.Literal('chart'),
  content: Type.Object({
    data:      Type.Array(Type.Record(Type.String(), Type.Unknown())),
    chartType: Type.Optional(Type.String()),
    xKey:      Type.Optional(Type.String()),
    yKey:      Type.Optional(Type.String()),
  }),
});

export const OpenBBOmniContentSchema = Type.Union([
  OpenBBOmniTextSchema,
  OpenBBOmniTableSchema,
  OpenBBOmniChartSchema,
]);

// ─────────────────────────────────────────────────────────────
// SSRM (Server-Side Row Model) pagination
// ─────────────────────────────────────────────────────────────

export const SSRMQuerySchema = Type.Object({
  startRow:    Type.Optional(Type.Integer({ minimum: 0 })),
  endRow:      Type.Optional(Type.Integer({ minimum: 0 })),
  sortModel:   Type.Optional(Type.String()),
  filterModel: Type.Optional(Type.String()),
});

export const SSRMResponseSchema = <T extends TSchema>(itemSchema: T) =>
  Type.Object({
    rows:    Type.Array(itemSchema),
    lastRow: Type.Integer(),
  });

export const OpenBBOrderEventRowSchema = Type.Object({
  id:         Type.Integer(),
  orderId:    Type.Integer(),
  action:     Type.String(),
  orderType:  Type.String(),
  source:     Type.Union([Type.String(), Type.Null()]),
  symbol:     Type.String(),
  direction:  Type.String(),
  lots:       Type.Number(),
  price:      Type.Number(),
  limitPrice: Type.Union([Type.Number(), Type.Null()]),
  timestamp:  Type.String({ format: 'date-time' }),
  createdAt:  Type.String({ format: 'date-time' }),
});
