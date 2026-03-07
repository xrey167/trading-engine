import { EventEmitter } from 'node:events';
import type { OHLCBody } from './schemas/common.js';

export interface EngineEventMap {
  bar:   { type: 'bar'; bar: OHLCBody };
  fill:  { side: number; size: number; price: number; time: Date; id: string };
  close: { side: number; size: number; price: number; time: Date };
}

export class TypedEventBus {
  private readonly ee = new EventEmitter();
  constructor() { this.ee.setMaxListeners(0); }
  emit<K extends keyof EngineEventMap>(event: K, payload: EngineEventMap[K]): boolean { return this.ee.emit(event, payload); }
  on<K extends keyof EngineEventMap>(event: K, fn: (p: EngineEventMap[K]) => void): this { this.ee.on(event, fn); return this; }
  off<K extends keyof EngineEventMap>(event: K, fn: (p: EngineEventMap[K]) => void): this { this.ee.off(event, fn); return this; }
}
