import type { Result } from '../../lib/result.js';
import { err } from '../../lib/result.js';
import type { DomainError } from '../../lib/errors.js';
import { notImplemented } from '../../lib/errors.js';
import type { AccountInfoVO, SymbolInfoVO, Tick } from '../../domain/account.js';
import type { IAccountGateway, IMarketDataGateway, IIndicatorGateway } from '../types.js';
import type { Bars } from '../../../trading-engine.js';

export class MT5AccountGateway implements IAccountGateway, IMarketDataGateway, IIndicatorGateway {
  // _bridgeUrl will be used by real HTTP calls once the MT5 bridge is implemented.
  // If the URL may contain embedded credentials (e.g. http://user:pass@host/),
  // prefer passing auth separately rather than embedding it in the URL to avoid
  // accidental logging.
  constructor(protected readonly bridgeUrl: string) {}

  // ── IAccountGateway ──────────────────────────────────────────────────────

  async getAccountInfo(_userId: string): Promise<Result<AccountInfoVO, DomainError>> {
    return err(notImplemented('MT5AccountGateway.getAccountInfo', 'Connect a real MT5 bridge'));
  }

  async getBalance(_userId: string): Promise<Result<number, DomainError>> {
    return err(notImplemented('MT5AccountGateway.getBalance'));
  }

  async isReal(_userId: string): Promise<Result<boolean, DomainError>> {
    return err(notImplemented('MT5AccountGateway.isReal'));
  }

  async isHedging(_userId: string): Promise<Result<boolean, DomainError>> {
    return err(notImplemented('MT5AccountGateway.isHedging'));
  }

  // ── IMarketDataGateway ───────────────────────────────────────────────────

  async getSymbolInfo(_symbol: string): Promise<Result<SymbolInfoVO, DomainError>> {
    return err(notImplemented('MT5AccountGateway.getSymbolInfo'));
  }

  async refreshRates(_symbol: string): Promise<Result<Tick, DomainError>> {
    return err(notImplemented('MT5AccountGateway.refreshRates'));
  }

  async getBars(_symbol: string, _timeframe: string): Promise<Result<Bars, DomainError>> {
    return err(notImplemented('MT5AccountGateway.getBars'));
  }

  // ── IIndicatorGateway ────────────────────────────────────────────────────

  async getAtr(
    _params: { symbol: string; timeframe: string; period: number; barIndex: number },
    _userId: string,
  ): Promise<Result<number, DomainError>> {
    return err(notImplemented('MT5AccountGateway.getAtr'));
  }
}
