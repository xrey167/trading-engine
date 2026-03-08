import { describe, it, expect } from 'vitest';
import { CandleAtrStrategy } from './candle-atr.js';
import { VolumeBreakoutStrategy } from './volume-breakout.js';
import { SignalResult, RunMode, type IPositionState } from './types.js';
import { nullLogger } from '../../shared/lib/logger.js';
import type { OHLC } from '../../market-data/ohlc.js';
import { makeOHLC, makeBars } from '../../shared/testing/factories.js';

const flatState: IPositionState = { isFlat: () => true, longCount: () => 0, shortCount: () => 0 };
const longState: IPositionState = { isFlat: () => false, longCount: () => 1, shortCount: () => 0 };
const _shortState: IPositionState = { isFlat: () => false, longCount: () => 0, shortCount: () => 1 };

/**
 * Build a Bars array suitable for CandleAtr tests.
 *
 * Layout (Bars index 0 = most-recent):
 *   index 0 — currentBar  (caller-supplied range, direction irrelevant for filter)
 *   index 1 — prevBar     (candlestick pattern bar; range controls ATR filter)
 *   index 2..N — background bars used for ATR calculation
 *
 * Background bars: open=close=1.0, high=1.005, low=0.995 → range≈0.010.
 * With 14 such bars the simple ATR ≈ 0.010.
 * ATR threshold (atrMultiplier=2.0) ≈ 0.020.
 */
function makeCandleAtrBars(
  prevBarOpts: { open: number; high: number; low: number; close: number },
  currentBarOpts: { open: number; high: number; low: number; close: number } = {
    open: 1.0,
    high: 1.003,
    low: 0.997,
    close: 1.0,
  },
): ReturnType<typeof makeBars> {
  // 14 background bars at indices 2..15 (needed by calculateATR(bars, 14, shift=1))
  // Background: range≈0.010 → ATR≈0.010; threshold at atrMultiplier=2.0 is 0.020
  const data: OHLC[] = [
    makeOHLC(currentBarOpts.close, { open: currentBarOpts.open, high: currentBarOpts.high, low: currentBarOpts.low }),
    makeOHLC(prevBarOpts.close, { open: prevBarOpts.open, high: prevBarOpts.high, low: prevBarOpts.low }),
    ...Array.from({ length: 14 }, () => makeOHLC(1.0, { high: 1.005, low: 0.995 })),
  ];
  return makeBars(data);
}

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

  it('ATR range filter uses prevBar: returns SELL when prevBar has large range matching bearish pattern', async () => {
    // prevBar: bearish, large range (0.030 > ATR≈0.010 * 2.0 = 0.020), small tail
    // open=1.010, high=1.0101, low=0.980, close=0.985
    // range=0.0301, tailRange=close-low=0.005, tailPart≈0.166 < 0.5 ✓
    // prevBar.low=0.980 is lowest of indices 1..6 → isLocalLow(5,1) = true ✓
    // currentBar has tiny range (0.006) — irrelevant after fix, would have blocked with old code
    const bars = makeCandleAtrBars(
      { open: 1.010, high: 1.0101, low: 0.980, close: 0.985 },
      { open: 1.0, high: 1.003, low: 0.997, close: 1.0 },
    );
    const strategy = new CandleAtrStrategy({}, nullLogger);
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

  it('ATR range filter uses prevBar: returns HOLD when prevBar has small range even if pattern matches', async () => {
    // prevBar: bearish but tiny range (0.003 < ATR≈0.010 * 2.0 = 0.020) → HOLD from filter
    // currentBar has a large range — with the old (buggy) code this would pass the filter
    const bars = makeCandleAtrBars(
      { open: 1.002, high: 1.0021, low: 0.999, close: 0.9995 },
      { open: 1.0, high: 1.030, low: 0.970, close: 1.0 }, // large current range
    );
    const strategy = new CandleAtrStrategy({}, nullLogger);
    await strategy.initialize();
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
