import { Type, type Static } from '@sinclair/typebox';

// ─────────────────────────────────────────────────────────────
// Enum literal unions  (as const maps → TypeBox literals)
// ─────────────────────────────────────────────────────────────

export const SideSchema = Type.Union([
  Type.Literal(0),
  Type.Literal(1),
  Type.Literal(-1),
]);

export const TrailModeSchema = Type.Union([
  Type.Literal(0),
  Type.Literal(1),
  Type.Literal(2),
  Type.Literal(3),
  // 4 intentionally omitted (reserved in original MQL enum)
  Type.Literal(5),
  Type.Literal(6),
  Type.Literal(7),
]);

export const AtrMethodSchema = Type.Union([
  Type.Literal(0),
  Type.Literal(1),
]);

export const LimitConfirmSchema = Type.Union([
  Type.Literal(0),
  Type.Literal(1),
  Type.Literal(2),
  Type.Literal(3),
]);

export const OrderEntryTypeSchema = Type.Union([
  Type.Literal('BUY_LIMIT'),
  Type.Literal('BUY_STOP'),
  Type.Literal('SELL_LIMIT'),
  Type.Literal('SELL_STOP'),
  Type.Literal('BUY_MIT'),
  Type.Literal('SELL_MIT'),
]);

// ─────────────────────────────────────────────────────────────
// OHLC / bar body
// ─────────────────────────────────────────────────────────────

export const OHLCSchema = Type.Object({
  open:   Type.Number(),
  high:   Type.Number(),
  low:    Type.Number(),
  close:  Type.Number(),
  time:   Type.String({ format: 'date-time' }),
  volume: Type.Optional(Type.Number()),
});
export type OHLCBody = Static<typeof OHLCSchema>;

// ─────────────────────────────────────────────────────────────
// Trail config / state
// ─────────────────────────────────────────────────────────────

export const TrailConfigSchema = Type.Object({
  mode:        TrailModeSchema,
  distancePts: Type.Number(),
  periods:     Type.Number(),
});

export const TrailStateSchema = Type.Object({
  active: Type.Boolean(),
  plhRef: Type.Number(),
});

// ─────────────────────────────────────────────────────────────
// Execution report
// ─────────────────────────────────────────────────────────────

export const ExecutionReportSchema = Type.Object({
  price: Type.Number(),
  time:  Type.String({ format: 'date-time' }),
  id:    Type.String(),
});

// ─────────────────────────────────────────────────────────────
// Position slot (serialised view)
// ─────────────────────────────────────────────────────────────

export const PositionSlotSchema = Type.Object({
  side:          SideSchema,
  size:          Type.Number(),
  openPrice:     Type.Number(),
  openTime:      Type.String({ format: 'date-time' }),
  sl:            Type.Number(),
  tp:            Type.Number(),
  slOffsetPts:   Type.Number(),
  tpOffsetPts:   Type.Number(),
  slActive:      Type.Boolean(),
  tpActive:      Type.Boolean(),
  trailCfg:      TrailConfigSchema,
  trailState:    TrailStateSchema,
  trailActive:   Type.Boolean(),
  trailBeginPts: Type.Number(),
  beActive:      Type.Boolean(),
  beAddPts:      Type.Number(),
});

// ─────────────────────────────────────────────────────────────
// Pending order
// ─────────────────────────────────────────────────────────────

export const PendingOrderSchema = Type.Object({
  id:    Type.String(),
  type:  OrderEntryTypeSchema,
  side:  SideSchema,
  price: Type.Number(),
  size:  Type.Number(),
  time:  Type.String({ format: 'date-time' }),
});

// ─────────────────────────────────────────────────────────────
// Route body schemas
// ─────────────────────────────────────────────────────────────

export const PostBarsBodySchema = Type.Object({
  bar:  OHLCSchema,
  bars: Type.Array(OHLCSchema),
});
export type PostBarsBody = Static<typeof PostBarsBodySchema>;

export const PostOrderBodySchema = Type.Object({
  type:  OrderEntryTypeSchema,
  price: Type.Number(),
  size:  Type.Optional(Type.Number()),
  attributes: Type.Optional(Type.Object({
    oco:          Type.Optional(Type.Boolean()),
    co:           Type.Optional(Type.Boolean()),
    cs:           Type.Optional(Type.Boolean()),
    rev:          Type.Optional(Type.Boolean()),
    bracketSL:    Type.Optional(Type.Number()),
    bracketTP:    Type.Optional(Type.Number()),
    pullbackPts:  Type.Optional(Type.Number()),
    limitConfirm: Type.Optional(LimitConfirmSchema),
  })),
});
export type PostOrderBody = Static<typeof PostOrderBodySchema>;

// ─────────────────────────────────────────────────────────────
// Common response schemas
// ─────────────────────────────────────────────────────────────

export const ErrorResponseSchema = Type.Object({
  error: Type.String(),
});

export const OkResponseSchema = Type.Object({
  ok: Type.Boolean(),
});

// ─────────────────────────────────────────────────────────────
// Account, PATCH order, PUT position SL/TP
// ─────────────────────────────────────────────────────────────

export const AccountSchema = Type.Object({
  equity:  Type.Number(),
  balance: Type.Number(),
});

export const PatchOrderBodySchema = Type.Object({
  price: Type.Number(),
});
export type PatchOrderBody = Static<typeof PatchOrderBodySchema>;

export const PutPositionSlTpBodySchema = Type.Object({
  sl:            Type.Optional(Type.Number()),
  tp:            Type.Optional(Type.Number()),
  slActive:      Type.Optional(Type.Boolean()),
  tpActive:      Type.Optional(Type.Boolean()),
  trailBeginPts: Type.Optional(Type.Number()),
  beActive:      Type.Optional(Type.Boolean()),
  beAddPts:      Type.Optional(Type.Number()),
});
export type PutPositionSlTpBody = Static<typeof PutPositionSlTpBodySchema>;
