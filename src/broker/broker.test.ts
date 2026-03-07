import { describe, it, expect } from 'vitest';
import { PaperBroker } from './paper/paper-broker.js';
import { TypedEventBus } from '../shared/event-bus.js';
import { isOk, isErr } from '../shared/lib/result.js';
import type { PositionInfoVO } from '../shared/domain/position.js';
import type { AccountInfoVO } from '../shared/domain/account.js';

function makeBroker(): PaperBroker {
  return new PaperBroker(new TypedEventBus());
}

function makePosition(overrides: Partial<PositionInfoVO> = {}): PositionInfoVO {
  return {
    ticket: 1,
    userId: 'user1',
    symbol: 'EURUSD',
    type: 'BUY',
    magic: 0,
    identifier: 1,
    time: '2024-01-01T00:00:00Z',
    priceOpen: 1.1,
    priceCurrent: 1.1,
    stopLoss: 0,
    takeProfit: 0,
    priceStopLimit: 0,
    volume: 0.1,
    commission: 0,
    swap: 0,
    profit: 0,
    comment: '',
    externalId: '',
    reason: 0,
    ...overrides,
  };
}

function makeAccount(overrides: Partial<AccountInfoVO> = {}): AccountInfoVO {
  return {
    login: 1001,
    tradeMode: 'HEDGE',
    leverage: 100,
    marginMode: 0,
    stopOutMode: 0,
    marginSoMode: 0,
    tradeAllowed: true,
    tradeExpertAllowed: true,
    limitOrders: 200,
    balance: 50_000,
    credit: 0,
    profit: 0,
    equity: 50_000,
    margin: 0,
    freeMargin: 50_000,
    marginLevel: 0,
    marginInitial: 0,
    marginMaintenance: 0,
    assets: 0,
    liabilities: 0,
    commission: 0,
    currency: 'USD',
    name: 'Test Account',
    server: 'PaperServer',
    company: 'Test',
    ...overrides,
  };
}

