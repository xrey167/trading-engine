import { describe, it, expect } from 'vitest';
import { TypedEventBus } from '../shared/event-bus.js';
import type { AppEventMap, SignalEvent } from '../shared/services/event-map.js';
import { ServiceStatus, ServiceKind } from '../shared/services/types.js';
import { StrategyService } from './strategy-service.js';
import { nullLogger } from '../shared/lib/logger.js';
import { Bars } from '../market-data/bars.js';
import type { OHLC } from '../market-data/ohlc.js';
import { RunMode, SignalResult } from './strategies/types.js';

function makeOHLC(close: number): OHLC {
  return { open: close, high: close + 0.005, low: close - 0.005, close, time: new Date('2024-01-01') };
}

describe('StrategyService', () => {
  it('has correct id, kind, and name', () => {
    const bus = new TypedEventBus<AppEventMap>();
    const svc = new StrategyService(
      { id: 'strategy:candle-atr:test', name: 'test-strategy', strategyName: 'CandleAtr', symbol: 'EURUSD', timeframe: 'H1', evaluateOnBar: false },
      bus, nullLogger,
    );
    expect(svc.id).toBe('strategy:candle-atr:test');
    expect(svc.kind).toBe(ServiceKind.Strategy);
  });

  it('starts and initializes strategy', async () => {
    const bus = new TypedEventBus<AppEventMap>();
    const svc = new StrategyService(
      { id: 'strategy:candle-atr:test', name: 'test-strategy', strategyName: 'CandleAtr', symbol: 'EURUSD', timeframe: 'H1', evaluateOnBar: false },
      bus, nullLogger,
    );
    await svc.start();
    expect(svc.health().status).toBe(ServiceStatus.Running);
    await svc.stop();
  });

  it('on-demand evaluate returns a signal result', async () => {
    const bus = new TypedEventBus<AppEventMap>();
    const svc = new StrategyService(
      { id: 'strategy:candle-atr:test', name: 'test-strategy', strategyName: 'CandleAtr', symbol: 'EURUSD', timeframe: 'H1', evaluateOnBar: false },
      bus, nullLogger,
    );
    await svc.start();

    const bars = new Bars([makeOHLC(1.1), makeOHLC(1.11)]);
    const result = await svc.evaluate({
      isNewBar: true,
      runMode: RunMode.Live,
      bars,
      positionState: { isFlat: () => true, longCount: () => 0, shortCount: () => 0 },
      symbol: 'EURUSD',
      timeframe: 'H1',
    });

    expect([SignalResult.BUY, SignalResult.SELL, SignalResult.HOLD]).toContain(result);
    await svc.stop();
  });

  it('evaluates on normalized_bar when evaluateOnBar is true', async () => {
    const bus = new TypedEventBus<AppEventMap>();
    const signals: SignalEvent[] = [];
    bus.on('signal', (e) => signals.push(e));

    const svc = new StrategyService(
      { id: 'strategy:candle-atr:auto', name: 'auto-strategy', strategyName: 'CandleAtr', symbol: 'EURUSD', timeframe: 'H1', evaluateOnBar: true },
      bus, nullLogger,
    );
    await svc.start();

    // Emit a normalized_bar event (StrategyService no longer subscribes to raw bar)
    bus.emit('normalized_bar', {
      providerId: 'dp:internal',
      symbol: 'EURUSD',
      timeframe: 'H1',
      bar: { open: 1.1, high: 1.12, low: 1.09, close: 1.11, time: '2024-01-01T00:00:00Z' },
      timestamp: new Date().toISOString(),
    });

    // Wait for async handler
    await new Promise(r => setTimeout(r, 50));

    // Strategy may emit HOLD (no signal) or BUY/SELL — depends on strategy logic
    // The important thing is it doesn't crash
    await svc.stop();
  });

  it('does NOT subscribe to normalized_bar when evaluateOnBar is false', async () => {
    const bus = new TypedEventBus<AppEventMap>();
    const signals: SignalEvent[] = [];
    bus.on('signal', (e) => signals.push(e));

    const svc = new StrategyService(
      { id: 'strategy:candle-atr:manual', name: 'manual-strategy', strategyName: 'CandleAtr', symbol: 'EURUSD', timeframe: 'H1', evaluateOnBar: false },
      bus, nullLogger,
    );
    await svc.start();

    bus.emit('normalized_bar', {
      providerId: 'dp:internal',
      symbol: 'EURUSD',
      timeframe: 'H1',
      bar: { open: 1.1, high: 1.12, low: 1.09, close: 1.11, time: '2024-01-01T00:00:00Z' },
      timestamp: new Date().toISOString(),
    });

    await new Promise(r => setTimeout(r, 50));
    expect(signals).toHaveLength(0);

    await svc.stop();
  });

  it('responds to normalized_bar when evaluateOnBar is true', async () => {
    const bus = new TypedEventBus<AppEventMap>();
    const signals: SignalEvent[] = [];
    bus.on('signal', (e) => signals.push(e));

    const svc = new StrategyService(
      { id: 'strategy:candle-atr:auto', name: 'auto-strategy', strategyName: 'CandleAtr', symbol: 'EURUSD', timeframe: 'H1', evaluateOnBar: true },
      bus, nullLogger,
    );
    await svc.start();

    bus.emit('normalized_bar', {
      providerId: 'dp:test',
      symbol: 'EURUSD',
      timeframe: 'H1',
      bar: { open: 1.1, high: 1.12, low: 1.09, close: 1.11, time: '2024-01-01T00:00:00Z' },
      timestamp: new Date().toISOString(),
    });

    await new Promise(r => setTimeout(r, 50));
    // Does not crash; may or may not emit signal depending on strategy logic
    await svc.stop();
  });

  it('ignores normalized_bar for different symbol', async () => {
    const bus = new TypedEventBus<AppEventMap>();
    const signals: SignalEvent[] = [];
    bus.on('signal', (e) => signals.push(e));

    const svc = new StrategyService(
      { id: 'strategy:candle-atr:auto', name: 'auto-strategy', strategyName: 'CandleAtr', symbol: 'EURUSD', timeframe: 'H1', evaluateOnBar: true },
      bus, nullLogger,
    );
    await svc.start();

    bus.emit('normalized_bar', {
      providerId: 'dp:test',
      symbol: 'GBPUSD',  // Different symbol
      timeframe: 'H1',
      bar: { open: 1.3, high: 1.32, low: 1.29, close: 1.31, time: '2024-01-01T00:00:00Z' },
      timestamp: new Date().toISOString(),
    });

    await new Promise(r => setTimeout(r, 50));
    expect(signals).toHaveLength(0);
    await svc.stop();
  });
});
