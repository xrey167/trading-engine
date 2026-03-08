import { Type, type Static } from '@sinclair/typebox';

export const AuditQuerySchema = Type.Object({
  type: Type.Optional(Type.String({ description: 'Filter by event type (e.g. signal, order)' })),
  since: Type.Optional(Type.String({ format: 'date-time', description: 'ISO timestamp lower bound' })),
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 500, description: 'Max entries to return (from most recent)' })),
});
export type AuditQuery = Static<typeof AuditQuerySchema>;

export const AuditEntrySchema = Type.Object({
  id: Type.Integer(),
  instanceId: Type.String(),
  type: Type.String(),
  payload: Type.Unknown(),
  timestamp: Type.String({ format: 'date-time' }),
  receivedAt: Type.String({ format: 'date-time' }),
});

export const AuditResponseSchema = Type.Object({
  total: Type.Integer(),
  events: Type.Array(AuditEntrySchema),
});
