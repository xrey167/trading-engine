import { describe, it, expect } from 'vitest';
import { Value } from '@sinclair/typebox/value';
import { FormatRegistry } from '@sinclair/typebox';

// Register date-time format so Value.Check validates format: 'date-time' strings
if (!FormatRegistry.Has('date-time')) {
  FormatRegistry.Set('date-time', (v) => !Number.isNaN(Date.parse(v)));
}

import {
  TradeSignalFlag,
  TradeSignalOp,
  TradeSignalEntrySchema,
} from './signal/signal.js';
import {
  makeTradeStats,
  addStat,
  resetStat,
  makeTradeParams,
  TradeStatsSchema,
  TradeParamsSchema,
} from './metrics/trade-params.js';
import { PositionInfoVOSchema, Position, PositionVOFactory, PositionType } from './position/position.js';
import { Deal, DealInfoVOFactory } from './deal/deal.js';
import { DealType, DealEntry } from './history/history.js';
import { AccountInfoVOSchema } from './account/account.js';
import {
  SymbolInfoVOSchema, TickSchema, SymbolInfoVOFactory,
  TradingSymbol, AssetType,
  SymbolInfoCrypto, SymbolInfoIndex,
} from './symbol/symbol.js';
import { MoneyManagementFactoryConfigSchema } from '../../trading/money-management/types.js';
import { PositionPool, buyMatcher as posBuyMatcher, sellMatcher as posSellMatcher, hasSlMatcher as posHasSlMatcher, hasTpMatcher as posHasTpMatcher, breakevenMatcher, profitableMatcher as posProfitableMatcher } from './position/position-pool.js';
import { DealPool, buyMatcher as dealBuyMatcher, entryMatcher, exitMatcher } from './deal/deal-pool.js';

// ─────────────────────────────────────────────────────────────
// Unit 4 — TradeSignalFlag constants
// ─────────────────────────────────────────────────────────────

describe('TradeSignalFlag constants', () => {
  it('has expected bitflag values', () => {
    expect(TradeSignalFlag.None).toBe(0);
    expect(TradeSignalFlag.OpenBuy).toBe(1);
    expect(TradeSignalFlag.OpenSell).toBe(2);
    expect(TradeSignalFlag.CloseBuy).toBe(4);
    expect(TradeSignalFlag.CloseSell).toBe(8);
  });

  it('TradeSignalOp has expected values', () => {
    expect(TradeSignalOp.Add).toBe('ADD');
    expect(TradeSignalOp.Remove).toBe('REMOVE');
    expect(TradeSignalOp.Set).toBe('SET');
  });
});

// ─────────────────────────────────────────────────────────────
// Unit 4 — TradeStats accumulation
// ─────────────────────────────────────────────────────────────

describe('TradeStats', () => {
  it('makeTradeStats returns zeroed stats', () => {
    const stats = makeTradeStats();
    expect(stats).toEqual({ wins: 0, losses: 0, total: 0, profit: 0 });
  });

  it('addStat accumulates wins and losses', () => {
    let stats = makeTradeStats();
    stats = addStat(stats, 100);   // win
    stats = addStat(stats, -50);   // loss
    stats = addStat(stats, 200);   // win
    expect(stats.wins).toBe(2);
    expect(stats.losses).toBe(1);
    expect(stats.total).toBe(3);
    expect(stats.profit).toBe(250);
  });

  it('resetStat returns zeroed stats', () => {
    expect(resetStat()).toEqual(makeTradeStats());
  });
});

// ─────────────────────────────────────────────────────────────
// Unit 4 — TradeParams defaults
// ─────────────────────────────────────────────────────────────

describe('TradeParams', () => {
  it('makeTradeParams returns defaults', () => {
    const params = makeTradeParams();
    expect(params.symbol).toBe('EURUSD');
    expect(params.timeframe).toBe('H1');
    expect(params.magic).toBe(0);
  });

  it('makeTradeParams accepts overrides', () => {
    const params = makeTradeParams({ symbol: 'GBPUSD', magic: 42 });
    expect(params.symbol).toBe('GBPUSD');
    expect(params.magic).toBe(42);
    expect(params.timeframe).toBe('H1');
  });
});

// ─────────────────────────────────────────────────────────────
// Unit 5 — PositionInfoVO schema validation
// ─────────────────────────────────────────────────────────────

