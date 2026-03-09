export { DayOfWeek, type DayOfWeek as DayOfWeekType } from '../calendar/session.js';
import { DayOfWeek } from '../calendar/session.js';

// ─────────────────────────────────────────────────────────────
// AssetType enum
// ─────────────────────────────────────────────────────────────

export const AssetType = {
  Forex:  'FOREX',
  Stock:  'STOCK',
  Future: 'FUTURE',
  Crypto: 'CRYPTO',
  Index:  'INDEX',
} as const;
export type AssetType = (typeof AssetType)[keyof typeof AssetType];

// ─────────────────────────────────────────────────────────────
// MT5 enum mirrors (ENUM_SYMBOL_*)
// ─────────────────────────────────────────────────────────────

export const ChartMode = {
  Bars:     0,
  Candles:  1,
  Line:     2,
} as const;
export type ChartMode = (typeof ChartMode)[keyof typeof ChartMode];

export const TradeCalcMode = {
  Forex:             0,
  ForexNoLeverage:   1,
  Futures:           2,
  CFD:               3,
  CFDIndex:          4,
  CFDLeverage:       5,
  ExchStocks:        6,
  ExchFutures:       7,
  ExchFuturesFORTS:  8,
  ExchBonds:         9,
  ExchStocksMOEX:   10,
  ExchBondsMOEX:    11,
  ServCollateral:   12,
} as const;
export type TradeCalcMode = (typeof TradeCalcMode)[keyof typeof TradeCalcMode];

export const TradeMode = {
  Disabled:   0,
  LongOnly:   1,
  ShortOnly:  2,
  CloseOnly:  3,
  Full:       4,
} as const;
export type TradeMode = (typeof TradeMode)[keyof typeof TradeMode];

export const TradeExecutionMode = {
  Request:   0,
  Instant:   1,
  Market:    2,
  Exchange:  3,
} as const;
export type TradeExecutionMode = (typeof TradeExecutionMode)[keyof typeof TradeExecutionMode];

export const SwapMode = {
  Disabled:          0,
  Points:            1,
  CurrencySymbol:    2,
  CurrencyMargin:    3,
  CurrencyDeposit:   4,
  InterestCurrent:   5,
  InterestOpen:      6,
  ReOpen:            7,
  Bid:               8,
} as const;
export type SwapMode = (typeof SwapMode)[keyof typeof SwapMode];

export const OrderGTCMode = {
  GTC:          0,
  Daily:        1,
  DailyNoStops: 2,
} as const;
export type OrderGTCMode = (typeof OrderGTCMode)[keyof typeof OrderGTCMode];

export const OptionMode = {
  European: 0,
  American: 1,
} as const;
export type OptionMode = (typeof OptionMode)[keyof typeof OptionMode];

export const OptionRight = {
  Call: 0,
  Put:  1,
} as const;
export type OptionRight = (typeof OptionRight)[keyof typeof OptionRight];

// ─────────────────────────────────────────────────────────────
// Margin / Profit calculation parameter types
// ─────────────────────────────────────────────────────────────

export interface MarginParams {
  /** Position size in lots. */
  lots:          number;
  /** Current market price at position open (bid for shorts, ask for longs). */
  marketPrice:   number;
  /** Account leverage, e.g. 100 for 1:100. Default: 1 (no leverage). */
  leverage?:     number;
  /** Broker-side margin rate coefficient. Default: 1. */
  marginRate?:   number;
  /**
   * FORTS only: average weighted price of the position or order open price.
   * Used to compute MarginDiscount when the price is more favourable than
   * the clearing price (priceSettle).
   */
  openPrice?:    number;
  /** FORTS only: estimated clearing price of the previous session. */
  priceSettle?:  number;
  /** FORTS / ExchFutures: use maintenance margin instead of initial. Default: false. */
  useMaintenance?: boolean;
  /** FORTS only: 'long' or 'short' — required for discount direction. */
  side?:         'long' | 'short';
}

export interface ProfitParams {
  /** Position size in lots. */
  lots:        number;
  /** Price at which the position was opened. */
  openPrice:   number;
  /** Price at which the position is closed (or current mark-to-market price). */
  closePrice:  number;
}

