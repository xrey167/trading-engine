import { describe, it, expect, vi } from 'vitest';
import { AtrModule } from './atr-module.js';
import type { AtrModuleConfig } from './atr-module.js';
import { TradingEngine } from './trading-engine.js';
import type { IBrokerAdapter } from './trading-engine.js';
import { Bars } from '../../market-data/bars.js';
import type { OHLC } from '../../market-data/ohlc.js';
import { AtrMethod, BarsAtrMode, BarBase } from '../../shared/domain/engine-enums.js';
import { SymbolInfoForex } from './symbol.js';

// ─────────────────────────────────────────────────────────────
// Shared test helpers
// ─────────────────────────────────────────────────────────────

function makeOHLC(
  close: number,
  opts: { high?: number; low?: number; open?: number } = {},
): OHLC {
  return {
    open:  opts.open  ?? close,
    high:  opts.high  ?? close,
    low:   opts.low   ?? close,
    close,
    time:  new Date('2024-01-01'),
  };
}

/** Index 0 = most-recent bar. */
function makeBars(
  closes: number[],
  highs?: number[],
  lows?: number[],
): Bars {
  const data: OHLC[] = closes.map((c, i) =>
    makeOHLC(c, { high: highs?.[i] ?? c, low: lows?.[i] ?? c }),
  );
  return new Bars(data);
}

function mockBroker(fillPrice = 1.1000): IBrokerAdapter {
  return {
    marketOrder:   vi.fn(async () => ({ price: fillPrice, time: new Date(), id: 'fill' })),
    closePosition: vi.fn(async () => ({ price: fillPrice })),
    updateSLTP:    vi.fn(async () => {}),
    getSpread:     vi.fn(async () => 0),
    getAccount:    vi.fn(async () => ({ equity: 10_000, balance: 10_000 })),
  };
}

const EURUSD5 = new SymbolInfoForex('EURUSD', 5); // pointSize = 0.00001

// ─────────────────────────────────────────────────────────────
// P17 – AtrModule.onBar: applies ATR-scaled SL offset
// ─────────────────────────────────────────────────────────────

describe('P17 – AtrModule.onBar applies ATR-scaled SL offset to engine', () => {
  it('slMultiplier=2 with ATR≈100pts → engine.sl(200) → SL ≈ fill − 0.00200', async () => {
    const fillPrice = 1.10000;
    const broker = mockBroker(fillPrice);
    const eng = new TradingEngine(EURUSD5, broker);

    // 16 bars all uniform: range = 0.0010, close = 1.1000
    // atr(14, shift=1) = avg of TRs at positions 1..14 = 14 × 0.001 / 14 = 0.001
    // ATR in points = 0.001 / 0.00001 = 100 pts
    const bars = makeBars(
      Array(16).fill(1.10000),
      Array(16).fill(1.10050),
      Array(16).fill(1.09950),
    );

    const cfg: AtrModuleConfig = {
      period: 14, method: AtrMethod.Sma, shift: 1,
      slMultiplier: 2, tpMultiplier: 0,
      trailBeginMultiplier: 0, trailDistMultiplier: 0,
      onlyWhenFlat: false,
      barsAtrMode: BarsAtrMode.Normal,
      barBase: BarBase.HiLo,
    };
    const mod = new AtrModule(cfg, eng, EURUSD5);
    mod.onBar(bars);           // sets sl(200) on the engine
    await eng.buy();           // fills at 1.1000 → SL = 1.1000 − 0.00200 = 1.09800

    expect(eng.getSLBuy()).toBeCloseTo(1.09800, 5);
  });
});

// ─────────────────────────────────────────────────────────────
// P18 – AtrModule.onBar: onlyWhenFlat=true skips update
// ─────────────────────────────────────────────────────────────

describe('P18 – AtrModule.onBar onlyWhenFlat=true skips SL update when position open', () => {
  it('SL is not overwritten when position is open and onlyWhenFlat=true', async () => {
    const fillPrice = 1.10000;
    const broker = mockBroker(fillPrice);
    const eng = new TradingEngine(EURUSD5, broker);

    // Set initial SL offset of 100 pts, then open position
    eng.sl(100);                   // SL offset = 100 pts
    await eng.buy();               // fills at 1.1000 → SL = 1.1000 − 0.001 = 1.09900

    // 16 uniform bars producing ATR = 100 pts again
    const bars = makeBars(
      Array(16).fill(1.10000),
      Array(16).fill(1.10050),
      Array(16).fill(1.09950),
    );

    // AtrModule with slMultiplier=3 (would set sl(300) = SL 1.0970), onlyWhenFlat=true
    const cfg: AtrModuleConfig = {
      period: 14, method: AtrMethod.Sma, shift: 1,
      slMultiplier: 3, tpMultiplier: 0,
      trailBeginMultiplier: 0, trailDistMultiplier: 0,
      onlyWhenFlat: true,
      barsAtrMode: BarsAtrMode.Normal,
      barBase: BarBase.HiLo,
    };
    const mod = new AtrModule(cfg, eng, EURUSD5);
    mod.onBar(bars);  // position is open → update skipped

    // SL should remain at the original 1.09900, not 1.0970
    expect(eng.getSLBuy()).toBeCloseTo(1.09900, 5);
  });
});
