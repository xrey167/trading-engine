import type { EventEmitter } from 'node:events';
import type { IBrokerAdapter, ExecutionReport, Side } from '../../trading-engine.js';
import { Bars, type OHLC } from '../../trading-engine.js';
import type { PositionInfoVO, DealInfoVO, HistoryOrderInfoVO } from '../domain/position.js';
import type { AccountInfoVO, SymbolInfoVO, Tick } from '../domain/account.js';
import type {
  IOrderGateway,
  IPositionGateway,
  IHistoryGateway,
  IMarketDataGateway,
  IAccountGateway,
  IIndicatorGateway,
  OrderResult,
  PlaceOrderRequest,
} from '../gateways/types.js';
import { ok, err, type Result } from '../lib/result.js';
import { notFound, gatewayError, type DomainError } from '../lib/errors.js';

/**
 * Paper broker — simulates fills in memory.
 * Emits 'fill' and 'close' events on the shared emitter so the WebSocket
 * route can stream them to connected clients.
 *
 * Also implements all gateway interfaces for the application layer.
 * IBrokerAdapter.closePosition(side, size, info) and IPositionGateway.closePositionByTicket
 * are separate methods with different signatures; no collision exists.
 */
export class PaperBroker implements IBrokerAdapter, IOrderGateway, IPositionGateway, IHistoryGateway, IMarketDataGateway, IAccountGateway, IIndicatorGateway {
  private seq = 0;
  private priceRef = 0;

  // Gateway stores
  private positions: PositionInfoVO[] = [];
  private deals: DealInfoVO[] = [];
  private historyOrders: HistoryOrderInfoVO[] = [];
  private symbols: Map<string, SymbolInfoVO> = new Map();
  private barsStore: Map<string, OHLC[]> = new Map();
  private accountInfoStore: AccountInfoVO | null = null;

  constructor(private readonly emitter: EventEmitter) {}

  // ───── IBrokerAdapter methods ─────

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

  // ───── Seed methods (test helpers) ─────

  seedPosition(p: PositionInfoVO): void {
    this.positions.push(p);
  }

  seedAccount(a: AccountInfoVO): void {
    this.accountInfoStore = a;
  }

  seedSymbol(s: SymbolInfoVO): void {
    this.symbols.set(s.name, s);
  }

  seedBars(symbol: string, timeframe: string, bars: OHLC[]): void {
    this.barsStore.set(`${symbol}:${timeframe}`, bars);
  }

  // ───── IPositionGateway ─────

  async getPositions(userId: string): Promise<Result<PositionInfoVO[], DomainError>> {
    return ok(this.positions.filter(p => p.userId === userId));
  }

  async getPositionByTicket(ticket: number, userId: string): Promise<Result<PositionInfoVO, DomainError>> {
    const p = this.positions.find(pos => pos.ticket === ticket && pos.userId === userId);
    if (!p) return err(notFound(`Position ${ticket} not found`, String(ticket)));
    return ok(p);
  }

  async closePositionByTicket(ticket: number, _deviation: number, userId: string): Promise<Result<void, DomainError>> {
    const idx = this.positions.findIndex(p => p.ticket === ticket && p.userId === userId);
    if (idx === -1) return err(notFound(`Position ${ticket} not found`, String(ticket)));
    this.positions.splice(idx, 1);
    return ok(undefined);
  }

  async modifyPosition(ticket: number, sl: number, tp: number, userId: string): Promise<Result<void, DomainError>> {
    const p = this.positions.find(pos => pos.ticket === ticket && pos.userId === userId);
    if (!p) return err(notFound(`Position ${ticket} not found`, String(ticket)));
    (p as { stopLoss: number; takeProfit: number }).stopLoss = sl;
    (p as { stopLoss: number; takeProfit: number }).takeProfit = tp;
    return ok(undefined);
  }

  // ───── IHistoryGateway ─────

