import type { Result } from '../shared/lib/result.js';
import type { DomainError } from '../shared/lib/errors.js';
import type { PositionInfoVO, DealInfoVO, HistoryOrderInfoVO } from '../shared/domain/position.js';
import type { AccountInfoVO } from '../shared/domain/account/account.js';
import type { SymbolInfoVO, Tick } from '../shared/domain/symbol/symbol.js';;
// TODO(architecture): Dependency inversion — gateway interfaces (ports) should not depend
// on the engine implementation layer. Define an abstract IBars interface in domain/ or
// gateways/ and have trading-engine.Bars implement it, so the dependency arrow points inward.
import type { Bars } from '../market-data/bars.js';
import type { IBrokerAdapter } from '../engine/core/position.js';

// IOrderGateway
export interface PlaceOrderRequest {
  readonly userId: string;
  readonly symbol: string;
  readonly direction: 'BUY' | 'SELL';
  readonly lots: number;
  readonly price: number;
  readonly stopLoss: number;
  readonly takeProfit: number;
  readonly magic: number;
  readonly deviation: number;
  readonly comment: string;
  readonly orderType: string;
  readonly filling: string;
  readonly asyncMode: boolean;
}

export interface OrderResult {
  readonly ticket: number;
  readonly dealTicket: number;
  readonly volume: number;
  readonly price: number;
  readonly retcode: number;
  readonly retcodeDescription: string;
  readonly comment: string;
}

export interface IOrderGateway {
  placeOrder(req: PlaceOrderRequest): Promise<Result<OrderResult, DomainError>>;
  modifyOrder(ticket: number, price: number, sl: number, tp: number, userId: string): Promise<Result<void, DomainError>>;
  deleteOrder(ticket: number, userId: string): Promise<Result<void, DomainError>>;
}

// IPositionGateway
export interface IPositionGateway {
  getPositions(userId: string): Promise<Result<PositionInfoVO[], DomainError>>;
  getPositionByTicket(ticket: number, userId: string): Promise<Result<PositionInfoVO, DomainError>>;
  // Named closePositionByTicket (not closePosition) to avoid collision with
  // IBrokerAdapter.closePosition(side, size, info) which has an incompatible signature.
  closePositionByTicket(ticket: number, deviation: number, userId: string): Promise<Result<void, DomainError>>;
  modifyPosition(ticket: number, sl: number, tp: number, userId: string): Promise<Result<void, DomainError>>;
}

// IHistoryGateway
export interface IHistoryGateway {
  getDeals(userId: string, from: Date, to: Date): Promise<Result<DealInfoVO[], DomainError>>;
  getDealByTicket(ticket: number, userId: string): Promise<Result<DealInfoVO, DomainError>>;
  getHistoryOrders(userId: string, from: Date, to: Date): Promise<Result<HistoryOrderInfoVO[], DomainError>>;
}

// IMarketDataGateway
export interface IMarketDataGateway {
  getSymbolInfo(symbol: string): Promise<Result<SymbolInfoVO, DomainError>>;
  refreshRates(symbol: string): Promise<Result<Tick, DomainError>>;
  getBars(symbol: string, timeframe: string): Promise<Result<Bars, DomainError>>;
}

// IAccountGateway
export interface IAccountGateway {
  getAccountInfo(userId: string): Promise<Result<AccountInfoVO, DomainError>>;
  getBalance(userId: string): Promise<Result<number, DomainError>>;
  isReal(userId: string): Promise<Result<boolean, DomainError>>;
  isHedging(userId: string): Promise<Result<boolean, DomainError>>;
}

// IIndicatorGateway
export interface IIndicatorGateway {
  getAtr(params: { symbol: string; timeframe: string; period: number; barIndex: number }, userId: string): Promise<Result<number, DomainError>>;
}

// Composite
export interface IFullBrokerAdapter extends IBrokerAdapter, IOrderGateway, IPositionGateway, IHistoryGateway, IMarketDataGateway, IAccountGateway, IIndicatorGateway {
  /** Native ticket width for this broker: 32-bit (MT5, paper) or 64-bit (IB, etc.). */
  readonly idWidth: 32 | 64;
  /** Broker slot identifier used in canonical ID encoding. */
  readonly brokerSlot: import('../shared/lib/canonical-id.js').BrokerSlot;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
  setPrice(price: number): void;
  getPrice(): number;
}
