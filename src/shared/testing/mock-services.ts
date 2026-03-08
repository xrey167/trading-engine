import { ServiceStatus, type ServiceKind, type IService, type ServiceHealth } from '../services/types.js';
import type { SignalEvent, OrderEvent, RiskEvent, ScreenerEvent } from '../services/event-map.js';

export class MockService implements IService {
  private _status: ServiceStatus = ServiceStatus.Stopped;
  startCalls = 0;
  stopCalls = 0;

  constructor(
    readonly id: string,
    readonly kind: ServiceKind,
    readonly name: string = id,
  ) {}

  async start(): Promise<void> {
    this.startCalls++;
    this._status = ServiceStatus.Running;
  }

  async stop(): Promise<void> {
    this.stopCalls++;
    this._status = ServiceStatus.Stopped;
  }

  health(): ServiceHealth {
    return {
      status: this._status,
      lastCheckedAt: this._status === ServiceStatus.Running ? new Date().toISOString() : null,
      error: null,
      metadata: {},
    };
  }
}

export class FailingService extends MockService {
  async start(): Promise<void> {
    throw new Error('start failed');
  }
}

export function makeMockService(id: string, kind: ServiceKind): MockService {
  return new MockService(id, kind);
}

export function makeSignalEvent(overrides: Partial<SignalEvent> = {}): SignalEvent {
  return {
    serviceId: 'strategy:test',
    symbol: 'EURUSD',
    timeframe: 'H1',
    action: 'BUY',
    confidence: 0.8,
    metadata: {},
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

export function makeOrderEvent(overrides: Partial<OrderEvent> = {}): OrderEvent {
  return {
    action: 'FILLED',
    orderId: 0,
    orderType: 'UNKNOWN',
    brokerId: 'broker:paper:primary',
    symbol: 'EURUSD',
    direction: 'BUY',
    lots: 0.1,
    price: 1.1000,
    metadata: {},
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

export function makeRiskEvent(overrides: Partial<RiskEvent> = {}): RiskEvent {
  return {
    action: 'APPROVED',
    symbol: 'EURUSD',
    reason: '',
    metadata: {},
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

export function makeScreenerEvent(overrides: Partial<ScreenerEvent> = {}): ScreenerEvent {
  return {
    serviceId: 'screener:test',
    matchedSymbols: ['EURUSD'],
    criteria: 'volume-breakout',
    metadata: {},
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}