  async getDeals(_userId: string, _from: Date, _to: Date): Promise<Result<DealInfoVO[], DomainError>> {
    return ok(this.deals.filter(d => d.userId === _userId));
  }

  async getDealByTicket(ticket: number, userId: string): Promise<Result<DealInfoVO, DomainError>> {
    const d = this.deals.find(deal => Number(deal.ticket) === ticket && deal.userId === userId);
    if (!d) return err(notFound(`Deal ${ticket} not found`, String(ticket)));
    return ok(d);
  }

  async getHistoryOrders(_userId: string, _from: Date, _to: Date): Promise<Result<HistoryOrderInfoVO[], DomainError>> {
    return ok(this.historyOrders.filter(o => o.userId === _userId));
  }

  // ───── IMarketDataGateway ─────

  async getSymbolInfo(symbol: string): Promise<Result<SymbolInfoVO, DomainError>> {
    const s = this.symbols.get(symbol);
    if (!s) return err(notFound(`Symbol ${symbol} not found`, symbol));
    return ok(s);
  }

  async refreshRates(_symbol: string): Promise<Result<Tick, DomainError>> {
    const price = this.priceRef;
    const tick: Tick = {
      time: new Date().toISOString(),
      bid: price,
      ask: price + 0.0001,
    };
    return ok(tick);
  }

  async getBars(symbol: string, timeframe: string): Promise<Result<Bars, DomainError>> {
    const data = this.barsStore.get(`${symbol}:${timeframe}`);
    if (!data) return err(notFound(`No bars for ${symbol}:${timeframe}`, `${symbol}:${timeframe}`));
    return ok(new Bars(data));
  }

  // ───── IAccountGateway ─────

  async getAccountInfo(_userId: string): Promise<Result<AccountInfoVO, DomainError>> {
    if (!this.accountInfoStore) return err(notFound('No account seeded', _userId));
    return ok(this.accountInfoStore);
  }

  async getBalance(_userId: string): Promise<Result<number, DomainError>> {
    return ok(this.accountInfoStore?.balance ?? 10_000);
  }

  async isReal(_userId: string): Promise<Result<boolean, DomainError>> {
    return ok(false);
  }

  async isHedging(_userId: string): Promise<Result<boolean, DomainError>> {
    return ok(true);
  }

  // ───── IIndicatorGateway ─────

  async getAtr(params: { symbol: string; timeframe: string; period: number; barIndex: number }, _userId: string): Promise<Result<number, DomainError>> {
    const data = this.barsStore.get(`${params.symbol}:${params.timeframe}`);
    if (!data) return err(notFound(`No bars for ${params.symbol}:${params.timeframe}`, `${params.symbol}:${params.timeframe}`));
    const bars = new Bars(data);
    const atr = bars.atr(params.period, params.barIndex);
    return ok(atr);
  }

  // ───── IOrderGateway ─────

  async placeOrder(req: PlaceOrderRequest): Promise<Result<OrderResult, DomainError>> {
    try {
      const report = await this.marketOrder(req.direction === 'BUY' ? 1 : -1, req.lots, req.comment);
      return ok({
        ticket: this.seq,
        dealTicket: this.seq,
        volume: req.lots,
        price: report.price,
        retcode: 10009,
        retcodeDescription: 'Request completed',
        comment: req.comment,
      });
    } catch (e) {
      return err(gatewayError('marketOrder failed', e));
    }
  }

  async modifyOrder(_ticket: number, _price: number, _sl: number, _tp: number, _userId: string): Promise<Result<void, DomainError>> {
    return ok(undefined);
  }

  async deleteOrder(_ticket: number, _userId: string): Promise<Result<void, DomainError>> {
    return ok(undefined);
  }

  // ───── IFullBrokerAdapter lifecycle ─────

  async connect(): Promise<void> { /* no-op for paper */ }
  async disconnect(): Promise<void> { /* no-op for paper */ }
  isConnected(): boolean { return true; }
}
