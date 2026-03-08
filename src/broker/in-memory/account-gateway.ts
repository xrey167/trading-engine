import type { Result } from '../../shared/lib/result.js';
import { ok, err } from '../../shared/lib/result.js';
import type { DomainError } from '../../shared/lib/errors.js';
import { notFound } from '../../shared/lib/errors.js';
import type { AccountInfoVO, SymbolInfoVO, Tick } from '../../shared/domain/account.js';
import type { IAccountGateway, IMarketDataGateway, IIndicatorGateway } from '../types.js';
import { Bars } from '../../../trading-engine.js';
import type { OHLC } from '../../../trading-engine.js';

export class InMemoryAccountGateway implements IAccountGateway, IMarketDataGateway, IIndicatorGateway {
  private accountInfo: AccountInfoVO | null = null;
  private symbols: Map<string, SymbolInfoVO> = new Map();
  private barsStore: Map<string, OHLC[]> = new Map();
  private priceRef = 0;

  seedAccount(a: AccountInfoVO): void {
    this.accountInfo = a;
  }

  seedSymbol(s: SymbolInfoVO): void {
    this.symbols.set(s.name, s);
  }

  seedBars(symbol: string, timeframe: string, bars: OHLC[]): void {
    this.barsStore.set(`${symbol}:${timeframe}`, bars);
  }

  setPrice(price: number): void {
    this.priceRef = price;
  }

  // ── IAccountGateway ──────────────────────────────────────────────────────

  async getAccountInfo(_userId: string): Promise<Result<AccountInfoVO, DomainError>> {
    if (!this.accountInfo) return err(notFound('No account seeded', _userId));
    return ok(this.accountInfo);
  }

  async getBalance(_userId: string): Promise<Result<number, DomainError>> {
    if (!this.accountInfo) return err(notFound('No account seeded', _userId));
    return ok(this.accountInfo.balance);
  }

  async isReal(_userId: string): Promise<Result<boolean, DomainError>> {
    return ok(false);
  }

  async isHedging(_userId: string): Promise<Result<boolean, DomainError>> {
    return ok(true);
  }

  // ── IMarketDataGateway ───────────────────────────────────────────────────

  async getSymbolInfo(symbol: string): Promise<Result<SymbolInfoVO, DomainError>> {
    const s = this.symbols.get(symbol);
    if (!s) return err(notFound(`Symbol ${symbol} not found`, symbol));
    return ok(s);
  }

  async refreshRates(_symbol: string): Promise<Result<Tick, DomainError>> {
    return ok({
      time: new Date().toISOString(),
      bid: this.priceRef,
      ask: this.priceRef + 0.0001,
    });
  }

  async getBars(symbol: string, timeframe: string): Promise<Result<Bars, DomainError>> {
    const data = this.barsStore.get(`${symbol}:${timeframe}`);
    if (!data) return err(notFound(`No bars for ${symbol}:${timeframe}`, `${symbol}:${timeframe}`));
    return ok(new Bars(data));
  }

  // ── IIndicatorGateway ────────────────────────────────────────────────────

  async getAtr(
    params: { symbol: string; timeframe: string; period: number; barIndex: number },
    _userId: string,
  ): Promise<Result<number, DomainError>> {
    const key = `${params.symbol}:${params.timeframe}`;
    const data = this.barsStore.get(key);
    if (!data) return err(notFound(`No bars for ${key}`, key));
    const atr = new Bars(data).atr(params.period, params.barIndex);
    return ok(atr);
  }
}
