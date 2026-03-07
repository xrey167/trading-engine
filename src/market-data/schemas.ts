import { Type, type Static } from '@sinclair/typebox';
import { OHLCSchema } from '../shared/schemas/common.js';

export const PostBarsBodySchema = Type.Object({
  bar:  OHLCSchema,
  bars: Type.Array(OHLCSchema),
});
export type PostBarsBody = Static<typeof PostBarsBodySchema>;
