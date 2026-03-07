import { Type, type Static } from '@sinclair/typebox';

export const ServiceStatusSchema = Type.Union([
  Type.Literal('STOPPED'),
  Type.Literal('STARTING'),
  Type.Literal('RUNNING'),
  Type.Literal('DEGRADED'),
  Type.Literal('STOPPING'),
  Type.Literal('ERROR'),
]);

export const ServiceKindSchema = Type.Union([
  Type.Literal('BROKER'),
  Type.Literal('DATA_PROVIDER'),
  Type.Literal('STRATEGY'),
  Type.Literal('SCREENER'),
  Type.Literal('ORDER_MANAGER'),
  Type.Literal('RISK_MANAGER'),
  Type.Literal('EXECUTION_SAGA'),
]);

export const ServiceSummarySchema = Type.Object({
  id:     Type.String(),
  kind:   ServiceKindSchema,
  name:   Type.String(),
  status: ServiceStatusSchema,
});
export type ServiceSummary = Static<typeof ServiceSummarySchema>;

export const ServiceHealthSchema = Type.Object({
  status:        ServiceStatusSchema,
  lastCheckedAt: Type.Union([Type.String({ format: 'date-time' }), Type.Null()]),
  error:         Type.Union([Type.String(), Type.Null()]),
  metadata:      Type.Record(Type.String(), Type.Unknown()),
});

export const ServiceDetailSchema = Type.Object({
  id:     Type.String(),
  kind:   ServiceKindSchema,
  name:   Type.String(),
  health: ServiceHealthSchema,
});

export const AggregateHealthSchema = Type.Object({
  total:    Type.Number(),
  running:  Type.Number(),
  stopped:  Type.Number(),
  error:    Type.Number(),
  degraded: Type.Number(),
  services: Type.Array(Type.Object({
    id:     Type.String(),
    status: ServiceStatusSchema,
    error:  Type.Union([Type.String(), Type.Null()]),
  })),
});

export const ServiceIdParamsSchema = Type.Object({
  id: Type.String(),
});
export type ServiceIdParams = Static<typeof ServiceIdParamsSchema>;
