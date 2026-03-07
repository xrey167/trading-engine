import { Type, type Static } from '@sinclair/typebox';
import { AtrMethodSchema } from '../shared/schemas/common.js';

export const PutEngineConfigBodySchema = Type.Object({
  removeOrdersOnFlat: Type.Optional(Type.Boolean()),
});
export type PutEngineConfigBody = Static<typeof PutEngineConfigBodySchema>;

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
