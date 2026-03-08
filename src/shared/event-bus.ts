import { EventEmitter } from 'node:events';
import type { OHLCBody } from './schemas/common.js';

export interface EngineEventMap {
  bar:   { type: 'bar'; bar: OHLCBody };
  fill:  { side: number; size: number; price: number; time: Date; id: string };
  close: { side: number; size: number; price: number; time: Date; symbol?: string };
}

export class TypedEventBus<TMap extends {} = EngineEventMap> {
  private readonly ee = new EventEmitter();
  constructor() { this.ee.setMaxListeners(0); }
  emit<K extends keyof TMap & string>(event: K, payload: TMap[K]): boolean { return this.ee.emit(event, payload); }
  on<K extends keyof TMap & string>(event: K, fn: (p: TMap[K]) => void): this { this.ee.on(event, fn); return this; }
  off<K extends keyof TMap & string>(event: K, fn: (p: TMap[K]) => void): this { this.ee.off(event, fn); return this; }
  once<K extends keyof TMap & string>(event: K, fn: (p: TMap[K]) => void): this { this.ee.once(event, fn); return this; }
}
