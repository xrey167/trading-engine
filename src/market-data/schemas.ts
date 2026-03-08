import { Type, type Static } from '@sinclair/typebox';
import { OHLCSchema } from '../shared/schemas/common.js';

export const PostBarsBodySchema = Type.Object({
  bar:  OHLCSchema,
  bars: Type.Array(OHLCSchema),
});
export type PostBarsBody = Static<typeof PostBarsBodySchema>;

export const PostTickBodySchema = Type.Object({
  bid:  Type.Number({ exclusiveMinimum: 0, description: 'Current bid price' }),
  ask:  Type.Number({ exclusiveMinimum: 0, description: 'Current ask price' }),
  time: Type.Optional(Type.String({ format: 'date-time', description: 'Tick timestamp ISO 8601; defaults to now' })),
});
export type PostTickBody = Static<typeof PostTickBodySchema>;
