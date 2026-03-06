import { describe, it, expect } from 'vitest';
import { CandleAtrStrategy } from './candle-atr.js';
import { VolumeBreakoutStrategy } from './volume-breakout.js';
import { SignalResult, RunMode, type IPositionState } from './types.js';
import { nullLogger } from '../lib/logger.js';
import type { OHLC } from '../../trading-engine.js';
import { makeOHLC, makeBars } from '../testing/factories.js';

const flatState: IPositionState = { isFlat: () => true, longCount: () => 0, shortCount: () => 0 };
const longState: IPositionState = { isFlat: () => false, longCount: () => 1, shortCount: () => 0 };
const shortState: IPositionState = { isFlat: () => false, longCount: () => 0, shortCount: () => 1 };

describe('CandleAtrStrategy', () => {
  it('returns HOLD when insufficient bars', async () => {
    const strategy = new CandleAtrStrategy({}, nullLogger);
    await strategy.initialize();
    const bars = makeBars([makeOHLC(1.1)]);
    const result = await strategy.evaluate({
      isNewBar: true,
      runMode: RunMode.Live,
      bars,
      positionState: flatState,
      symbol: 'EURUSD',
      timeframe: 'H1',
    });
    expect(result).toBe(SignalResult.HOLD);
  });

  it('initialize is a no-op', async () => {
    const strategy = new CandleAtrStrategy({}, nullLogger);
    await expect(strategy.initialize()).resolves.toBeUndefined();
  });
});

describe('VolumeBreakoutStrategy', () => {
  it('returns HOLD when insufficient bars for volume average', async () => {
    const strategy = new VolumeBreakoutStrategy({ lookback: 20 }, nullLogger);
    await strategy.initialize();
    const bars = makeBars([makeOHLC(1.1, { volume: 100 })]);
    const result = await strategy.evaluate({
      isNewBar: true,
      runMode: RunMode.Live,
      bars,
      positionState: flatState,
      symbol: 'EURUSD',
      timeframe: 'H1',
    });
    expect(result).toBe(SignalResult.HOLD);
  });

  it('returns HOLD when not flat', async () => {
    const data: OHLC[] = [];
    for (let i = 0; i < 25; i++) {
      data.push(makeOHLC(1.0 + i * 0.001, { volume: 100 }));
    }
    const bars = makeBars(data);
    const strategy = new VolumeBreakoutStrategy({ lookback: 20, multiplier: 1.5 }, nullLogger);
    await strategy.initialize();
    // First call with isNewBar to set cached average
    await strategy.evaluate({
      isNewBar: true,
      runMode: RunMode.Live,
      bars,
      positionState: flatState,
      symbol: 'EURUSD',
      timeframe: 'H1',
    });
    // Second call with long position
    const result = await strategy.evaluate({
      isNewBar: false,
      runMode: RunMode.Live,
      bars,
      positionState: longState,
      symbol: 'EURUSD',
      timeframe: 'H1',
    });
    expect(result).toBe(SignalResult.HOLD);
  });

  it('returns BUY on bullish volume breakout', async () => {
    const data: OHLC[] = [];
    // 20 bars with volume 100
    for (let i = 0; i < 20; i++) {
      data.push(makeOHLC(1.0, { volume: 100 }));
    }
    // Current bar: bullish with high volume (> 100 * 1.5 = 150)
    data.unshift(makeOHLC(1.05, { open: 1.0, high: 1.06, low: 0.99, volume: 200 }));
    const bars = makeBars(data);
    const strategy = new VolumeBreakoutStrategy({ lookback: 20, multiplier: 1.5, minBodyRange: 0 }, nullLogger);
    await strategy.initialize();
    const result = await strategy.evaluate({
      isNewBar: true,
      runMode: RunMode.Live,
      bars,
      positionState: flatState,
      symbol: 'EURUSD',
      timeframe: 'H1',
    });
    expect(result).toBe(SignalResult.BUY);
  });

  it('returns SELL on bearish volume breakout', async () => {
    const data: OHLC[] = [];
    for (let i = 0; i < 20; i++) {
      data.push(makeOHLC(1.0, { volume: 100 }));
    }
    // Current bar: bearish with high volume
    data.unshift(makeOHLC(0.95, { open: 1.0, high: 1.01, low: 0.94, volume: 200 }));
    const bars = makeBars(data);
    const strategy = new VolumeBreakoutStrategy({ lookback: 20, multiplier: 1.5, minBodyRange: 0 }, nullLogger);
    await strategy.initialize();
    const result = await strategy.evaluate({
      isNewBar: true,
      runMode: RunMode.Live,
      bars,
      positionState: flatState,
      symbol: 'EURUSD',
      timeframe: 'H1',
    });
    expect(result).toBe(SignalResult.SELL);
  });

  it('initialize resets cached volume', async () => {
    const strategy = new VolumeBreakoutStrategy({}, nullLogger);
    await strategy.initialize();
    // After initialize, cachedAverageVolume should be 0
    const bars = makeBars([makeOHLC(1.0, { volume: 100 })]);
    const result = await strategy.evaluate({
      isNewBar: false, // not new bar, so cached volume stays 0
      runMode: RunMode.Live,
      bars,
      positionState: flatState,
      symbol: 'EURUSD',
      timeframe: 'H1',
    });
    expect(result).toBe(SignalResult.HOLD);
  });
});
