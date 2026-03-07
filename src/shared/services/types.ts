

export const ServiceStatus = {
  Stopped:  'STOPPED',
  Starting: 'STARTING',
  Running:  'RUNNING',
  Degraded: 'DEGRADED',
  Stopping: 'STOPPING',
  Error:    'ERROR',
} as const;
export type ServiceStatus = (typeof ServiceStatus)[keyof typeof ServiceStatus];

export const ServiceKind = {
  Broker:       'BROKER',
  DataProvider: 'DATA_PROVIDER',
  Strategy:     'STRATEGY',
  Screener:     'SCREENER',
  OrderManager: 'ORDER_MANAGER',
  RiskManager:  'RISK_MANAGER',
} as const;
export type ServiceKind = (typeof ServiceKind)[keyof typeof ServiceKind];

export interface ServiceHealth {
  readonly status: ServiceStatus;
  readonly lastCheckedAt: string | null;
  readonly error: string | null;
  readonly metadata: Record<string, unknown>;
}

export interface IService {
  readonly id: string;
  readonly kind: ServiceKind;
  readonly name: string;
  start(): Promise<void>;
  stop(): Promise<void>;
  health(): ServiceHealth;
}
