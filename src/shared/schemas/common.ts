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
  Type.Literal('LIMIT_CONFIRM_NONE'),
  Type.Literal('LIMIT_CONFIRM_WICK'),
  Type.Literal('LIMIT_CONFIRM_WICKBREAK'),
  Type.Literal('LIMIT_CONFIRM_WICKCOLOR'),
]);

export const OrderEntryTypeSchema = Type.Union([
  Type.Literal('BUY_MARKET'),
  Type.Literal('SELL_MARKET'),
  Type.Literal('BUY_LIMIT'),
  Type.Literal('BUY_STOP'),
  Type.Literal('SELL_LIMIT'),
  Type.Literal('SELL_STOP'),
  Type.Literal('BUY_MIT'),
  Type.Literal('SELL_MIT'),
  Type.Literal('BUY_STOP_LIMIT'),
  Type.Literal('SELL_STOP_LIMIT'),
  Type.Literal('BUY_MTO'),
  Type.Literal('SELL_MTO'),
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
// Common response schemas
// ─────────────────────────────────────────────────────────────

export const ErrorResponseSchema = Type.Object({
  error: Type.String(),
});

export const OkResponseSchema = Type.Object({
  ok: Type.Boolean(),
});

// ─────────────────────────────────────────────────────────────
// Account
// ─────────────────────────────────────────────────────────────

export const AccountSchema = Type.Object({
  equity:  Type.Number(),
  balance: Type.Number(),
});