// ─────────────────────────────────────────────────────────────
// SymbolConfig — full MT5 symbol property set (all optional)
// ─────────────────────────────────────────────────────────────

export interface SymbolConfig {
  // --- Integer / boolean ---
  custom:               boolean;
  chartMode:            ChartMode;
  select:               boolean;
  visible:              boolean;
  sessionDeals:         number;
  sessionBuyOrders:     number;
  sessionSellOrders:    number;
  volume:               number;
  volumeHigh:           number;
  volumeLow:            number;
  /** Unix timestamp (seconds) of the last tick. */
  time:                 number;
  digitsLot:            number;
  spread:               number;
  spreadFloat:          boolean;
  ticksBookDepth:       number;
  tradeCalcMode:        TradeCalcMode;
  tradeMode:            TradeMode;
  /** Unix timestamp (seconds); 0 = no restriction. */
  startTime:            number;
  /** Unix timestamp (seconds); 0 = no expiration. */
  expirationTime:       number;
  tradeStopLevel:       number;
  tradeFreezeLevel:     number;
  tradeExecutionMode:   TradeExecutionMode;
  swapMode:             SwapMode;
  swapRollover3Days:    DayOfWeek;
  marginHedgedUseLeg:   boolean;
  expirationModeFlags:  number;
  fillingModeFlags:     number;
  orderModeFlags:       number;
  closeByAllowed:       boolean;
  orderModeGTC:         OrderGTCMode;
  optionMode:           OptionMode;
  optionRight:          OptionRight;
  // --- Real ---
  bid:                  number;
  bidHigh:              number;
  bidLow:               number;
  ask:                  number;
  askHigh:              number;
  askLow:               number;
  last:                 number;
  lastHigh:             number;
  lastLow:              number;
  volumeReal:           number;
  volumeHighReal:       number;
  volumeLowReal:        number;
  optionStrike:         number;
  tickValue:            number;
  tickValueProfit:      number;
  tickValueLoss:        number;
  tickSize:             number;
  contractSize:         number;
  accruedInterest:      number;
  faceValue:            number;
  liquidityRate:        number;
  lotsMin:              number;
  lotsMax:              number;
  lotsStep:             number;
  volumeLimit:          number;
  swapLong:             number;
  swapShort:            number;
  marginInitial:        number;
  marginMaintenance:    number;
  marginLong:           number;
  marginShort:          number;
  marginStop:           number;
  marginLimit:          number;
  marginStopLimit:      number;
  marginHedged:         number;
  sessionVolume:        number;
  sessionTurnover:      number;
  sessionInterest:      number;
  sessionBuyOrdersVolume:  number;
  sessionSellOrdersVolume: number;
  sessionOpen:          number;
  sessionClose:         number;
  sessionAW:            number;
  sessionPriceSettlement: number;
  sessionPriceLimitMin: number;
  sessionPriceLimitMax: number;
  // --- String ---
  basis:          string;
  currencyBase:   string;
  currencyProfit: string;
  currencyMargin: string;
  bank:           string;
  description:    string;
  formula:        string;
  isin:           string;
  page:           string;
  path:           string;
  /** Symbol used to convert margin currency to account currency (e.g. 'USDCHF'). */
  marginConvert:  string;
  /** Symbol used to convert profit currency to account currency (e.g. 'EURUSD'). */
  profitConvert:  string;
}

// ─────────────────────────────────────────────────────────────
// SymbolInfoBase — engine-level symbol configuration
// ─────────────────────────────────────────────────────────────

export abstract class SymbolInfoBase {
  readonly pointSize: number;
  abstract readonly assetType: AssetType;

