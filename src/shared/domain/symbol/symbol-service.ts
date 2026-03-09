import { TradeCalcMode, type SymbolInfoBase } from './symbol-info.js';

// ─────────────────────────────────────────────────────────────
// Internal currency index
// ─────────────────────────────────────────────────────────────

interface CurrencyIndexEntry {
  /** Positions in the symbols array where this currency is the base currency. */
  baseSet:   Set<number>;
  /** Positions in the symbols array where this currency is the profit currency. */
  profitSet: Set<number>;
}

// ─────────────────────────────────────────────────────────────
// SymbolService
// ─────────────────────────────────────────────────────────────

/**
 * Cross-symbol domain service: currency conversion, leverage calculation,
 * lot sizing, and profit estimation — all expressed in account currency.
 *
 * Mirrors the MQL5 SymbolAnalyzer class; call sites provide live bid/ask
 * via the SymbolInfoBase instances passed at construction or via `update()`.
 *
 * Index is built once at construction: O(n). All lookups are O(1).
 */
export class SymbolService {
  private readonly accountCurrency: string;
  private readonly symbols:         readonly SymbolInfoBase[];
  private readonly index:           Map<string, CurrencyIndexEntry>;
  /** Fast name → array-index lookup. */
  private readonly nameIndex:       Map<string, number>;

  constructor(symbols: SymbolInfoBase[], accountCurrency: string) {
    this.accountCurrency = accountCurrency;
    this.symbols         = symbols;
    this.index           = this.buildCurrencyIndex();
    this.nameIndex       = new Map(symbols.map((s, i) => [s.name, i]));
  }

  // ── Accessors ────────────────────────────────────────────────────────────

  getAccountCurrency(): string                    { return this.accountCurrency; }
  getSymbols():         readonly SymbolInfoBase[] { return this.symbols;          }

  /** Returns all symbols where base === profit (e.g. indices, equities with no CCY pair). */
  getSpecials(): SymbolInfoBase[] {
    return this.symbols.filter(s => !s.currencyBase || s.currencyBase === s.currencyProfit);
  }

  getSymbol(name: string): SymbolInfoBase | undefined {
    const i = this.nameIndex.get(name);
    return i !== undefined ? this.symbols[i] : undefined;
  }

  // ── Currency index ───────────────────────────────────────────────────────

  private buildCurrencyIndex(): Map<string, CurrencyIndexEntry> {
    const index = new Map<string, CurrencyIndexEntry>();

    const getOrCreate = (ccy: string): CurrencyIndexEntry => {
      let e = index.get(ccy);
      if (!e) { e = { baseSet: new Set(), profitSet: new Set() }; index.set(ccy, e); }
      return e;
    };

    for (let i = 0; i < this.symbols.length; i++) {
      const s = this.symbols[i];
      const base   = s.currencyBase;
      const profit = s.currencyProfit;
      // Skip specials: indices and single-currency instruments
      if (!base || !profit || base === profit) continue;
      getOrCreate(base).baseSet.add(i);
      getOrCreate(profit).profitSet.add(i);
    }

    return index;
  }

  // ── Conversion symbol lookup ─────────────────────────────────────────────

  /**
   * Returns the name of a tradeable symbol that bridges `cur1` and `cur2`,
   * or `''` when no direct bridge exists.
   *
   * Checks two directions:
   *   1. cur1 is base  → cur2 is profit  (e.g. EURUSD for EUR→USD)
   *   2. cur1 is profit → cur2 is base   (e.g. USDEUR would be EURUSD inverted)
   */
  getConversionSymbol(cur1: string, cur2: string): string {
    const e1 = this.index.get(cur1);
    const e2 = this.index.get(cur2);
    if (!e1 || !e2) return '';

    // cur1 base ∩ cur2 profit
    for (const i of e1.baseSet) {
      if (e2.profitSet.has(i)) return this.symbols[i].name;
    }
    // cur1 profit ∩ cur2 base
    for (const i of e1.profitSet) {
      if (e2.baseSet.has(i)) return this.symbols[i].name;
    }

    return '';
  }

  // ── Currency conversion ──────────────────────────────────────────────────

  /**
   * Converts `money` (denominated in `currency`) to the account currency
   * using `side` to select bid or ask on the conversion symbol.
   *
   * Returns `-0.1` when no conversion path is found (matches MQL5 convention).
   *
   * Direction rule:
   *   - If the conversion symbol's BASE is the account currency → divide
   *     (e.g. USDCHF: 1 USD = X CHF, so CHF ÷ rate = USD)
   *   - If the conversion symbol's PROFIT is the account currency → multiply
   *     (e.g. EURUSD: 1 EUR = X USD, so EUR × rate = USD)
   */
  convertToAccount(
    currency:         string,
    money:            number,
    side:             'long' | 'short',
    conversionSymbol = '',
  ): number {
    if (currency === this.accountCurrency) return money;

    const csName = conversionSymbol || this.getConversionSymbol(currency, this.accountCurrency);
    if (!csName) return -0.1;

    const cs = this.getSymbol(csName);
    if (!cs) return -0.1;

    const price = cs.priceForOpen(side);
    return cs.currencyBase === this.accountCurrency ? money / price : money * price;
  }

  /**
   * Same as {@link convertToAccount} but uses the mid price (no spread cost).
   * Used for display / theoretical calculations.
   */
  convertToAccountWithMid(
    currency:         string,
    money:            number,
    conversionSymbol = '',
  ): number {
    if (currency === this.accountCurrency) return money;

    const csName = conversionSymbol || this.getConversionSymbol(currency, this.accountCurrency);
    if (!csName) return -0.1;

    const cs = this.getSymbol(csName);
    if (!cs) return -0.1;

    const price = cs.mid();
    return cs.currencyBase === this.accountCurrency ? money / price : money * price;
  }

