import type { EventEmitter } from 'node:events';
import type { IBrokerAdapter, ExecutionReport, Side } from '../../trading-engine.js';

/**
 * Paper broker — simulates fills in memory.
 * Emits 'fill' and 'close' events on the shared emitter so the WebSocket
 * route can stream them to connected clients.
 */
export class PaperBroker implements IBrokerAdapter {
  private seq = 0;
  private priceRef = 0;

  constructor(private readonly emitter: EventEmitter) {}

  /** Called by the bars route before onBar so price reflects the current bar. */
  setPrice(price: number): void {
    this.priceRef = price;
  }

  /** Returns the current price reference (last bar close set via setPrice). */
  getPrice(): number {
    return this.priceRef;
  }

  async marketOrder(side: Side, size: number, info?: string): Promise<ExecutionReport> {
    const report: ExecutionReport = {
      price: this.priceRef,
      time:  new Date(),
      id:    `fill-${++this.seq}`,
    };
    console.log(`[PaperBroker] fill  side=${side} size=${size} price=${report.price} ${info ?? ''}`);
    this.emitter.emit('fill', { side, size, price: report.price, time: report.time, id: report.id });
    return report;
  }

  async closePosition(side: Side, size: number, info?: string): Promise<{ price: number }> {
    const price = this.priceRef;
    console.log(`[PaperBroker] close side=${side} size=${size} price=${price} ${info ?? ''}`);
    this.emitter.emit('close', { side, size, price, time: new Date() });
    return { price };
  }

  async updateSLTP(_side: Side, _sl: number | null, _tp: number | null): Promise<void> {
    // Paper broker — no-op; engine manages SL/TP in memory
  }

  async getSpread(_symbol: string): Promise<number> {
    return 0.00010; // 1 pip default spread
  }

  async getAccount(): Promise<{ equity: number; balance: number }> {
    return { equity: 10_000, balance: 10_000 };
  }
}