  // --- Integer / boolean ---
  readonly custom:              boolean;
  readonly chartMode:           ChartMode;
  readonly select:              boolean;
  readonly visible:             boolean;
  readonly sessionDeals:        number;
  readonly sessionBuyOrders:    number;
  readonly sessionSellOrders:   number;
  readonly volume:              number;
  readonly volumeHigh:          number;
  readonly volumeLow:           number;
  readonly time:                number;
  readonly digitsLot:           number;
  readonly spread:              number;
  readonly spreadFloat:         boolean;
  readonly ticksBookDepth:      number;
  readonly tradeCalcMode:       TradeCalcMode;
  readonly tradeMode:           TradeMode;
  readonly startTime:           number;
  readonly expirationTime:      number;
  readonly tradeStopLevel:      number;
  readonly tradeFreezeLevel:    number;
  readonly tradeExecutionMode:  TradeExecutionMode;
  readonly swapMode:            SwapMode;
  readonly swapRollover3Days:   DayOfWeek;
  readonly marginHedgedUseLeg:  boolean;
  readonly expirationModeFlags: number;
  readonly fillingModeFlags:    number;
  readonly orderModeFlags:      number;
  readonly closeByAllowed:      boolean;
  readonly orderModeGTC:        OrderGTCMode;
  readonly optionMode:          OptionMode;
  readonly optionRight:         OptionRight;
  // --- Real ---
  readonly bid:                 number;
  readonly bidHigh:             number;
  readonly bidLow:              number;
  readonly ask:                 number;
  readonly askHigh:             number;
  readonly askLow:              number;
  readonly last:                number;
  readonly lastHigh:            number;
  readonly lastLow:             number;
  readonly volumeReal:          number;
  readonly volumeHighReal:      number;
  readonly volumeLowReal:       number;
  readonly optionStrike:        number;
  readonly tickValue:           number;
  readonly tickValueProfit:     number;
  readonly tickValueLoss:       number;
  readonly tickSize:            number;
  readonly contractSize:        number;
  readonly accruedInterest:     number;
  readonly faceValue:           number;
  readonly liquidityRate:       number;
  readonly lotsMin:             number;
  readonly lotsMax:             number;
  readonly lotsStep:            number;
  readonly volumeLimit:         number;
  readonly swapLong:            number;
  readonly swapShort:           number;
  readonly marginInitial:       number;
  readonly marginMaintenance:   number;
  readonly marginLong:          number;
  readonly marginShort:         number;
  readonly marginStop:          number;
  readonly marginLimit:         number;
  readonly marginStopLimit:     number;
  readonly marginHedged:        number;
  readonly sessionVolume:       number;
  readonly sessionTurnover:     number;
  readonly sessionInterest:     number;
  readonly sessionBuyOrdersVolume:  number;
  readonly sessionSellOrdersVolume: number;
  readonly sessionOpen:         number;
  readonly sessionClose:        number;
  readonly sessionAW:           number;
  readonly sessionPriceSettlement: number;
  readonly sessionPriceLimitMin:   number;
  readonly sessionPriceLimitMax:   number;
  // --- String ---
  readonly basis:          string;
  readonly currencyBase:   string;
  readonly currencyProfit: string;
  readonly currencyMargin: string;
  readonly bank:           string;
  readonly description:    string;
  readonly formula:        string;
  readonly isin:           string;
  readonly page:           string;
  readonly path:           string;
  readonly marginConvert:  string;
  readonly profitConvert:  string;

