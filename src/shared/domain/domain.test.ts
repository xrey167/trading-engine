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
import { SymbolInfoVOSchema, TickSchema } from './symbol/symbol.js';;
import { MoneyManagementFactoryConfigSchema } from '../../trading/money-management/types.js';

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