  // ── Leverage ─────────────────────────────────────────────────────────────

  /**
   * Effective/real leverage for one lot of `symbol` at current market price.
   *
   * Differs from account leverage: this reflects the actual capital
   * exposure per lot after margin requirements and currency conversion.
   *
   * Returns 1 for futures/exchange modes where leverage is not meaningful.
   */
  getLeverage(symbol: SymbolInfoBase): number {
    const requiredMargin = symbol.calcMargin({
      lots: 1, marketPrice: symbol.ask, leverage: 1, marginRate: 1,
    });
    if (requiredMargin <= 0) return 1;

    let leverage: number;

    switch (symbol.tradeCalcMode) {
      case TradeCalcMode.Forex:
      case TradeCalcMode.ForexNoLeverage: {
        leverage = symbol.contractSize / requiredMargin;
        if (symbol.currencyBase !== this.accountCurrency) {
          leverage = symbol.currencyProfit === this.accountCurrency
            ? this.convertToAccount(symbol.currencyBase, leverage, 'long', symbol.name)
            : this.convertToAccountWithMid(symbol.currencyBase, leverage);
        }
        break;
      }

      case TradeCalcMode.CFD:
      case TradeCalcMode.CFDLeverage: {
        leverage = symbol.contractSize * symbol.ask / requiredMargin;
        if (symbol.currencyMargin !== this.accountCurrency) {
          leverage = this.convertToAccount(symbol.currencyMargin, leverage, 'long');
        }
        break;
      }

      case TradeCalcMode.CFDIndex: {
        leverage = symbol.contractSize * symbol.ask * symbol.tickValue
                 / (symbol.tickSize * requiredMargin);
        if (symbol.currencyMargin !== this.accountCurrency) {
          leverage = this.convertToAccount(symbol.currencyMargin, leverage, 'long');
        }
        break;
      }

      default:
        // Futures, exchange modes — leverage concept does not apply
        return 1;
    }

    return Math.round(leverage);
  }

  // ── Position sizing ──────────────────────────────────────────────────────

  /**
   * Maximum lots openable without breaching the margin call level.
   *
   * Solves the margin-call boundary equation for `x` (lots):
   *
   *   (free - x*lossPerLot - x*required) / (used + x*required) = level
   *
   * Which rearranges to:
   *
   *   x = (free - used * level) / (required + required * level - lossPerLot)
   *
   * @param freeMargin        - current free margin (account currency)
   * @param usedMargin        - current margin already in use (account currency)
   * @param symbol            - symbol to size
   * @param side              - trade direction
   * @param predictedLossPoints - expected adverse move in points (stop distance); default 0
   * @param marginCallLevel   - broker margin call level in percent (e.g. 20 for 20%); default 0
   */
  getMaxLots(
    freeMargin:          number,
    usedMargin:          number,
    symbol:              SymbolInfoBase,
    side:                'long' | 'short',
    predictedLossPoints = 0,
    marginCallLevel    = 0,
  ): number {
    const required = this.getRequiredMargin(symbol, side, 1);
    if (required <= 0) return 0;

    const level     = marginCallLevel / 100;
    const openPrice = symbol.priceForOpen(side);

    // Worst-case close price after predicted loss (spread + stop distance)
    const lossPrice  = symbol.pointSize * predictedLossPoints;
    const closePrice = side === 'long'
      ? symbol.priceForClose(side) - lossPrice
      : symbol.priceForClose(side) + lossPrice;

    // Profit per 1 lot — negative when a loss (spread + predicted adverse move)
    const profitPerLot = this.getProfit(symbol, side, openPrice, 1, closePrice);

    // Core formula — see header comment
    const lots = (freeMargin - usedMargin * level)
               / (required + required * level - profitPerLot);

    return symbol.normalizeLots(Math.max(0, lots));
  }

  // ── Profit estimation ────────────────────────────────────────────────────

  /**
   * Estimated profit/loss for `lots` of `symbol`, converted to account currency.
   *
   * Pass `closePrice = 0` to use the current mark-to-market price (bid for longs,
   * ask for shorts).
   */
  getProfit(
    symbol:     SymbolInfoBase,
    side:       'long' | 'short',
    openPrice:  number,
    lots:       number,
    closePrice = 0,
  ): number {
    const close       = closePrice || symbol.priceForClose(side);
    const profitNative = symbol.calcProfit({ lots, openPrice, closePrice: close });

    if (symbol.currencyProfit === this.accountCurrency) return profitNative;

    const csName = symbol.profitConvert
      || this.getConversionSymbol(symbol.currencyProfit, this.accountCurrency);

    return this.convertToAccount(symbol.currencyProfit, profitNative, side, csName);
  }

  /**
   * Required margin for a position, converted to account currency.
   */
  getRequiredMargin(
    symbol:     SymbolInfoBase,
    side:       'long' | 'short',
    lots:       number,
    leverage?:  number,
    marginRate?: number,
  ): number {
    const marginNative = symbol.calcMargin({
      lots,
      marketPrice: symbol.priceForOpen(side),
      leverage,
      marginRate,
    });

    if (symbol.currencyMargin === this.accountCurrency) return marginNative;

    const csName = symbol.marginConvert
      || this.getConversionSymbol(symbol.currencyMargin, this.accountCurrency);

    return this.convertToAccount(symbol.currencyMargin, marginNative, side, csName);
  }
}
