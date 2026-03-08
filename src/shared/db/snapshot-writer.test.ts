import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { nullLogger } from '../lib/logger.js';
import { TypedEventBus } from '../event-bus.js';
import type { AppEventMap, OrderEvent } from '../services/event-map.js';
import { SnapshotWriter, deriveAssetType, type SnapshotBroker } from './snapshot-writer.js';

describe('deriveAssetType', () => {
  it('classifies forex pairs', () => {
    expect(deriveAssetType('EURUSD')).toBe('forex');
    expect(deriveAssetType('GBPJPY')).toBe('forex');
  });

  it('classifies crypto', () => {
    expect(deriveAssetType('BTCUSD')).toBe('crypto');
    expect(deriveAssetType('ETHUSD')).toBe('crypto');
    expect(deriveAssetType('SOLUSD')).toBe('crypto');
  });

  it('classifies metals', () => {
    expect(deriveAssetType('XAUUSD')).toBe('metals');
    expect(deriveAssetType('XAGUSD')).toBe('metals');
  });

  it('classifies energy', () => {
    expect(deriveAssetType('BRENT')).toBe('energy');
    expect(deriveAssetType('WTICRUOIL')).toBe('energy');
  });

  it('classifies indices', () => {
    expect(deriveAssetType('US500')).toBe('indices');
    expect(deriveAssetType('NAS100')).toBe('indices');
    expect(deriveAssetType('DE40')).toBe('indices');
  });
});

