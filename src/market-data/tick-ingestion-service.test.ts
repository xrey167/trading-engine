import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TickIngestionService } from './tick-ingestion-service.js';
import { TypedEventBus } from '../shared/event-bus.js';
import type { AppEventMap } from '../shared/services/event-map.js';

const makeTickEvent = (bid: number, ask: number): AppEventMap['tick'] => ({
  providerId: 'test',
  symbol: 'EURUSD',
  bid,
  ask,
  timestamp: new Date().toISOString(),
});

describe('TickIngestionService', () => {
  let bus: TypedEventBus<AppEventMap>;
  let onTick: ReturnType<typeof vi.fn>;
  let runExclusive: ReturnType<typeof vi.fn>;
  let svc: TickIngestionService;

  beforeEach(() => {
    bus = new TypedEventBus<AppEventMap>();
    onTick = vi.fn().mockResolvedValue(undefined);
    runExclusive = vi.fn((fn: () => unknown) => fn());
    svc = new TickIngestionService(
      { onTick } as any,
      { runExclusive } as any,
      bus,
      { error: vi.fn(), info: vi.fn() } as any,
    );
  });

  it('calls engine.onTick with mid price after start', async () => {
    await svc.start();
    bus.emit('tick', makeTickEvent(1.1000, 1.1002));
    await new Promise(r => setImmediate(r));
    expect(onTick).toHaveBeenCalledWith(1.1001, expect.any(Date));
  });

  it('does NOT call engine.onTick before start', async () => {
    bus.emit('tick', makeTickEvent(1.1000, 1.1002));
    await new Promise(r => setImmediate(r));
    expect(onTick).not.toHaveBeenCalled();
  });

  it('stops listening after stop()', async () => {
    await svc.start();
    await svc.stop();
    bus.emit('tick', makeTickEvent(1.1000, 1.1002));
    await new Promise(r => setImmediate(r));
    expect(onTick).not.toHaveBeenCalled();
  });

  it('increments ticksProcessed health counter', async () => {
    await svc.start();
    bus.emit('tick', makeTickEvent(1.1000, 1.1002));
    await new Promise(r => setImmediate(r));
    const h = svc.getHealthMetadata();
    expect(h['ticksProcessed']).toBe(1);
  });

  it('catches and logs onTick errors', async () => {
    onTick.mockRejectedValueOnce(new Error('engine error'));
    await svc.start();
    bus.emit('tick', makeTickEvent(1.1000, 1.1002));
    await new Promise(r => setImmediate(r));
    expect(svc.getHealthMetadata()['ticksProcessed']).toBe(0);
  });

  it('runs onTick inside mutex.runExclusive', async () => {
    await svc.start();
    bus.emit('tick', makeTickEvent(1.1000, 1.1002));
    await new Promise(r => setImmediate(r));
    expect(runExclusive).toHaveBeenCalledTimes(1);
  });
});
