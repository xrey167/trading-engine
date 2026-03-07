import { describe, it, expect, vi, beforeEach } from 'vitest';
import { nullLogger } from '../lib/logger.js';
import { TypedEventBus } from '../event-bus.js';
import type { AppEventMap, OrderEvent } from '../services/event-map.js';
import { DealWriter } from './deal-writer.js';

function makeOrderEvent(overrides: Partial<OrderEvent> = {}): OrderEvent {
  return {
    action: 'FILLED',
    brokerId: 'paper',
    symbol: 'EURUSD',
    direction: 'BUY',
    lots: 0.1,
    price: 1.1234,
    metadata: { ticket: 1001, profit: 50, swap: 0, commission: -2 },
    timestamp: '2025-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('DealWriter', () => {
  let emitter: TypedEventBus<AppEventMap>;
  let mockDb: any;
  let mockInsert: any;

  beforeEach(() => {
    emitter = new TypedEventBus<AppEventMap>();
    mockInsert = {
      values: vi.fn().mockReturnValue(Promise.resolve()),
    };
    mockDb = {
      insert: vi.fn().mockReturnValue(mockInsert),
    };
  });

  it('subscribes to order events on construction', () => {
    const onSpy = vi.spyOn(emitter, 'on');
    new DealWriter(mockDb, emitter, nullLogger);
    expect(onSpy).toHaveBeenCalledWith('order', expect.any(Function));
  });

  it('writes FILLED orders to the database', () => {
    new DealWriter(mockDb, emitter, nullLogger);
    emitter.emit('order', makeOrderEvent());

    expect(mockDb.insert).toHaveBeenCalled();
    expect(mockInsert.values).toHaveBeenCalledWith(
      expect.objectContaining({
        ticket: 1001,
        symbol: 'EURUSD',
        type: 'BUY',
        volume: 0.1,
        price: 1.1234,
      }),
    );
  });

  it('ignores non-FILLED orders', () => {
    new DealWriter(mockDb, emitter, nullLogger);

    emitter.emit('order', makeOrderEvent({ action: 'PLACED' }));
    emitter.emit('order', makeOrderEvent({ action: 'REJECTED' }));
    emitter.emit('order', makeOrderEvent({ action: 'CANCELLED' }));

    expect(mockDb.insert).not.toHaveBeenCalled();
  });
});