describe('SnapshotWriter', () => {
  let mockDb: any;
  let mockBroker: SnapshotBroker;
  let writer: SnapshotWriter;
  let mockInsert: any;
  let mockSelect: any;

  beforeEach(() => {
    vi.useFakeTimers();

    mockInsert = {
      values: vi.fn().mockResolvedValue(undefined),
    };
    mockSelect = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
    };
    mockDb = {
      insert: vi.fn().mockReturnValue(mockInsert),
      select: vi.fn().mockReturnValue(mockSelect),
    };
    mockBroker = {
      getAccount: vi.fn().mockResolvedValue({ equity: 10_000, balance: 9_500 }),
    };

    writer = new SnapshotWriter(mockDb, mockBroker, nullLogger);
  });

  afterEach(() => {
    writer.stop();
    vi.useRealTimers();
  });

  it('captures immediately on start', () => {
    writer.start(60_000);
    expect(mockBroker.getAccount).toHaveBeenCalledTimes(1);
  });

  it('captures periodically after start', () => {
    writer.start(1000);
    expect(mockBroker.getAccount).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(1000);
    expect(mockBroker.getAccount).toHaveBeenCalledTimes(2);

    vi.advanceTimersByTime(1000);
    expect(mockBroker.getAccount).toHaveBeenCalledTimes(3);
  });

  it('does not start twice', () => {
    writer.start(1000);
    writer.start(1000);
    expect(mockBroker.getAccount).toHaveBeenCalledTimes(1);
  });

  it('stops the timer', () => {
    writer.start(1000);
    writer.stop();

    vi.advanceTimersByTime(5000);
    // Only the initial capture call
    expect(mockBroker.getAccount).toHaveBeenCalledTimes(1);
  });

  it('periodic capture includes trigger field', async () => {
    writer.start(60_000);
    // capture() is async (awaits broker.getAccount()), flush microtasks
    await vi.advanceTimersByTimeAsync(0);
    expect(mockInsert.values).toHaveBeenCalledWith(
      expect.objectContaining({ trigger: 'periodic', strategy: null, assetType: null }),
    );
  });

  it('getSnapshots queries with date filters', async () => {
    const result = await writer.getSnapshots({ from: new Date('2025-01-01'), to: new Date('2025-12-31') });

    expect(mockDb.select).toHaveBeenCalled();
    expect(mockSelect.from).toHaveBeenCalled();
    expect(mockSelect.where).toHaveBeenCalled();
    expect(result).toEqual([]);
  });

  it('getSnapshots queries with strategy filter', async () => {
    await writer.getSnapshots({ strategy: 'candle-atr' });

    expect(mockDb.select).toHaveBeenCalled();
    expect(mockSelect.where).toHaveBeenCalled();
  });

  it('getSnapshots queries with assetType filter', async () => {
    await writer.getSnapshots({ assetType: 'forex' });

    expect(mockDb.select).toHaveBeenCalled();
    expect(mockSelect.where).toHaveBeenCalled();
  });

  it('getSnapshots works without filters', async () => {
    const result = await writer.getSnapshots();

    expect(mockDb.select).toHaveBeenCalled();
    expect(result).toEqual([]);
  });

  describe('onEquityChange (event-driven capture)', () => {
    let emitter: TypedEventBus<AppEventMap>;
    const makeFilledEvent = (symbol = 'EURUSD', strategy?: string): OrderEvent => ({
      action: 'FILLED',
      orderId: 0,
      orderType: 'BUY_MARKET',
      brokerId: 'paper',
      symbol,
      direction: 'BUY',
      lots: 0.1,
      price: 1.1,
      metadata: strategy ? { strategy } : {},
      timestamp: new Date().toISOString(),
    });

    beforeEach(() => {
      emitter = new TypedEventBus<AppEventMap>();
    });

    it('captures when equity changes beyond threshold', async () => {
      // Start with emitter; initial periodic capture sets lastEquity = 10_000
      writer.start(60_000, emitter);
      await vi.advanceTimersByTimeAsync(0);

      // Simulate large equity move (>1%): 10_000 → 10_200 (2%)
      mockBroker.getAccount = vi.fn().mockResolvedValue({ equity: 10_200, balance: 9_500 });
      mockInsert.values.mockClear();

      emitter.emit('order', makeFilledEvent('EURUSD', 'candle-atr'));
      await vi.advanceTimersByTimeAsync(0);

      expect(mockInsert.values).toHaveBeenCalledWith(
        expect.objectContaining({ trigger: 'event', strategy: 'candle-atr', assetType: 'forex' }),
      );
    });

    it('skips capture when equity change is below threshold', async () => {
      writer.start(60_000, emitter);
      await vi.advanceTimersByTimeAsync(0);

      // Small move: 10_000 → 10_050 (0.5% < 1% threshold)
      mockBroker.getAccount = vi.fn().mockResolvedValue({ equity: 10_050, balance: 9_500 });
      mockInsert.values.mockClear();

      emitter.emit('order', makeFilledEvent());
      await vi.advanceTimersByTimeAsync(0);

      expect(mockInsert.values).not.toHaveBeenCalled();
    });

    it('respects cooldown between event captures', async () => {
      writer = new SnapshotWriter(mockDb, mockBroker, nullLogger, { cooldownMs: 10_000 });
      writer.start(60_000, emitter);
      await vi.advanceTimersByTimeAsync(0);

      // First event: big move triggers capture
      mockBroker.getAccount = vi.fn().mockResolvedValue({ equity: 10_200, balance: 9_500 });
      emitter.emit('order', makeFilledEvent());
      await vi.advanceTimersByTimeAsync(0);
      mockInsert.values.mockClear();

      // Second event immediately after — cooldown blocks it
      emitter.emit('order', makeFilledEvent());
      await vi.advanceTimersByTimeAsync(0);

      expect(mockInsert.values).not.toHaveBeenCalled();
    });

    it('ignores non-FILLED events', async () => {
      writer.start(60_000, emitter);
      await vi.advanceTimersByTimeAsync(0);
      mockInsert.values.mockClear();

      const placedEvent: OrderEvent = { ...makeFilledEvent(), action: 'PLACED' };
      emitter.emit('order', placedEvent);
      await vi.advanceTimersByTimeAsync(0);

      expect(mockInsert.values).not.toHaveBeenCalled();
    });

    it('stop() removes the order listener from the emitter', () => {
      writer.start(60_000, emitter);
      const countAfterStart = emitter.listenerCount('order');
      expect(countAfterStart).toBeGreaterThan(0);

      writer.stop();
      expect(emitter.listenerCount('order')).toBe(countAfterStart - 1);
    });
  });
});
