import { Type, type Static } from '@sinclair/typebox';
import { OrderEntryType } from '../domain/order/order.js';
import { BarBase, OrderAttr, LimitConfirm } from '../domain/engine-enums.js';

// ─────────────────────────────────────────────────────────────
// Enum literal unions  (as const maps → TypeBox literals)
// ─────────────────────────────────────────────────────────────

/** Build a TypeBox union from an `as const` enum map. Replaces the verbose
 *  `Type.Union(Object.values(Enum).map(v => Type.Literal(v)))` pattern. */
export function enumSchema<V extends string | number>(enumObj: Record<string, V>) {
  return Type.Union(Object.values(enumObj).map(v => Type.Literal(v)));
}

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

export const BarsAtrModeSchema = Type.Union([
  Type.Literal(0),   // Normal
  Type.Literal(1),   // Bullish
  Type.Literal(-1),  // Bearish
]);

export const BarBaseSchema       = enumSchema(BarBase);
export const OrderAttrSchema     = enumSchema(OrderAttr);
export const LimitConfirmSchema  = enumSchema(LimitConfirm);
export const OrderEntryTypeSchema = enumSchema(OrderEntryType);

// ─────────────────────────────────────────────────────────────
// OHLC / bar body
// ─────────────────────────────────────────────────────────────

export const OHLCSchema = Type.Object({
  open:   Type.Number({ minimum: 0 }),
  high:   Type.Number({ minimum: 0 }),
  low:    Type.Number({ minimum: 0 }),
  close:  Type.Number({ minimum: 0 }),
  time:   Type.String({ format: 'date-time' }),
  volume: Type.Optional(Type.Number({ minimum: 0 })),
});
export type OHLCBody = Static<typeof OHLCSchema>;

// ─────────────────────────────────────────────────────────────
// Trail config / state
// ─────────────────────────────────────────────────────────────

export const TrailConfigSchema = Type.Object({
  mode:        TrailModeSchema,
  distancePts: Type.Number({ minimum: 0 }),
  periods:     Type.Number({ minimum: 0 }),
});

export const TrailStateSchema = Type.Object({
  active: Type.Boolean(),
  plhRef: Type.Number(),
});

// ─────────────────────────────────────────────────────────────
// Execution report
// ─────────────────────────────────────────────────────────────

export const ExecutionReportSchema = Type.Object({
  price: Type.Number({ minimum: 0 }),
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
