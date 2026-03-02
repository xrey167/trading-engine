import { Type, type Static } from '@sinclair/typebox';

// ─────────────────────────────────────────────────────────────
// Enum literal unions  (as const maps → TypeBox literals)
// ─────────────────────────────────────────────────────────────

export const SideSchema = Type.Union([
  Type.Literal(0),
  Type.Literal(1),
  Type.Literal(-1),
]);

// TrailMode values: 0=None,1=Points,2=ATR,3=BarHigh/Low,5=HL2,6=Close,7=ATRd
// Value 4 is intentionally omitted — reserved in the original MQL enum and never emitted by the engine.
export const TrailModeSchema = Type.Union([
  Type.Literal(0),
  Type.Literal(1),
  Type.Literal(2),
  Type.Literal(3),
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
  Type.Literal('BUY_LIMIT_TRAIL'),
  Type.Literal('BUY_STOP_TRAIL'),
  Type.Literal('SELL_LIMIT_TRAIL'),
  Type.Literal('SELL_STOP_TRAIL'),
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
  // null when no position is open (size === 0) to avoid epoch artifact
  openTime:      Type.Union([Type.String({ format: 'date-time' }), Type.Null()]),
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
  // Unit 3 — trailing entry config (required when type is *_TRAIL)
  trailEntry: Type.Optional(Type.Object({
    mode:        TrailModeSchema,
    distancePts: Type.Number(),
    periods:     Type.Optional(Type.Number()),
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
  sl:              Type.Optional(Type.Number()),
  tp:              Type.Optional(Type.Number()),
  slActive:        Type.Optional(Type.Boolean()),
  tpActive:        Type.Optional(Type.Boolean()),
  trailBeginPts:   Type.Optional(Type.Number()),
  beActive:        Type.Optional(Type.Boolean()),
  beAddPts:        Type.Optional(Type.Number()),
  // Unit 5 — absolute SL/TP + trail mode/distance/active
  slAbsolute:      Type.Optional(Type.Number()),
  tpAbsolute:      Type.Optional(Type.Number()),
  trailMode:       Type.Optional(TrailModeSchema),
  trailDistancePts:Type.Optional(Type.Number()),
  trailPeriods:    Type.Optional(Type.Number()),
  trailActive:     Type.Optional(Type.Boolean()),
});
export type PutPositionSlTpBody = Static<typeof PutPositionSlTpBodySchema>;

// ─────────────────────────────────────────────────────────────
// Unit 1 — Market orders + hedge
// ─────────────────────────────────────────────────────────────

export const PostMarketOrderBodySchema = Type.Object({
  size: Type.Optional(Type.Number()),
});
export type PostMarketOrderBody = Static<typeof PostMarketOrderBodySchema>;

// ─────────────────────────────────────────────────────────────
// Unit 3 — Trailing entry orders (trail config on POST /orders)
// ─────────────────────────────────────────────────────────────

export const TrailEntrySchema = Type.Object({
  mode:        TrailModeSchema,
  distancePts: Type.Number(),
  periods:     Type.Optional(Type.Number()),
});

// ─────────────────────────────────────────────────────────────
// Unit 4 — Bracket order route
// ─────────────────────────────────────────────────────────────

export const PostBracketBodySchema = Type.Object({
  entryType:  Type.Union([
    Type.Literal('BUY_LIMIT'),
    Type.Literal('BUY_STOP'),
    Type.Literal('SELL_LIMIT'),
    Type.Literal('SELL_STOP'),
  ]),
  entryPrice: Type.Number(),
  slPts:      Type.Number(),
  tpPts:      Type.Number(),
  size:       Type.Optional(Type.Number()),
});
export type PostBracketBody = Static<typeof PostBracketBodySchema>;

// ─────────────────────────────────────────────────────────────
// Unit 6 — Engine config
// ─────────────────────────────────────────────────────────────

export const PutEngineConfigBodySchema = Type.Object({
  removeOrdersOnFlat: Type.Optional(Type.Boolean()),
});
export type PutEngineConfigBody = Static<typeof PutEngineConfigBodySchema>;

// ─────────────────────────────────────────────────────────────
// Unit 7 — ScaledOrderEngine REST
// ─────────────────────────────────────────────────────────────

export const PostScaledOrdersBodySchema = Type.Object({
  side:         Type.Union([Type.Literal('long'), Type.Literal('short'), Type.Literal('both')]),
  preset:       Type.String(),
  currentPrice: Type.Number(),
  /** Optional daily bars for "ATR Nd" mode presets */
  dailyBars:    Type.Optional(Type.Array(OHLCSchema)),
});
export type PostScaledOrdersBody = Static<typeof PostScaledOrdersBodySchema>;

export const ScaledOrderResultSchema = Type.Object({
  orderIds: Type.Array(Type.String()),
  baseDist: Type.Number(),
  slDist:   Type.Number(),
});

// ─────────────────────────────────────────────────────────────
// Unit 8 — AtrModule config
// ─────────────────────────────────────────────────────────────

export const PutAtrConfigBodySchema = Type.Object({
  period:               Type.Optional(Type.Integer({ minimum: 1 })),
  method:               Type.Optional(AtrMethodSchema),
  shift:                Type.Optional(Type.Integer({ minimum: 0 })),
  slMultiplier:         Type.Optional(Type.Number({ minimum: 0 })),
  tpMultiplier:         Type.Optional(Type.Number({ minimum: 0 })),
  trailBeginMultiplier: Type.Optional(Type.Number({ minimum: 0 })),
  trailDistMultiplier:  Type.Optional(Type.Number({ minimum: 0 })),
  onlyWhenFlat:         Type.Optional(Type.Boolean()),
});
export type PutAtrConfigBody = Static<typeof PutAtrConfigBodySchema>;
