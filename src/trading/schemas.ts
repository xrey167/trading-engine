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
  size:          Type.Number({ exclusiveMinimum: 0 }),
  openPrice:     Type.Number({ minimum: 0 }),
  openTime:      Type.Union([Type.String({ format: 'date-time' }), Type.Null()]),
  sl:            Type.Number({ minimum: 0 }),
  tp:            Type.Number({ minimum: 0 }),
  slOffsetPts:   Type.Number({ minimum: 0 }),
  tpOffsetPts:   Type.Number({ minimum: 0 }),
  slActive:      Type.Boolean(),
  tpActive:      Type.Boolean(),
  trailCfg:      TrailConfigSchema,
  trailState:    TrailStateSchema,
  trailActive:   Type.Boolean(),
  trailBeginPts: Type.Number({ minimum: 0 }),
  beActive:      Type.Boolean(),
  beAddPts:      Type.Number({ minimum: 0 }),
});

// ─────────────────────────────────────────────────────────────
// Pending order
// ─────────────────────────────────────────────────────────────

export const PendingOrderSchema = Type.Object({
  id:         Type.String(),
  type:       OrderEntryTypeSchema,
  side:       SideSchema,
  price:      Type.Number({ minimum: 0 }),
  size:       Type.Number({ exclusiveMinimum: 0 }),
  time:       Type.String({ format: 'date-time' }),
  limitPrice: Type.Optional(Type.Number({ minimum: 0 })),
});

// ─────────────────────────────────────────────────────────────
// Route body schemas
// ─────────────────────────────────────────────────────────────

export const PostOrderBodySchema = Type.Object({
  type:       OrderEntryTypeSchema,
  price:      Type.Optional(Type.Number({ minimum: 0 })),  // not required for BUY_MARKET / SELL_MARKET / MTO trail types
  limitPrice: Type.Optional(Type.Number({ minimum: 0 })),  // BUY_STOP_LIMIT / SELL_STOP_LIMIT only
  size:       Type.Optional(Type.Number({ exclusiveMinimum: 0 })),
  attributes: Type.Optional(Type.Object({
    oco:          Type.Optional(Type.Boolean()),
    co:           Type.Optional(Type.Boolean()),
    cs:           Type.Optional(Type.Boolean()),
    rev:          Type.Optional(Type.Boolean()),
    bracketSL:    Type.Optional(Type.Number({ minimum: 0 })),
    bracketTP:    Type.Optional(Type.Number({ minimum: 0 })),
    pullbackPts:  Type.Optional(Type.Number({ minimum: 0 })),
    limitConfirm: Type.Optional(LimitConfirmSchema),
  })),
  trailEntry: Type.Optional(Type.Object({
    mode:        TrailModeSchema,
    distancePts: Type.Number({ minimum: 0 }),
    periods:     Type.Optional(Type.Number({ minimum: 0 })),
  })),
});
export type PostOrderBody = Static<typeof PostOrderBodySchema>;

export const PatchOrderBodySchema = Type.Object({
  price: Type.Number({ minimum: 0 }),
});
export type PatchOrderBody = Static<typeof PatchOrderBodySchema>;

export const PutPositionSlTpBodySchema = Type.Object({
  sl:              Type.Optional(Type.Number({ minimum: 0 })),
  tp:              Type.Optional(Type.Number({ minimum: 0 })),
  slActive:        Type.Optional(Type.Boolean()),
  tpActive:        Type.Optional(Type.Boolean()),
  trailBeginPts:   Type.Optional(Type.Number({ minimum: 0 })),
  beActive:        Type.Optional(Type.Boolean()),
  beAddPts:        Type.Optional(Type.Number({ minimum: 0 })),
  slAbsolute:      Type.Optional(Type.Number({ minimum: 0 })),
  tpAbsolute:      Type.Optional(Type.Number({ minimum: 0 })),
  trailMode:       Type.Optional(TrailModeSchema),
  trailDistancePts:Type.Optional(Type.Number({ minimum: 0 })),
  trailPeriods:    Type.Optional(Type.Number({ minimum: 0 })),
  trailActive:     Type.Optional(Type.Boolean()),
});
export type PutPositionSlTpBody = Static<typeof PutPositionSlTpBodySchema>;

export const PostMarketOrderBodySchema = Type.Object({
  size: Type.Optional(Type.Number({ exclusiveMinimum: 0 })),
});
export type PostMarketOrderBody = Static<typeof PostMarketOrderBodySchema>;

export const TrailEntrySchema = Type.Object({
  mode:        TrailModeSchema,
  distancePts: Type.Number({ minimum: 0 }),
  periods:     Type.Optional(Type.Number({ minimum: 0 })),
});

export const PostBracketBodySchema = Type.Object({
  entryType:  Type.Union([
    Type.Literal('BUY_LIMIT'),
    Type.Literal('BUY_STOP'),
    Type.Literal('SELL_LIMIT'),
    Type.Literal('SELL_STOP'),
  ]),
  entryPrice: Type.Number({ minimum: 0 }),
  slPts:      Type.Number({ minimum: 0 }),
  tpPts:      Type.Number({ minimum: 0 }),
  size:       Type.Optional(Type.Number({ exclusiveMinimum: 0 })),
});
export type PostBracketBody = Static<typeof PostBracketBodySchema>;

// ─────────────────────────────────────────────────────────────
// Scaled orders
// ─────────────────────────────────────────────────────────────

export const PostScaledOrdersBodySchema = Type.Object({
  side:         Type.Union([Type.Literal('long'), Type.Literal('short'), Type.Literal('both')]),
  preset:       Type.String(),
  currentPrice: Type.Number({ minimum: 0 }),
  dailyBars:    Type.Optional(Type.Array(OHLCSchema)),
});
export type PostScaledOrdersBody = Static<typeof PostScaledOrdersBodySchema>;

export const ScaledOrderResultSchema = Type.Object({
  orderIds: Type.Array(Type.String()),
  baseDist: Type.Number({ minimum: 0 }),
  slDist:   Type.Number({ minimum: 0 }),
});
