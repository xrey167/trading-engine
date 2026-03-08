import { describe, it, expect, vi } from 'vitest';
import { OrderWriter } from './order-writer.js';
import { TypedEventBus } from '../event-bus.js';
import type { AppEventMap } from '../services/event-map.js';

describe('OrderWriter', () => {
  function makeEvent(action: AppEventMap['order']['action']) {
    return {
      action,
      orderId: 42,
      orderType: 'BUY_LIMIT',
      source: 'http' as const,
      brokerId: 'paper',
      symbol: 'EURUSD',
      direction: 'BUY' as const,
      lots: 1,
      price: 1.1000,
      metadata: {},
      timestamp: new Date().toISOString(),
    };
  }

  it('inserts a row for PLACED event', async () => {
    const insertMock = { values: vi.fn().mockResolvedValue(undefined) };
    const db = { insert: vi.fn().mockReturnValue(insertMock) } as any;
    const emitter = new TypedEventBus<AppEventMap>();
    const logger = { error: vi.fn() } as any;

    new OrderWriter(db, emitter, logger);
    emitter.emit('order', makeEvent('PLACED'));
    await Promise.resolve();

    expect(db.insert).toHaveBeenCalledOnce();
    expect(insertMock.values).toHaveBeenCalledWith(
      expect.objectContaining({ orderId: 42, action: 'PLACED' })
    );
  });

  it('inserts for CANCELLED event too', async () => {
    const insertMock = { values: vi.fn().mockResolvedValue(undefined) };
    const db = { insert: vi.fn().mockReturnValue(insertMock) } as any;
    const emitter = new TypedEventBus<AppEventMap>();
    const logger = { error: vi.fn() } as any;

    new OrderWriter(db, emitter, logger);
    emitter.emit('order', makeEvent('CANCELLED'));
    await Promise.resolve();

    expect(insertMock.values).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'CANCELLED' })
    );
  });

  it('logs error on DB failure without throwing', async () => {
    const insertMock = { values: vi.fn().mockRejectedValue(new Error('db down')) };
    const db = { insert: vi.fn().mockReturnValue(insertMock) } as any;
    const emitter = new TypedEventBus<AppEventMap>();
    const logger = { error: vi.fn() } as any;

    new OrderWriter(db, emitter, logger);
    emitter.emit('order', makeEvent('CANCELLED'));
    await new Promise(r => setTimeout(r, 0));

    expect(logger.error).toHaveBeenCalled();
  });
});