describe('PaperBroker — Gateway methods', () => {
  describe('seedPosition + getPositions', () => {
    it('returns seeded positions filtered by userId', async () => {
      const broker = makeBroker();
      broker.seedPosition(makePosition({ ticket: 1, userId: 'user1' }));
      broker.seedPosition(makePosition({ ticket: 2, userId: 'user2' }));

      const result = await broker.getPositions('user1');
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toHaveLength(1);
        expect(result.value[0].ticket).toBe(1);
      }
    });
  });

  describe('getPositionByTicket', () => {
    it('returns position when found', async () => {
      const broker = makeBroker();
      broker.seedPosition(makePosition({ ticket: 42, userId: 'user1' }));

      const result = await broker.getPositionByTicket(42, 'user1');
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.ticket).toBe(42);
      }
    });

    it('returns NOT_FOUND when ticket does not exist', async () => {
      const broker = makeBroker();
      const result = await broker.getPositionByTicket(999, 'user1');
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.type).toBe('NOT_FOUND');
      }
    });
  });

  describe('closePositionByTicket', () => {
    it('removes position on close', async () => {
      const broker = makeBroker();
      broker.seedPosition(makePosition({ ticket: 1, userId: 'user1' }));

      const closeResult = await broker.closePositionByTicket(1, 10, 'user1');
      expect(isOk(closeResult)).toBe(true);

      const getResult = await broker.getPositions('user1');
      expect(isOk(getResult)).toBe(true);
      if (isOk(getResult)) {
        expect(getResult.value).toHaveLength(0);
      }
    });

    it('returns NOT_FOUND when ticket does not exist', async () => {
      const broker = makeBroker();
      const result = await broker.closePositionByTicket(999, 10, 'user1');
      expect(isErr(result)).toBe(true);
    });
  });

  describe('modifyPosition', () => {
    it('updates SL/TP', async () => {
      const broker = makeBroker();
      broker.seedPosition(makePosition({ ticket: 1, userId: 'user1', stopLoss: 0, takeProfit: 0 }));

      const modifyResult = await broker.modifyPosition(1, 1.05, 1.15, 'user1');
      expect(isOk(modifyResult)).toBe(true);

      const getResult = await broker.getPositionByTicket(1, 'user1');
      expect(isOk(getResult)).toBe(true);
      if (isOk(getResult)) {
        expect(getResult.value.stopLoss).toBe(1.05);
        expect(getResult.value.takeProfit).toBe(1.15);
      }
    });
  });

  describe('seedAccount + getBalance', () => {
    it('returns seeded account balance', async () => {
      const broker = makeBroker();
      broker.seedAccount(makeAccount({ balance: 25_000 }));

      const result = await broker.getBalance('user1');
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toBe(25_000);
      }
    });

    it('returns NOT_FOUND when no account seeded', async () => {
      const broker = makeBroker();
      const result = await broker.getBalance('user1');
      expect(isErr(result)).toBe(true);
    });
  });

  describe('getAccountInfo', () => {
    it('returns NOT_FOUND when no account seeded', async () => {
      const broker = makeBroker();
      const result = await broker.getAccountInfo('user1');
      expect(isErr(result)).toBe(true);
    });

    it('returns seeded account info', async () => {
      const broker = makeBroker();
      const account = makeAccount();
      broker.seedAccount(account);
      const result = await broker.getAccountInfo('user1');
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.balance).toBe(50_000);
      }
    });
  });

  describe('isReal / isHedging', () => {
    it('isReal returns false (paper broker)', async () => {
      const broker = makeBroker();
      const result = await broker.isReal('user1');
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toBe(false);
      }
    });

    it('isHedging returns true', async () => {
      const broker = makeBroker();
      const result = await broker.isHedging('user1');
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toBe(true);
      }
    });
  });

  describe('seedSymbol + getSymbolInfo', () => {
    it('returns seeded symbol', async () => {
      const broker = makeBroker();
      broker.seedSymbol({
        name: 'EURUSD',
        description: 'Euro vs US Dollar',
        digits: 5,
        point: 0.00001,
        tickSize: 0.00001,
        tickValue: 1,
        spread: 10,
        spreadFloat: true,
        lotsMin: 0.01,
        lotsMax: 100,
        lotsStep: 0.01,
        contractSize: 100_000,
        bid: 1.1,
        ask: 1.10010,
        currencyBase: 'EUR',
        currencyProfit: 'USD',
        currencyMargin: 'EUR',
      });
      const result = await broker.getSymbolInfo('EURUSD');
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.name).toBe('EURUSD');
        expect(result.value.digits).toBe(5);
      }
    });

    it('returns NOT_FOUND for unknown symbol', async () => {
      const broker = makeBroker();
      const result = await broker.getSymbolInfo('XYZABC');
      expect(isErr(result)).toBe(true);
    });
  });

  describe('seedBars + getBars', () => {
    it('returns Bars instance from seeded data', async () => {
      const broker = makeBroker();
      const ohlcData = [
        { open: 1.0, high: 1.1, low: 0.9, close: 1.05, time: new Date('2024-01-01') },
        { open: 1.05, high: 1.15, low: 0.95, close: 1.1, time: new Date('2024-01-02') },
      ];
      broker.seedBars('EURUSD', 'H1', ohlcData);

      const result = await broker.getBars('EURUSD', 'H1');
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.length).toBe(2);
        expect(result.value.close(0)).toBe(1.05);
      }
    });

    it('returns NOT_FOUND for unseeded symbol/timeframe', async () => {
      const broker = makeBroker();
      const result = await broker.getBars('EURUSD', 'D1');
      expect(isErr(result)).toBe(true);
    });
  });

  describe('refreshRates', () => {
    it('returns tick based on current price', async () => {
      const broker = makeBroker();
      broker.setPrice(1.10000);
      const result = await broker.refreshRates('EURUSD');
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.bid).toBe(1.10000);
        expect(result.value.ask).toBeCloseTo(1.10010, 5);
      }
    });
  });

  describe('placeOrder', () => {
    it('places a market order and returns result', async () => {
      const broker = makeBroker();
      broker.setPrice(1.1);
      const result = await broker.placeOrder({
        userId: 'user1',
        symbol: 'EURUSD',
        direction: 'BUY',
        lots: 0.1,
        price: 1.1,
        stopLoss: 1.05,
        takeProfit: 1.15,
        magic: 0,
        deviation: 10,
        comment: 'test order',
        orderType: 'MARKET',
        filling: 'FOK',
        asyncMode: false,
      });
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.retcode).toBe(10009);
        expect(result.value.price).toBe(1.1);
        expect(result.value.volume).toBe(0.1);
      }
    });
  });

  describe('connect / disconnect / isConnected', () => {
    it('lifecycle methods work', async () => {
      const broker = makeBroker();
      await broker.connect();
      expect(broker.isConnected()).toBe(true);
      await broker.disconnect();
    });
  });
});
