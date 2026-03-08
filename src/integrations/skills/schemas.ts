import { Type, type Static } from '@sinclair/typebox';

export const SkillListItemSchema = Type.Object({
  path:        Type.String(),
  command:     Type.String(),
  category:    Type.String(),
  description: Type.String(),
});

export const SkillRunSchema = Type.Object({
  prompt: Type.Optional(Type.String()),
  sessionId: Type.Optional(Type.String({ format: 'uuid' })),
  stream: Type.Optional(Type.Boolean()),
  maxTurns: Type.Optional(Type.Number({ minimum: 1, maximum: 100 })),
  maxBudgetUsd: Type.Optional(Type.Number({ minimum: 0.01, maximum: 10 })),
}, { additionalProperties: false });
export type SkillRunBody = Static<typeof SkillRunSchema>;