  constructor(
    public readonly name:   string,
    public readonly digits: number,
    config: Partial<SymbolConfig> = {},
  ) {
    this.pointSize = 10 ** -digits;

    // Integer / boolean
    this.custom              = config.custom              ?? false;
    this.chartMode           = config.chartMode           ?? ChartMode.Candles;
    this.select              = config.select              ?? false;
    this.visible             = config.visible             ?? true;
    this.sessionDeals        = config.sessionDeals        ?? 0;
    this.sessionBuyOrders    = config.sessionBuyOrders    ?? 0;
    this.sessionSellOrders   = config.sessionSellOrders   ?? 0;
    this.volume              = config.volume              ?? 0;
    this.volumeHigh          = config.volumeHigh          ?? 0;
    this.volumeLow           = config.volumeLow           ?? 0;
    this.time                = config.time                ?? 0;
    this.digitsLot           = config.digitsLot           ?? 2;
    this.spread              = config.spread              ?? 0;
    this.spreadFloat         = config.spreadFloat         ?? true;
    this.ticksBookDepth      = config.ticksBookDepth      ?? 0;
    this.tradeCalcMode       = config.tradeCalcMode       ?? TradeCalcMode.Forex;
    this.tradeMode           = config.tradeMode           ?? TradeMode.Full;
    this.startTime           = config.startTime           ?? 0;
    this.expirationTime      = config.expirationTime      ?? 0;
    this.tradeStopLevel      = config.tradeStopLevel      ?? 0;
    this.tradeFreezeLevel    = config.tradeFreezeLevel    ?? 0;
    this.tradeExecutionMode  = config.tradeExecutionMode  ?? TradeExecutionMode.Instant;
    this.swapMode            = config.swapMode            ?? SwapMode.Points;
    this.swapRollover3Days   = config.swapRollover3Days   ?? DayOfWeek.Wednesday;
    this.marginHedgedUseLeg  = config.marginHedgedUseLeg  ?? false;
    this.expirationModeFlags = config.expirationModeFlags ?? 0;
    this.fillingModeFlags    = config.fillingModeFlags    ?? 0;
    this.orderModeFlags      = config.orderModeFlags      ?? 0;
    this.closeByAllowed      = config.closeByAllowed      ?? false;
    this.orderModeGTC        = config.orderModeGTC        ?? OrderGTCMode.GTC;
    this.optionMode          = config.optionMode          ?? OptionMode.European;
    this.optionRight         = config.optionRight         ?? OptionRight.Call;

    // Real
    this.bid                     = config.bid                     ?? 0;
    this.bidHigh                 = config.bidHigh                 ?? 0;
    this.bidLow                  = config.bidLow                  ?? 0;
    this.ask                     = config.ask                     ?? 0;
    this.askHigh                 = config.askHigh                 ?? 0;
    this.askLow                  = config.askLow                  ?? 0;
    this.last                    = config.last                    ?? 0;
    this.lastHigh                = config.lastHigh                ?? 0;
    this.lastLow                 = config.lastLow                 ?? 0;
    this.volumeReal              = config.volumeReal              ?? 0;
    this.volumeHighReal          = config.volumeHighReal          ?? 0;
    this.volumeLowReal           = config.volumeLowReal           ?? 0;
    this.optionStrike            = config.optionStrike            ?? 0;
    this.tickValue               = config.tickValue               ?? 1;
    this.tickValueProfit         = config.tickValueProfit         ?? 1;
    this.tickValueLoss           = config.tickValueLoss           ?? 1;
    this.tickSize                = config.tickSize                ?? this.pointSize;
    this.contractSize            = config.contractSize            ?? 100_000;
    this.accruedInterest         = config.accruedInterest         ?? 0;
    this.faceValue               = config.faceValue               ?? 0;
    this.liquidityRate           = config.liquidityRate           ?? 0;
    this.lotsMin                 = config.lotsMin                 ?? 0.01;
    this.lotsMax                 = config.lotsMax                 ?? 100;
    this.lotsStep                = config.lotsStep                ?? 0.01;
    this.volumeLimit             = config.volumeLimit             ?? 0;
    this.swapLong                = config.swapLong                ?? 0;
    this.swapShort               = config.swapShort               ?? 0;
    this.marginInitial           = config.marginInitial           ?? 0;
    this.marginMaintenance       = config.marginMaintenance       ?? 0;
    this.marginLong              = config.marginLong              ?? 0;
    this.marginShort             = config.marginShort             ?? 0;
    this.marginStop              = config.marginStop              ?? 0;
    this.marginLimit             = config.marginLimit             ?? 0;
    this.marginStopLimit         = config.marginStopLimit         ?? 0;
    this.marginHedged            = config.marginHedged            ?? 0;
    this.sessionVolume           = config.sessionVolume           ?? 0;
    this.sessionTurnover         = config.sessionTurnover         ?? 0;
    this.sessionInterest         = config.sessionInterest         ?? 0;
    this.sessionBuyOrdersVolume  = config.sessionBuyOrdersVolume  ?? 0;
    this.sessionSellOrdersVolume = config.sessionSellOrdersVolume ?? 0;
    this.sessionOpen             = config.sessionOpen             ?? 0;
    this.sessionClose            = config.sessionClose            ?? 0;
    this.sessionAW               = config.sessionAW               ?? 0;
    this.sessionPriceSettlement  = config.sessionPriceSettlement  ?? 0;
    this.sessionPriceLimitMin    = config.sessionPriceLimitMin    ?? 0;
    this.sessionPriceLimitMax    = config.sessionPriceLimitMax    ?? 0;

    // String
    this.basis          = config.basis          ?? '';
    this.currencyBase   = config.currencyBase   ?? '';
    this.currencyProfit = config.currencyProfit ?? '';
    this.currencyMargin = config.currencyMargin ?? '';
    this.bank           = config.bank           ?? '';
    this.description    = config.description    ?? '';
    this.formula        = config.formula        ?? '';
    this.isin           = config.isin           ?? '';
    this.page           = config.page           ?? '';
    this.path           = config.path           ?? '';
    this.marginConvert  = config.marginConvert  ?? '';
    this.profitConvert  = config.profitConvert  ?? '';
  }

