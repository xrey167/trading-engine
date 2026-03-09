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
  Forex:        0,
  Futures:      1,
  CFD:          2,
  CFDIndex:     3,
  CFDLeverage:  4,
  Exchange:     5,
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
  }

  priceToPoints(price: number):  number { return price / this.pointSize; }
  pointsToPrice(points: number): number { return points * this.pointSize; }
  normalize(price: number):      number { return parseFloat(price.toFixed(this.digits)); }
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
