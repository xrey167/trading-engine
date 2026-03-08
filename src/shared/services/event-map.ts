import type { EngineEventMap } from '../event-bus.js';
import type { OHLCBody } from '../schemas/common.js';
import type { ServiceStatus } from './types.js';

export interface SignalEvent {
  readonly serviceId: string;
  readonly symbol: string;
  readonly timeframe: string;
  readonly action: 'BUY' | 'SELL' | 'HOLD';
  readonly confidence: number;
  readonly metadata: Record<string, unknown>;
  readonly timestamp: string;
}

export interface ScreenerEvent {
  readonly serviceId: string;
  readonly matchedSymbols: string[];
  readonly criteria: string;
  readonly metadata: Record<string, unknown>;
  readonly timestamp: string;
}

export interface OrderEvent {
  readonly action: 'PLACED' | 'FILLED' | 'REJECTED' | 'CANCELLED' | 'EXPIRED' | 'MODIFIED';
  readonly orderId: number;
  readonly orderType: string;
  readonly brokerId: string;
  readonly symbol: string;
  readonly direction: 'BUY' | 'SELL';
  readonly lots: number;
  readonly price: number;
  readonly source?: 'http' | 'broker' | 'synthetic';
  readonly limitPrice?: number;
  readonly metadata: Record<string, unknown>;
  readonly timestamp: string;
}

export interface RiskEvent {
  readonly action: 'APPROVED' | 'REJECTED' | 'ALERT' | 'LIMIT_BREACHED';
  readonly symbol: string;
  readonly reason: string;
  readonly metadata: Record<string, unknown>;
  readonly timestamp: string;
}

export interface NormalizedBarEvent {
  readonly providerId: string;
  readonly symbol: string;
  readonly timeframe: string;
  readonly bar: OHLCBody;
  readonly timestamp: string;
}

export interface TickEvent {
  readonly providerId: string;
  readonly symbol: string;
  readonly bid: number;
  readonly ask: number;
  readonly timestamp: string;
}

export interface ServiceLifecycleEvent {
  readonly serviceId: string;
  readonly status: ServiceStatus;
  readonly timestamp: string;
}

export interface AppCloseEvent {
  readonly side: number;
  readonly size: number;
  readonly price: number;
  readonly time: Date;
  readonly symbol: string;
}

export interface AppEventMap extends EngineEventMap {
  'close':             AppCloseEvent;
  'signal':            SignalEvent;
  'screener':          ScreenerEvent;
  'order':             OrderEvent;
  'risk':              RiskEvent;
  'normalized_bar':    NormalizedBarEvent;
  'tick':              TickEvent;
  'service:lifecycle': ServiceLifecycleEvent;
}