  priceToPoints(price: number):  number { return price / this.pointSize; }
  pointsToPrice(points: number): number { return points * this.pointSize; }
  normalize(price: number):      number { return parseFloat(price.toFixed(this.digits)); }

  // ── Lot normalisation ────────────────────────────────────────────────────

  /** Round lots up to the nearest lotsStep multiple (matches MT5 normalizeLots). */
  normalizeLots(lots: number): number {
    return Math.ceil(lots / this.lotsStep) * this.lotsStep;
  }

  // ── Price arithmetic ─────────────────────────────────────────────────────

  /** Add `points` price points to `price`, result normalised to symbol digits. */
  addPoints(price: number, points: number): number {
    return this.normalize(price + points * this.pointSize);
  }

  /** Subtract `points` price points from `price`, result normalised to symbol digits. */
  subPoints(price: number, points: number): number {
    return this.normalize(price - points * this.pointSize);
  }

  // ── Market data helpers ──────────────────────────────────────────────────

  /** Midpoint of current bid and ask. */
  mid(): number { return (this.bid + this.ask) / 2; }

  /** Current spread in price points (integer). */
  spreadPts(): number { return Math.round((this.ask - this.bid) / this.pointSize); }

  /**
   * Price at which an order of the given side would be filled.
   * Long orders execute at ask; short orders execute at bid.
   */
  priceForOpen(side: 'long' | 'short'):  number { return side === 'long' ? this.ask : this.bid; }

  /**
   * Price at which a position of the given side would be closed.
   * Long positions close at bid; short positions close at ask.
   */
  priceForClose(side: 'long' | 'short'): number { return side === 'long' ? this.bid : this.ask; }

  // ── TradeMode predicates ─────────────────────────────────────────────────

  isTradeDisabled():  boolean { return this.tradeMode === TradeMode.Disabled;  }
  isTradeFully():     boolean { return this.tradeMode === TradeMode.Full;       }
  isTradeLongOnly():  boolean { return this.tradeMode === TradeMode.LongOnly;  }
  isTradeShortOnly(): boolean { return this.tradeMode === TradeMode.ShortOnly; }
  isTradeCloseOnly(): boolean { return this.tradeMode === TradeMode.CloseOnly; }

  // ── TradeExecutionMode predicates ────────────────────────────────────────

  isTradeExeMarket():   boolean { return this.tradeExecutionMode === TradeExecutionMode.Market;   }
  isTradeExeInstant():  boolean { return this.tradeExecutionMode === TradeExecutionMode.Instant;  }
  isTradeExeRequest():  boolean { return this.tradeExecutionMode === TradeExecutionMode.Request;  }
  isTradeExeExchange(): boolean { return this.tradeExecutionMode === TradeExecutionMode.Exchange; }

  // ── Misc trading rules ───────────────────────────────────────────────────

  /** Whether the broker allows close-by operations for this symbol. */
  isCloseByAllowed(): boolean { return this.closeByAllowed; }

