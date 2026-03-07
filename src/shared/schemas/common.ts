import { Type, type Static } from '@sinclair/typebox';
import { OrderEntryType } from '../domain/enums.js';

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
  Type.Literal('BASE_HILO'),
  Type.Literal('BASE_OPENCLOSE'),
]);

// Named order attributes — combinable flags that modify fill behaviour.
export const OrderAttrSchema = Type.Union([
  Type.Literal('ORDER_ATTR_OCO'),   // One Cancels Other — fill cancels all other pending orders
  Type.Literal('ORDER_ATTR_CO'),    // Cancel Others on fill — cancel same-side pending orders
  Type.Literal('ORDER_ATTR_CS'),    // Cancel on Side — cancel all orders on same side when filled
  Type.Literal('ORDER_ATTR_REV'),   // Reverse — close current position and open opposite of same size
  Type.Literal('ORDER_ATTR_NET'),   // Net — reduce opposite position by the fill size
  Type.Literal('ORDER_ATTR_SLTP'),  // Transfer SL/TP — copy SL/TP levels to the filled position
  Type.Literal('ORDER_ATTR_ROL'),   // Reverse On Loss — reverse position if closed at a loss
  Type.Literal('ORDER_ATTR_ROP'),   // Reverse On Profit — reverse position if closed at a profit
  Type.Literal('ORDER_ATTR_MIT'),   // Market If Touched — convert to market order when price is touched
  Type.Literal('ORDER_ATTR_FC'),    // Fill or Cancel — cancel order if not filled immediately
]);

export const LimitConfirmSchema = Type.Union([
  Type.Literal('LIMIT_CONFIRM_NONE'),
  Type.Literal('LIMIT_CONFIRM_WICK'),
  Type.Literal('LIMIT_CONFIRM_WICKBREAK'),
  Type.Literal('LIMIT_CONFIRM_WICKCOLOR'),
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
