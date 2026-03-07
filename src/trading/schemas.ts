import { Type, type Static } from '@sinclair/typebox';
import {
  SideSchema,
  TrailModeSchema,
  LimitConfirmSchema,
  OrderEntryTypeSchema,
  OHLCSchema,
  TrailConfigSchema,
  TrailStateSchema,
} from '../shared/schemas/common.js';

// ─────────────────────────────────────────────────────────────
// Position slot (serialised view)
// ─────────────────────────────────────────────────────────────

export const PositionSlotSchema = Type.Object({
  side:          SideSchema,
  size:          Type.Number(),
  openPrice:     Type.Number(),
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

export const PostOrderBodySchema = Type.Object({
  type:       OrderEntryTypeSchema,
  price:      Type.Optional(Type.Number()),  // not required for BUY_MARKET / SELL_MARKET / MTO trail types
  limitPrice: Type.Optional(Type.Number()),  // BUY_STOP_LIMIT / SELL_STOP_LIMIT only
  size:       Type.Optional(Type.Number()),
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
  trailEntry: Type.Optional(Type.Object({
    mode:        TrailModeSchema,
    distancePts: Type.Number(),
    periods:     Type.Optional(Type.Number()),
  })),
});
export type PostOrderBody = Static<typeof PostOrderBodySchema>;

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
  slAbsolute:      Type.Optional(Type.Number()),
  tpAbsolute:      Type.Optional(Type.Number()),
  trailMode:       Type.Optional(TrailModeSchema),
  trailDistancePts:Type.Optional(Type.Number()),
  trailPeriods:    Type.Optional(Type.Number()),
  trailActive:     Type.Optional(Type.Boolean()),
});
export type PutPositionSlTpBody = Static<typeof PutPositionSlTpBodySchema>;

export const PostMarketOrderBodySchema = Type.Object({
  size: Type.Optional(Type.Number()),
});
export type PostMarketOrderBody = Static<typeof PostMarketOrderBodySchema>;

export const TrailEntrySchema = Type.Object({
  mode:        TrailModeSchema,
  distancePts: Type.Number(),
  periods:     Type.Optional(Type.Number()),
});

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
// Scaled orders
// ─────────────────────────────────────────────────────────────

export const PostScaledOrdersBodySchema = Type.Object({
  side:         Type.Union([Type.Literal('long'), Type.Literal('short'), Type.Literal('both')]),
  preset:       Type.String(),
  currentPrice: Type.Number(),
  dailyBars:    Type.Optional(Type.Array(OHLCSchema)),
});
export type PostScaledOrdersBody = Static<typeof PostScaledOrdersBodySchema>;

export const ScaledOrderResultSchema = Type.Object({
  orderIds: Type.Array(Type.String()),
  baseDist: Type.Number(),
  slDist:   Type.Number(),
});