  /**
   * Returns true when neither base nor profit currency equals the account currency,
   * i.e. this is a cross pair that requires two conversion steps to reach account CCY.
   * Example: EURGBP is a cross for a USD account; EURUSD and GBPUSD are not.
   */
  isCross(accountCurrency: string): boolean {
    return this.currencyBase !== accountCurrency && this.currencyProfit !== accountCurrency;
  }

  // ── Margin calculation (ENUM_SYMBOL_CALC_MODE) ───────────────────────────

  /**
   * Required margin to open a position, in account deposit currency.
   *
   * Implements all 13 SYMBOL_CALC_MODE_* formulas from the MT5 specification.
   * Symbol-level constants (contractSize, tickValue, tickSize, faceValue,
   * marginInitial, marginMaintenance, liquidityRate) are read from `this`.
   * Only dynamic per-trade values (lots, marketPrice, leverage, marginRate)
   * must be supplied via {@link MarginParams}.
   */
  calcMargin(p: MarginParams): number {
    const lots        = p.lots;
    const price       = p.marketPrice;
    const leverage    = p.leverage    ?? 1;
    const marginRate  = p.marginRate  ?? 1;
    const C           = this.contractSize;
    const tv          = this.tickValue;
    const ts          = this.tickSize;
    const initMargin  = this.marginInitial;
    const maintMargin = this.marginMaintenance;
    const useMaint    = p.useMaintenance ?? false;

    switch (this.tradeCalcMode) {
      // Lots * ContractSize / Leverage * MarginRate
      case TradeCalcMode.Forex:
        return lots * C / leverage * marginRate;

      // Lots * ContractSize * MarginRate  (no leverage)
      case TradeCalcMode.ForexNoLeverage:
        return lots * C * marginRate;

      // Lots * InitialMargin * MarginRate
      case TradeCalcMode.Futures:
        return lots * initMargin * marginRate;

      // Lots * ContractSize * MarketPrice * MarginRate
      case TradeCalcMode.CFD:
        return lots * C * price * marginRate;

      // (Lots * ContractSize * MarketPrice) * TickValue / TickSize * MarginRate
      case TradeCalcMode.CFDIndex:
        return lots * C * price * (tv / ts) * marginRate;

      // (Lots * ContractSize * MarketPrice) / Leverage * MarginRate
      case TradeCalcMode.CFDLeverage:
        return lots * C * price / leverage * marginRate;

      // Lots * ContractSize * LastPrice * MarginRate
      case TradeCalcMode.ExchStocks:
      case TradeCalcMode.ExchStocksMOEX:
        return lots * C * price * marginRate;

      // Lots * (InitialMargin | MaintenanceMargin) * MarginRate
      case TradeCalcMode.ExchFutures: {
        const base = useMaint ? maintMargin : initMargin;
        return lots * base * marginRate;
      }

      // Same base formula as ExchFutures; MarginDiscount applied when
      // the order price is more favourable than the clearing price.
      // Discount (long):  Lots * (PriceSettle - PriceOrder) * TickValue / TickSize
      // Discount (short): Lots * (PriceOrder  - PriceSettle) * TickValue / TickSize
      case TradeCalcMode.ExchFuturesFORTS: {
        const base        = useMaint ? maintMargin : initMargin;
        const rawMargin   = lots * base * marginRate;
        const openPrice   = p.openPrice   ?? price;
        const priceSettle = p.priceSettle ?? 0;
        let discount      = 0;
        if (priceSettle > 0) {
          if (p.side === 'long'  && openPrice  < priceSettle) {
            discount = lots * (priceSettle - openPrice)  * tv / ts;
          } else if (p.side === 'short' && openPrice > priceSettle) {
            discount = lots * (openPrice   - priceSettle) * tv / ts;
          }
        }
        return Math.max(0, rawMargin - discount);
      }

      // Lots * ContractSize * FaceValue * OpenPrice / 100
      case TradeCalcMode.ExchBonds:
      case TradeCalcMode.ExchBondsMOEX:
        return lots * C * this.faceValue * (p.openPrice ?? price) / 100;

      // Non-tradable collateral — no required margin
      case TradeCalcMode.ServCollateral:
        return 0;

      default:
        return 0;
    }
  }