describe('PositionInfoVOSchema', () => {
  it('validates a valid position object', () => {
    const valid = {
      ticket: 12345,
      userId: 'user-1',
      brokerId: '',
      symbol: 'EURUSD',
      type: 'BUY' as const,
      magic: 100,
      identifier: 1,
      time: '2025-01-01T00:00:00Z',
      priceOpen: 1.1,
      priceCurrent: 1.12,
      stopLoss: 1.08,
      takeProfit: 1.15,
      priceStopLimit: 0,
      volume: 0.1,
      commission: -0.5,
      swap: 0,
      profit: 20,
      comment: 'test',
      externalId: 'ext-1',
      reason: 0,
    };
    expect(Value.Check(PositionInfoVOSchema, valid)).toBe(true);
  });

  it('rejects invalid type', () => {
    const invalid = {
      ticket: 1,
      userId: 'u',
      brokerId: '',
      symbol: 'X',
      type: 'INVALID',
      magic: 0,
      identifier: 0,
      time: '2025-01-01T00:00:00Z',
      priceOpen: 0,
      priceCurrent: 0,
      stopLoss: 0,
      takeProfit: 0,
      priceStopLimit: 0,
      volume: 0,
      commission: 0,
      swap: 0,
      profit: 0,
      comment: '',
      externalId: '',
      reason: 0,
    };
    expect(Value.Check(PositionInfoVOSchema, invalid)).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────
// Unit 5 — AccountInfoVO schema structure
// ─────────────────────────────────────────────────────────────

describe('AccountInfoVOSchema', () => {
  it('validates a valid account object', () => {
    const valid = {
      login: 123,
      tradeMode: 'HEDGE',
      leverage: 100,
      marginMode: 0,
      stopOutMode: 0,
      marginSoMode: 0,
      tradeAllowed: true,
      tradeExpertAllowed: true,
      limitOrders: 200,
      balance: 10000,
      credit: 0,
      profit: 500,
      equity: 10500,
      margin: 100,
      freeMargin: 10400,
      marginLevel: 10500,
      marginInitial: 0,
      marginMaintenance: 0,
      assets: 0,
      liabilities: 0,
      commission: 0,
      currency: 'USD',
      name: 'Test Account',
      server: 'Demo',
      company: 'TestBroker',
    };
    expect(Value.Check(AccountInfoVOSchema, valid)).toBe(true);
  });

  it('rejects invalid tradeMode', () => {
    const invalid = {
      login: 1,
      tradeMode: 'INVALID_MODE',
      leverage: 100,
      marginMode: 0,
      stopOutMode: 0,
      marginSoMode: 0,
      tradeAllowed: true,
      tradeExpertAllowed: true,
      limitOrders: 0,
      balance: 0,
      credit: 0,
      profit: 0,
      equity: 0,
      margin: 0,
      freeMargin: 0,
      marginLevel: 0,
      marginInitial: 0,
      marginMaintenance: 0,
      assets: 0,
      liabilities: 0,
      commission: 0,
      currency: 'USD',
      name: '',
      server: '',
      company: '',
    };
    expect(Value.Check(AccountInfoVOSchema, invalid)).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────
// Unit 7 — MoneyManagementFactoryConfig schema
// ─────────────────────────────────────────────────────────────

describe('MoneyManagementFactoryConfigSchema', () => {
  it('validates a complete config', () => {
    const valid = {
      userId: 'user-1',
      symbol: 'EURUSD',
      timeframe: 'H1',
      direction: 'BUY' as const,
      stopLossType: 'PIPS',
      stopLossValue: 50,
      takeProfitType: 'PIPS',
      takeProfitValue: 100,
      lotsType: 'FIXED',
      lotsValue: 0.1,
    };
    expect(Value.Check(MoneyManagementFactoryConfigSchema, valid)).toBe(true);
  });

  it('validates config with optional fields', () => {
    const valid = {
      userId: 'user-1',
      symbol: 'EURUSD',
      timeframe: 'H1',
      direction: 'SELL' as const,
      stopLossType: 'ATR_DISTANCE',
      stopLossValue: 1.5,
      stopLossAtrMultiplier: 2.0,
      stopLossPipBuffer: 5,
      takeProfitType: 'RISK_REWARD',
      takeProfitValue: 2,
      takeProfitAtrMultiplier: 1.5,
      riskRewardRatio: 2.0,
      lotsType: 'RISK',
      lotsValue: 1.0,
    };
    expect(Value.Check(MoneyManagementFactoryConfigSchema, valid)).toBe(true);
  });

  it('rejects empty userId', () => {
    const invalid = {
      userId: '',
      symbol: 'EURUSD',
      timeframe: 'H1',
      direction: 'BUY',
      stopLossType: 'PIPS',
      stopLossValue: 50,
      takeProfitType: 'PIPS',
      takeProfitValue: 100,
      lotsType: 'FIXED',
      lotsValue: 0.1,
    };
    expect(Value.Check(MoneyManagementFactoryConfigSchema, invalid)).toBe(false);
  });

  it('rejects negative lotsValue', () => {
    const invalid = {
      userId: 'user-1',
      symbol: 'EURUSD',
      timeframe: 'H1',
      direction: 'BUY',
      stopLossType: 'PIPS',
      stopLossValue: 50,
      takeProfitType: 'PIPS',
      takeProfitValue: 100,
      lotsType: 'FIXED',
      lotsValue: -1,
    };
    expect(Value.Check(MoneyManagementFactoryConfigSchema, invalid)).toBe(false);
  });

  it('rejects invalid enum values', () => {
    const invalid = {
      userId: 'user-1',
      symbol: 'EURUSD',
      timeframe: 'H1',
      direction: 'BUY',
      stopLossType: 'INVALID_TYPE',
      stopLossValue: 50,
      takeProfitType: 'PIPS',
      takeProfitValue: 100,
      lotsType: 'FIXED',
      lotsValue: 0.1,
    };
    expect(Value.Check(MoneyManagementFactoryConfigSchema, invalid)).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────
// Deal domain class
// ─────────────────────────────────────────────────────────────

describe('Deal', () => {
  const base = DealInfoVOFactory.make({ userId: 'u1', symbol: 'EURUSD' });

  it('isBuy / isSell', () => {
    const buy  = Deal.fromVO({ ...base, type: DealType.Buy  });
    const sell = Deal.fromVO({ ...base, type: DealType.Sell });
    expect(buy.isBuy()).toBe(true);
    expect(buy.isSell()).toBe(false);
    expect(sell.isBuy()).toBe(false);
    expect(sell.isSell()).toBe(true);
  });

  it('isEntry / isExit', () => {
    const inDeal    = Deal.fromVO({ ...base, entry: DealEntry.In    });
    const outDeal   = Deal.fromVO({ ...base, entry: DealEntry.Out   });
    const inOutDeal = Deal.fromVO({ ...base, entry: DealEntry.InOut });
    const outByDeal = Deal.fromVO({ ...base, entry: DealEntry.OutBy });
    expect(inDeal.isEntry()).toBe(true);
    expect(inDeal.isExit()).toBe(false);
    expect(outDeal.isEntry()).toBe(false);
    expect(outDeal.isExit()).toBe(true);
    expect(inOutDeal.isEntry()).toBe(true);
    expect(inOutDeal.isExit()).toBe(true);
    expect(outByDeal.isExit()).toBe(true);
  });

  it('netProfit sums signed fields', () => {
    const d = Deal.fromVO({ ...base, profit: 100, commission: -2, swap: -1 });
    expect(d.netProfit()).toBe(97);
  });

  it('isProfitable', () => {
    const win  = Deal.fromVO({ ...base, profit: 100, commission: -2, swap: 0 });
    const loss = Deal.fromVO({ ...base, profit: -50, commission: -2, swap: 0 });
    expect(win.isProfitable()).toBe(true);
    expect(loss.isProfitable()).toBe(false);
  });

  it('fromVO / toVO round-trip', () => {
    const vo = { ...base, ticket: 42, profit: 10, commission: -1, swap: 0 };
    const d  = Deal.fromVO(vo);
    expect(d.ticket).toBe(42);
    expect(d.time).toBeInstanceOf(Date);
    expect(d.toVO().time).toBe(new Date(vo.time).toISOString());
    expect(d.toVO()).toMatchObject({ ticket: 42, profit: 10 });
  });

  it('fromVO / toVO preserves canonicalId when present', () => {
    const d = Deal.fromVO({ ...base, canonicalId: 'ord_AAAAAAAAAAAAAAAAAAAAAA' });
    expect(d.canonicalId).toBe('ord_AAAAAAAAAAAAAAAAAAAAAA');
    expect(d.toVO().canonicalId).toBe('ord_AAAAAAAAAAAAAAAAAAAAAA');
  });

  it('fromVO / toVO omits canonicalId when absent', () => {
    const d = Deal.fromVO(base);
    expect(d.canonicalId).toBeUndefined();
    expect(d.toVO().canonicalId).toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────
// Position domain class
// ─────────────────────────────────────────────────────────────

describe('Position', () => {
  const base = PositionVOFactory.make({ userId: 'u1', symbol: 'EURUSD' });

  it('isBuy / isSell', () => {
    const buy  = Position.fromVO({ ...base, type: PositionType.BUY  });
    const sell = Position.fromVO({ ...base, type: PositionType.SELL });
    expect(buy.isBuy()).toBe(true);
    expect(buy.isSell()).toBe(false);
    expect(sell.isBuy()).toBe(false);
    expect(sell.isSell()).toBe(true);
  });

  it('hasStopLoss / hasTakeProfit', () => {
    const noLevels = Position.fromVO({ ...base, stopLoss: 0, takeProfit: 0 });
    const levels   = Position.fromVO({ ...base, stopLoss: 1.08, takeProfit: 1.15 });
    expect(noLevels.hasStopLoss()).toBe(false);
    expect(noLevels.hasTakeProfit()).toBe(false);
    expect(levels.hasStopLoss()).toBe(true);
    expect(levels.hasTakeProfit()).toBe(true);
  });

  it('isBreakeven buy: SL >= open', () => {
    const be    = Position.fromVO({ ...base, type: PositionType.BUY, priceOpen: 1.1, stopLoss: 1.1  });
    const notBe = Position.fromVO({ ...base, type: PositionType.BUY, priceOpen: 1.1, stopLoss: 1.09 });
    const noSl  = Position.fromVO({ ...base, type: PositionType.BUY, priceOpen: 1.1, stopLoss: 0    });
    expect(be.isBreakeven()).toBe(true);
    expect(notBe.isBreakeven()).toBe(false);
    expect(noSl.isBreakeven()).toBe(false);
  });

  it('isBreakeven sell: open >= SL', () => {
    const be    = Position.fromVO({ ...base, type: PositionType.SELL, priceOpen: 1.1, stopLoss: 1.1  });
    const notBe = Position.fromVO({ ...base, type: PositionType.SELL, priceOpen: 1.1, stopLoss: 1.11 });
    const noSl  = Position.fromVO({ ...base, type: PositionType.SELL, priceOpen: 1.1, stopLoss: 0    });
    expect(be.isBreakeven()).toBe(true);
    expect(notBe.isBreakeven()).toBe(false);
    expect(noSl.isBreakeven()).toBe(false);
  });

  it('netProfit sums signed fields', () => {
    const p = Position.fromVO({ ...base, profit: 50, commission: -3, swap: -2 });
    expect(p.netProfit()).toBe(45);
  });

  it('isProfitable', () => {
    const win  = Position.fromVO({ ...base, profit: 50, commission: -3, swap: 0 });
    const loss = Position.fromVO({ ...base, profit: -10, commission: 0, swap: 0 });
    expect(win.isProfitable()).toBe(true);
    expect(loss.isProfitable()).toBe(false);
  });

  it('fromVO / toVO round-trip', () => {
    const vo = { ...base, ticket: 99, priceOpen: 1.2, priceStopLimit: 0 };
    const p  = Position.fromVO(vo);
    expect(p.ticket).toBe(99);
    expect(p.time).toBeInstanceOf(Date);
    expect(p.timeUpdate).toBeUndefined();
    expect(p.toVO()).toMatchObject({ ticket: 99, priceOpen: 1.2 });
  });

  it('fromVO preserves timeUpdate', () => {
    const t  = '2025-06-01T12:00:00Z';
    const p  = Position.fromVO({ ...base, timeUpdate: t });
    expect(p.timeUpdate).toBeInstanceOf(Date);
    expect(p.toVO().timeUpdate).toBe(new Date(t).toISOString());
  });

  it('fromVO / toVO preserves canonicalId when present', () => {
    const p = Position.fromVO({ ...base, canonicalId: 'pos_AAAAAAAAAAAAAAAAAAAAAA' });
    expect(p.canonicalId).toBe('pos_AAAAAAAAAAAAAAAAAAAAAA');
    expect(p.toVO().canonicalId).toBe('pos_AAAAAAAAAAAAAAAAAAAAAA');
  });

  it('fromVO / toVO omits canonicalId when absent', () => {
    const p = Position.fromVO(base);
    expect(p.canonicalId).toBeUndefined();
    expect(p.toVO().canonicalId).toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────
// SymbolInfoVOSchema validation
// ─────────────────────────────────────────────────────────────

describe('SymbolInfoVOSchema', () => {
  it('validates a valid symbol object', () => {
    const valid = {
      name:           'EURUSD',
      description:    'Euro vs US Dollar',
      assetType:      'FOREX' as const,
      digits:         5,
      point:          0.00001,
      tickSize:       0.00001,
      tickValue:      1,
      spread:         10,
      spreadFloat:    true,
      lotsMin:        0.01,
      lotsMax:        100,
      lotsStep:       0.01,
      contractSize:   100_000,
      bid:            1.10000,
      ask:            1.10010,
      currencyBase:   'EUR',
      currencyProfit: 'USD',
      currencyMargin: 'EUR',
    };
    expect(Value.Check(SymbolInfoVOSchema, valid)).toBe(true);
  });

  it('rejects invalid assetType', () => {
    const invalid = {
      name:           'EURUSD',
      description:    '',
      assetType:      'INVALID',
      digits:         5,
      point:          0.00001,
      tickSize:       0.00001,
      tickValue:      1,
      spread:         0,
      spreadFloat:    true,
      lotsMin:        0.01,
      lotsMax:        100,
      lotsStep:       0.01,
      contractSize:   100_000,
      bid:            0,
      ask:            0,
      currencyBase:   '',
      currencyProfit: '',
      currencyMargin: '',
    };
    expect(Value.Check(SymbolInfoVOSchema, invalid)).toBe(false);
  });

  it('SymbolInfoVOFactory.make defaults to Forex assetType and passes schema', () => {
    const vo = SymbolInfoVOFactory.make({ name: 'EURUSD' });
    expect(vo.assetType).toBe('FOREX');
    expect(vo.name).toBe('EURUSD');
    expect(Value.Check(SymbolInfoVOSchema, vo)).toBe(true);
  });

  it('SymbolInfoVOFactory.make applies overrides', () => {
    const vo = SymbolInfoVOFactory.make({ name: 'BTCUSD', assetType: 'CRYPTO' });
    expect(vo.assetType).toBe('CRYPTO');
    expect(vo.name).toBe('BTCUSD');
  });
});

// ─────────────────────────────────────────────────────────────
// SymbolInfoBase subclasses
// ─────────────────────────────────────────────────────────────

describe('SymbolInfoBase subclasses', () => {
  it('SymbolInfoCrypto has assetType Crypto and correct pointSize', () => {
    const s = new SymbolInfoCrypto('BTCUSD', 2);
    expect(s.assetType).toBe(AssetType.Crypto);
    expect(s.pointSize).toBeCloseTo(0.01);
  });

  it('SymbolInfoIndex has assetType Index and correct pointSize', () => {
    const s = new SymbolInfoIndex('US500', 1);
    expect(s.assetType).toBe(AssetType.Index);
    expect(s.pointSize).toBeCloseTo(0.1);
  });
});

// ─────────────────────────────────────────────────────────────
// Symbol domain class
// ─────────────────────────────────────────────────────────────

describe('Symbol', () => {
  const base = SymbolInfoVOFactory.make({ name: 'EURUSD' });

  it('isForex / isStock / isFuture / isCrypto / isIndex', () => {
    const forex  = TradingSymbol.fromVO({ ...base, assetType: AssetType.Forex  });
    const stock  = TradingSymbol.fromVO({ ...base, assetType: AssetType.Stock  });
    const future = TradingSymbol.fromVO({ ...base, assetType: AssetType.Future });
    const crypto = TradingSymbol.fromVO({ ...base, assetType: AssetType.Crypto });
    const index  = TradingSymbol.fromVO({ ...base, assetType: AssetType.Index  });
    expect(forex.isForex()).toBe(true);
    expect(forex.isStock()).toBe(false);
    expect(stock.isStock()).toBe(true);
    expect(future.isFuture()).toBe(true);
    expect(crypto.isCrypto()).toBe(true);
    expect(index.isIndex()).toBe(true);
  });

  it('mid returns average of bid and ask', () => {
    const s = TradingSymbol.fromVO({ ...base, bid: 1.10000, ask: 1.10010 });
    expect(s.mid()).toBeCloseTo(1.10005);
  });

  it('spreadPts returns spread in points', () => {
    const s = TradingSymbol.fromVO({ ...base, bid: 1.10000, ask: 1.10010, point: 0.00001 });
    expect(s.spreadPts()).toBe(10);
  });

  it('fromVO / toVO round-trip', () => {
    const vo = { ...base, name: 'GBPUSD', bid: 1.25000, ask: 1.25010 };
    const s  = TradingSymbol.fromVO(vo);
    expect(s.name).toBe('GBPUSD');
    expect(s.toVO()).toMatchObject({ name: 'GBPUSD', bid: 1.25000 });
  });
});

// ─────────────────────────────────────────────────────────────
// TypeBox schema re-exports from schemas/index.ts
// ─────────────────────────────────────────────────────────────

describe('Schema re-exports', () => {
  it('TradeSignalEntrySchema has expected properties', () => {
    expect(TradeSignalEntrySchema.properties.flags).toBeDefined();
    expect(TradeSignalEntrySchema.properties.timestamp).toBeDefined();
  });

  it('TradeStatsSchema has expected properties', () => {
    expect(TradeStatsSchema.properties.wins).toBeDefined();
    expect(TradeStatsSchema.properties.losses).toBeDefined();
    expect(TradeStatsSchema.properties.profit).toBeDefined();
  });

  it('TradeParamsSchema has expected properties', () => {
    expect(TradeParamsSchema.properties.symbol).toBeDefined();
    expect(TradeParamsSchema.properties.timeframe).toBeDefined();
    expect(TradeParamsSchema.properties.magic).toBeDefined();
  });

  it('SymbolInfoVOSchema has expected properties', () => {
    expect(SymbolInfoVOSchema.properties.name).toBeDefined();
    expect(SymbolInfoVOSchema.properties.digits).toBeDefined();
    expect(SymbolInfoVOSchema.properties.tickSize).toBeDefined();
    expect(SymbolInfoVOSchema.properties.assetType).toBeDefined();
  });

  it('TickSchema has expected properties', () => {
    expect(TickSchema.properties.bid).toBeDefined();
    expect(TickSchema.properties.ask).toBeDefined();
    expect(TickSchema.properties.time).toBeDefined();
  });
});

// ─────────────────────────────────────────────────────────────
// PositionPool
// ─────────────────────────────────────────────────────────────

describe('PositionPool', () => {
  const base = PositionVOFactory.make({ userId: 'u1', symbol: 'EURUSD' });

  const buy1  = Position.fromVO({ ...base, ticket: 1, type: PositionType.BUY,  volume: 0.1, priceOpen: 1.10, stopLoss: 1.08, takeProfit: 0,    profit: 20,  commission: -1, swap: 0 });
  const buy2  = Position.fromVO({ ...base, ticket: 2, type: PositionType.BUY,  volume: 0.2, priceOpen: 1.12, stopLoss: 1.12, takeProfit: 1.20, profit: 50,  commission: -2, swap: 0 });
  const sell1 = Position.fromVO({ ...base, ticket: 3, type: PositionType.SELL, volume: 0.3, priceOpen: 1.15, stopLoss: 0,    takeProfit: 0,    profit: -30, commission: -1, swap: 0 });

  const pool = new PositionPool([buy1, buy2, sell1]);

  it('size / isEmpty on empty pool', () => {
    const empty = new PositionPool([]);
    expect(empty.size).toBe(0);
    expect(empty.isEmpty).toBe(true);
  });

  it('size / isEmpty on populated pool', () => {
    expect(pool.size).toBe(3);
    expect(pool.isEmpty).toBe(false);
  });

  it('count() total', () => {
    expect(pool.count()).toBe(3);
  });

  it('count(buyMatcher)', () => {
    expect(pool.count(posBuyMatcher)).toBe(2);
  });

  it('find() by ticket', () => {
    expect(pool.find(p => p.ticket === 2)).toBe(buy2);
    expect(pool.find(p => p.ticket === 99)).toBeUndefined();
  });

  it('has() true and false cases', () => {
    expect(pool.has(posSellMatcher)).toBe(true);
    expect(pool.has(p => p.ticket === 99)).toBe(false);
  });

  it('filter(buyMatcher) returns only buys', () => {
    const buys = pool.filter(posBuyMatcher);
    expect(buys.size).toBe(2);
    expect(buys.has(posSellMatcher)).toBe(false);
  });

  it('filter(buyMatcher).filter(hasSlMatcher) composed filters', () => {
    // both buy1 (SL=1.08) and buy2 (SL=1.12) have SL set
    const buysWithSl = pool.filter(posBuyMatcher).filter(posHasSlMatcher);
    expect(buysWithSl.size).toBe(2);
    expect(buysWithSl.find(p => p.ticket === 1)).toBe(buy1);
    expect(buysWithSl.find(p => p.ticket === 2)).toBe(buy2);
  });

  it('filter(hasTpMatcher) returns positions with TP', () => {
    expect(pool.filter(posHasTpMatcher).size).toBe(1);
  });

  it('filter(breakevenMatcher) returns breakeven positions', () => {
    // buy2 has SL == priceOpen (1.12 == 1.12) → breakeven
    expect(pool.filter(breakevenMatcher).size).toBe(1);
  });

  it('filter(profitableMatcher) returns profitable positions', () => {
    // buy1: 20 + -1 + 0 = 19 ✓   buy2: 50 + -2 + 0 = 48 ✓   sell1: -30 + -1 + 0 = -31 ✗
    expect(pool.filter(posProfitableMatcher).size).toBe(2);
  });

  it('for...of iteration', () => {
    const tickets: number[] = [];
    for (const p of pool) tickets.push(p.ticket);
    expect(tickets).toEqual([1, 2, 3]);
  });

  it('map() extracts volumes', () => {
    expect(pool.map(p => p.volume)).toEqual([0.1, 0.2, 0.3]);
  });

  it('reduce() sums volumes', () => {
    expect(pool.reduce((n, p) => n + p.volume, 0)).toBeCloseTo(0.6);
  });

  it('totalVolume()', () => {
    expect(pool.totalVolume()).toBeCloseTo(0.6);
  });

  it('totalNetProfit()', () => {
    // buy1: 19, buy2: 48, sell1: -31 → 36
    expect(pool.totalNetProfit()).toBeCloseTo(36);
  });

  it('vwap() weighted average of priceOpen', () => {
    // (0.1*1.10 + 0.2*1.12 + 0.3*1.15) / 0.6 = 0.679 / 0.6 = 1.13166̄ ≈ 1.1317 (4 dp)
    expect(pool.vwap()).toBeCloseTo(1.1317, 4);
  });

  it('vwap() returns 0 for empty pool', () => {
    expect(new PositionPool([]).vwap()).toBe(0);
  });

  it('toArray() returns raw array', () => {
    expect(pool.toArray()).toEqual([buy1, buy2, sell1]);
  });
});

// ─────────────────────────────────────────────────────────────
// DealPool
// ─────────────────────────────────────────────────────────────

describe('DealPool', () => {
  const base = DealInfoVOFactory.make({ userId: 'u1', symbol: 'EURUSD' });

  const d1 = Deal.fromVO({ ...base, ticket: 1, symbol: 'EURUSD', positionId: 10, type: DealType.Buy,  entry: DealEntry.In,  volume: 0.1, profit: 0,   commission: -1, swap: 0 });
  const d2 = Deal.fromVO({ ...base, ticket: 2, symbol: 'EURUSD', positionId: 10, type: DealType.Sell, entry: DealEntry.Out, volume: 0.1, profit: 50,  commission: -1, swap: 0 });
  const d3 = Deal.fromVO({ ...base, ticket: 3, symbol: 'GBPUSD', positionId: 20, type: DealType.Buy,  entry: DealEntry.In,  volume: 0.2, profit: 0,   commission: -2, swap: 0 });
  const d4 = Deal.fromVO({ ...base, ticket: 4, symbol: 'GBPUSD', positionId: 20, type: DealType.Sell, entry: DealEntry.Out, volume: 0.2, profit: -30, commission: -2, swap: 0 });

  const pool = new DealPool([d1, d2, d3, d4]);

  it('size / isEmpty', () => {
    expect(new DealPool([]).isEmpty).toBe(true);
    expect(pool.size).toBe(4);
    expect(pool.isEmpty).toBe(false);
  });

  it('count() total and with matcher', () => {
    expect(pool.count()).toBe(4);
    expect(pool.count(dealBuyMatcher)).toBe(2);
  });

  it('find() by ticket', () => {
    expect(pool.find(d => d.ticket === 3)).toBe(d3);
    expect(pool.find(d => d.ticket === 99)).toBeUndefined();
  });

  it('has() true / false', () => {
    expect(pool.has(entryMatcher)).toBe(true);
    expect(pool.has(d => d.ticket === 99)).toBe(false);
  });

  it('filter(entryMatcher)', () => {
    const entries = pool.filter(entryMatcher);
    expect(entries.size).toBe(2);
    expect(entries.has(exitMatcher)).toBe(false);
  });

  it('filter(exitMatcher)', () => {
    const exits = pool.filter(exitMatcher);
    expect(exits.size).toBe(2);
    expect(exits.has(entryMatcher)).toBe(false);
  });

  it('for...of iteration', () => {
    const tickets: number[] = [];
    for (const d of pool) tickets.push(d.ticket);
    expect(tickets).toEqual([1, 2, 3, 4]);
  });

  it('map() extracts volumes', () => {
    expect(pool.map(d => d.volume)).toEqual([0.1, 0.1, 0.2, 0.2]);
  });

  it('reduce() sums volumes', () => {
    expect(pool.reduce((n, d) => n + d.volume, 0)).toBeCloseTo(0.6);
  });

  it('totalVolume()', () => {
    expect(pool.totalVolume()).toBeCloseTo(0.6);
  });

  it('totalNetProfit()', () => {
    // d1: -1, d2: 49, d3: -2, d4: -32 → 14
    expect(pool.totalNetProfit()).toBeCloseTo(14);
  });

  it('toArray() returns raw array', () => {
    expect(pool.toArray()).toEqual([d1, d2, d3, d4]);
  });

  it('groupBySymbol() partitions correctly', () => {
    const bySymbol = pool.groupBySymbol();
    expect(bySymbol.size).toBe(2);
    expect(bySymbol.get('EURUSD')?.size).toBe(2);
    expect(bySymbol.get('GBPUSD')?.size).toBe(2);
    expect(bySymbol.get('EURUSD')?.find(d => d.ticket === 1)).toBe(d1);
  });

  it('groupByPosition() partitions correctly', () => {
    const byPos = pool.groupByPosition();
    expect(byPos.size).toBe(2);
    expect(byPos.get(10)?.size).toBe(2);
    expect(byPos.get(20)?.size).toBe(2);
    expect(byPos.get(10)?.find(d => d.ticket === 2)).toBe(d2);
  });

  it('groupBySymbol() sub-pools support further filter', () => {
    const gbpPool = pool.groupBySymbol().get('GBPUSD')!;
    expect(gbpPool.filter(exitMatcher).size).toBe(1);
  });

  it('vwap() volume-weighted average of deal.price', () => {
    // d1: vol=0.1, price=0; d2: vol=0.1, price=0; d3: vol=0.2, price=0; d4: vol=0.2, price=0
    // all prices are 0 in base fixtures — use a dedicated pool for this test
    const base2 = DealInfoVOFactory.make({ userId: 'u1', symbol: 'EURUSD' });
    const e1 = Deal.fromVO({ ...base2, ticket: 10, entry: DealEntry.In,  volume: 0.1, price: 1.10 });
    const e2 = Deal.fromVO({ ...base2, ticket: 11, entry: DealEntry.In,  volume: 0.2, price: 1.12 });
    const e3 = Deal.fromVO({ ...base2, ticket: 12, entry: DealEntry.In,  volume: 0.3, price: 1.15 });
    const entryPool = new DealPool([e1, e2, e3]);
    // (0.1*1.10 + 0.2*1.12 + 0.3*1.15) / 0.6 = 0.679 / 0.6 = 1.13166̄ ≈ 1.1317 (4 dp)
    expect(entryPool.vwap()).toBeCloseTo(1.1317, 4);
  });

  it('vwap() returns 0 for empty pool', () => {
    expect(new DealPool([]).vwap()).toBe(0);
  });

  it('InOut deal satisfies both entryMatcher and exitMatcher', () => {
    const base2 = DealInfoVOFactory.make({ userId: 'u1', symbol: 'EURUSD' });
    const inOut = Deal.fromVO({ ...base2, ticket: 20, entry: DealEntry.InOut, volume: 0.1, price: 1.10 });
    const mixed = new DealPool([inOut]);
    expect(mixed.has(entryMatcher)).toBe(true);
    expect(mixed.has(exitMatcher)).toBe(true);
    // filter by entry keeps the deal; filter by exit also keeps it
    expect(mixed.filter(entryMatcher).size).toBe(1);
    expect(mixed.filter(exitMatcher).size).toBe(1);
    // composed filter: entryMatcher AND exitMatcher still keeps it (InOut satisfies both)
    expect(mixed.filter(entryMatcher).filter(exitMatcher).size).toBe(1);
  });
});
