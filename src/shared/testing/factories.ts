import { Bars } from '../../market-data/bars.js';
import type { OHLC } from '../../market-data/ohlc.js';

export interface TestBar {
  open: number;
  high: number;
  low: number;
  close: number;
  time: Date;
  volume?: number;
}

export interface TestAccount {
  login: number;
  balance: number;
  equity: number;
  currency: string;
  leverage: number;
  tradeAllowed: boolean;
}

export interface TestPosition {
  ticket: number;
  userId: string;
  symbol: string;
  type: 'BUY' | 'SELL';
  magic: number;
  identifier: number;
  time: Date;
  priceOpen: number;
  priceCurrent: number;
  stopLoss: number;
  takeProfit: number;
  priceStopLimit: number;
  volume: number;
  commission: number;
  swap: number;
  profit: number;
  comment: string;
  externalId: string;
  reason: number;
}

export interface TestSymbol {
  name: string;
  digits: number;
  point: number;
  tickSize: number;
  tickValue: number;
  contractSize: number;
  volumeMin: number;
  volumeMax: number;
  volumeStep: number;
}

export interface TestDeal {
  ticket: number;
  userId: string;
  order: number;
  positionId: number;
  symbol: string;
  type: string;
  entry: string;
  volume: number;
  price: number;
  commission: number;
  swap: number;
  profit: number;
  time: Date;
  comment: string;
}

export function makeBar(overrides: Partial<TestBar> = {}): TestBar {
  return {
    open: 1.1000,
    high: 1.1050,
    low: 1.0950,
    close: 1.1020,
    time: new Date('2024-01-01T00:00:00Z'),
    volume: 100,
    ...overrides,
  };
}

export function makeAccount(overrides: Partial<TestAccount> = {}): TestAccount {
  return {
    login: 12345,
    balance: 10000,
    equity: 10000,
    currency: 'USD',
    leverage: 100,
    tradeAllowed: true,
    ...overrides,
  };
}

export function makePosition(overrides: Partial<TestPosition> = {}): TestPosition {
  return {
    ticket: 1,
    userId: 'user-1',
    symbol: 'EURUSD',
    type: 'BUY',
    magic: 0,
    identifier: 1,
    time: new Date('2024-01-01T00:00:00Z'),
    priceOpen: 1.1000,
    priceCurrent: 1.1020,
    stopLoss: 1.0950,
    takeProfit: 1.1100,
    priceStopLimit: 0,
    volume: 0.1,
    commission: -0.5,
    swap: 0,
    profit: 20,
    comment: '',
    externalId: '',
    reason: 0,
    ...overrides,
  };
}

export function makeSymbol(overrides: Partial<TestSymbol> = {}): TestSymbol {
  return {
    name: 'EURUSD',
    digits: 5,
    point: 0.00001,
    tickSize: 0.00001,
    tickValue: 1,
    contractSize: 100000,
    volumeMin: 0.01,
    volumeMax: 100,
    volumeStep: 0.01,
    ...overrides,
  };
}

export function makeDeal(overrides: Partial<TestDeal> = {}): TestDeal {
  return {
    ticket: 1,
    userId: 'user-1',
    order: 1,
    positionId: 1,
    symbol: 'EURUSD',
    type: 'DEAL_TYPE_BUY',
    entry: 'DEAL_ENTRY_IN',
    volume: 0.1,
    price: 1.1000,
    commission: -0.5,
    swap: 0,
    profit: 0,
    time: new Date('2024-01-01T00:00:00Z'),
    comment: '',
    ...overrides,
  };
}

/**
 * Build an OHLC bar for tests. When open/high/low are omitted they
 * default to `close`, producing a zero-range (doji) candle. Tests that
 * need specific body or shadow proportions must pass explicit values.
 */
export function makeOHLC(
  close: number,
  opts: { high?: number; low?: number; open?: number; volume?: number } = {},
): OHLC {
  return {
    open: opts.open ?? close,
    high: opts.high ?? close,
    low: opts.low ?? close,
    close,
    time: new Date('2024-01-01'),
    volume: opts.volume,
  };
}

export function makeBars(data: OHLC[]): Bars {
  return new Bars(data);
}

/**
 * Build a Bars instance from parallel arrays. If `highs` or `lows` are
 * shorter than `closes`, missing entries fall back to the corresponding
 * close value (producing zero-range shadows for those bars).
 */
export function makeBarsFromArrays(
  closes: number[],
  highs?: number[],
  lows?: number[],
): Bars {
  const data: OHLC[] = closes.map((c, i) =>
    makeOHLC(c, { high: highs?.[i] ?? c, low: lows?.[i] ?? c }),
  );
  return new Bars(data);
}