  // ── Profit calculation (ENUM_SYMBOL_CALC_MODE) ────────────────────────────

  /**
   * Realised profit/loss for a closed position, in account deposit currency.
   *
   * Implements all 13 SYMBOL_CALC_MODE_* profit formulas. Returns 0 for
   * {@link TradeCalcMode.ServCollateral} — use {@link calcMarketValue} instead.
   */
  calcProfit(p: ProfitParams): number {
    const { lots, openPrice, closePrice } = p;
    const C  = this.contractSize;
    const tv = this.tickValue;
    const ts = this.tickSize;
    const priceDiff = closePrice - openPrice;

    switch (this.tradeCalcMode) {
      // (close - open) * ContractSize * Lots
      case TradeCalcMode.Forex:
      case TradeCalcMode.ForexNoLeverage:
      case TradeCalcMode.CFD:
      case TradeCalcMode.CFDIndex:
      case TradeCalcMode.CFDLeverage:
      case TradeCalcMode.ExchStocks:
      case TradeCalcMode.ExchStocksMOEX:
        return priceDiff * C * lots;

      // (close - open) * Lots * TickValue / TickSize
      case TradeCalcMode.Futures:
      case TradeCalcMode.ExchFutures:
      case TradeCalcMode.ExchFuturesFORTS:
        return priceDiff * lots * tv / ts;

      // Lots * ClosePrice * FaceValue * ContractSize + AccruedInterest * Lots * ContractSize
      case TradeCalcMode.ExchBonds:
      case TradeCalcMode.ExchBondsMOEX:
        return lots * closePrice * this.faceValue * C
             + this.accruedInterest * lots * C;

      case TradeCalcMode.ServCollateral:
        return 0;

      default:
        return 0;
    }
  }

  // ── Collateral market value ───────────────────────────────────────────────

  /**
   * Market value of a collateral position (ServCollateral mode only).
   * Contributes to account equity and free margin but is not a realised P&L.
   *
   * Formula: Lots * ContractSize * MarketPrice * LiquidityRate
   */
  calcMarketValue(lots: number, marketPrice: number): number {
    return lots * this.contractSize * marketPrice * this.liquidityRate;
  }
}

// ─────────────────────────────────────────────────────────────
// Concrete subclasses
// ─────────────────────────────────────────────────────────────

export class SymbolInfoForex extends SymbolInfoBase {
  readonly assetType = AssetType.Forex;
  readonly baseCurrency:  string;
  readonly quoteCurrency: string;

  constructor(name: string, digits: number, config?: Partial<SymbolConfig>) {
    if (name.length !== 6) {
      throw new Error(`Forex symbol name "${name}" must be 6 characters long (e.g., "EURUSD").`);
    }
    const base  = name.slice(0, 3).toUpperCase();
    const quote = name.slice(3, 6).toUpperCase();
    super(name, digits, { currencyBase: base, currencyProfit: quote, ...config });
    this.baseCurrency  = base;
    this.quoteCurrency = quote;
  }
}

export class SymbolInfoStock extends SymbolInfoBase {
  readonly assetType = AssetType.Stock;

  constructor(
    name: string,
    digits: number,
    readonly exchange?: string,
    config?: Partial<SymbolConfig>,
  ) {
    super(name, digits, config);
  }
}

export class SymbolInfoFuture extends SymbolInfoBase {
  readonly assetType = AssetType.Future;

  constructor(
    name: string,
    digits: number,
    contractSize = 1,
    config?: Partial<SymbolConfig>,
  ) {
    super(name, digits, { contractSize, ...config });
  }
}

export class SymbolInfoCrypto extends SymbolInfoBase {
  readonly assetType = AssetType.Crypto;

  constructor(name: string, digits: number, config?: Partial<SymbolConfig>) {
    super(name, digits, config);
  }
}

export class SymbolInfoIndex extends SymbolInfoBase {
  readonly assetType = AssetType.Index;

  constructor(name: string, digits: number, config?: Partial<SymbolConfig>) {
    super(name, digits, config);
  }
}
