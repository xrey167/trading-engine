import { Type, type Static } from '@sinclair/typebox';
import { OrderEntryType } from '../domain/order/order.js';
import { BarBase, OrderAttr, LimitConfirm } from '../domain/engine-enums.js';

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

export const BarsAtrModeSchema = Type.Union([
  Type.Literal(0),   // Normal
  Type.Literal(1),   // Bullish
  Type.Literal(-1),  // Bearish
]);

export const BarBaseSchema = Type.Union([
  Type.Literal(BarBase.HiLo),
  Type.Literal(BarBase.OpenClose),
]);

// Named order attributes — combinable flags that modify fill behaviour.
export const OrderAttrSchema = Type.Union([
  Type.Literal(OrderAttr.OCO),
  Type.Literal(OrderAttr.CO),
  Type.Literal(OrderAttr.CS),
  Type.Literal(OrderAttr.REV),
  Type.Literal(OrderAttr.NET),
  Type.Literal(OrderAttr.SLTP),
  Type.Literal(OrderAttr.ROL),
  Type.Literal(OrderAttr.ROP),
  Type.Literal(OrderAttr.MIT),
  Type.Literal(OrderAttr.FC),
]);

export const LimitConfirmSchema = Type.Union([
  Type.Literal(LimitConfirm.None),
  Type.Literal(LimitConfirm.Wick),
  Type.Literal(LimitConfirm.WickBreak),
  Type.Literal(LimitConfirm.WickColor),
]);

export const OrderEntryTypeSchema = Type.Union([
  Type.Literal(OrderEntryType.BuyMarket),
  Type.Literal(OrderEntryType.SellMarket),
  Type.Literal(OrderEntryType.BuyLimit),
  Type.Literal(OrderEntryType.BuyStop),
  Type.Literal(OrderEntryType.SellLimit),
  Type.Literal(OrderEntryType.SellStop),
  Type.Literal(OrderEntryType.BuyMIT),
  Type.Literal(OrderEntryType.SellMIT),
  Type.Literal(OrderEntryType.BuyStopLimit),
  Type.Literal(OrderEntryType.SellStopLimit),
  Type.Literal(OrderEntryType.BuyMTO),
  Type.Literal(OrderEntryType.SellMTO),
  Type.Literal(OrderEntryType.BuyLimitTrail),
  Type.Literal(OrderEntryType.BuyStopTrail),
  Type.Literal(OrderEntryType.SellLimitTrail),
  Type.Literal(OrderEntryType.SellStopTrail),
]);

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
