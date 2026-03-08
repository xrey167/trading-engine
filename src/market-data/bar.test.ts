import { describe, it, expect } from 'vitest';
import { Bar } from '../shared/domain/bar/bar.js';
import { BarBase } from '../shared/domain/engine-enums.js';

// ─────────────────────────────────────────────────────────────
// T1.1 – Bar: BarBase-aware range, proportions, patterns
// ─────────────────────────────────────────────────────────────

describe('T1.1 – Bar BarBase support', () => {
  // bar: open=1.1000, high=1.1050, low=1.0950, close=1.1030
  // hi-lo range = 0.0100, body range = 0.0030
  const bar = new Bar(1.1000, 1.1050, 1.0950, 1.1030, new Date());

  it('effectiveHigh/Low with HiLo returns high/low', () => {
    expect(bar.effectiveHigh()).toBe(1.1050);
    expect(bar.effectiveLow()).toBe(1.0950);
  });

  it('effectiveHigh/Low with OpenClose returns max/min of open,close', () => {
    expect(bar.effectiveHigh(BarBase.OpenClose)).toBe(1.1030); // max(1.1000, 1.1030)
    expect(bar.effectiveLow(BarBase.OpenClose)).toBe(1.1000);  // min(1.1000, 1.1030)
  });

  it('range(HiLo) returns high-low', () => {
    expect(bar.range()).toBeCloseTo(0.0100, 5);
  });

  it('range(OpenClose) returns body range', () => {
    expect(bar.range(BarBase.OpenClose)).toBeCloseTo(0.0030, 5);
  });

  it('bodyPart with OpenClose base = 1.0 (body is the entire range)', () => {
    expect(bar.bodyPart(BarBase.OpenClose)).toBeCloseTo(1.0, 5);
  });

  it('bodyPart with HiLo base < 1.0', () => {
    expect(bar.bodyPart()).toBeCloseTo(0.003 / 0.01, 5); // 0.3
  });

  it('pattern methods accept base parameter', () => {
    // Hammer with large tail relative to body-only range
    const hammerBar = new Bar(1.1000, 1.1010, 1.0900, 1.1005, new Date());
    // HiLo: tailPart = (1.1000-1.0900)/0.0110 ≈ 0.909 → hammer
    expect(hammerBar.isHammer(0.55)).toBe(true);
    // OpenClose: range = |1.1005-1.1000| = 0.0005, tailRange = 1.1000-1.0900 = 0.0100
    // tailPart = 0.0100/0.0005 = 20.0 → still hammer (but proportions change drastically)
    expect(hammerBar.isHammer(0.55, BarBase.OpenClose)).toBe(true);
  });

  it('isSolid accepts base parameter', () => {
    // Bar with tiny wicks relative to hi-lo
    const solidBar = new Bar(1.0950, 1.1050, 1.0950, 1.1050, new Date());
    expect(solidBar.isSolid(0.01, 0.01)).toBe(true);
    expect(solidBar.isSolid(0.01, 0.01, BarBase.OpenClose)).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────
// T3.1 – Bar: fiboPrice & pivotPrice
// ─────────────────────────────────────────────────────────────

describe('T3.1 – Bar.fiboPrice & pivotPrice', () => {
  const bar = new Bar(1.1, 1.5, 1.0, 1.3, new Date());

  it('fiboPrice at 0 = low', () => {
    expect(bar.fiboPrice(0)).toBeCloseTo(1.0, 5);
  });

  it('fiboPrice at 1 = high', () => {
    expect(bar.fiboPrice(1)).toBeCloseTo(1.5, 5);
  });

  it('fiboPrice at 0.618 = low + range * 0.618', () => {
    expect(bar.fiboPrice(0.618)).toBeCloseTo(1.0 + 0.5 * 0.618, 5);
  });

  it('pivotPrice PP = (H+L+C)/3', () => {
    expect(bar.pivotPrice('PP')).toBeCloseTo((1.5 + 1.0 + 1.3) / 3, 5);
  });

  it('pivotPrice R1 = 2*PP - L', () => {
    const pp = (1.5 + 1.0 + 1.3) / 3;
    expect(bar.pivotPrice('R1')).toBeCloseTo(2 * pp - 1.0, 5);
  });

  it('pivotPrice S1 = 2*PP - H', () => {
    const pp = (1.5 + 1.0 + 1.3) / 3;
    expect(bar.pivotPrice('S1')).toBeCloseTo(2 * pp - 1.5, 5);
  });

  it('pivotPrice R2 = PP + (H-L)', () => {
    const pp = (1.5 + 1.0 + 1.3) / 3;
    expect(bar.pivotPrice('R2')).toBeCloseTo(pp + 0.5, 5);
  });

  it('pivotPrice S2 = PP - (H-L)', () => {
    const pp = (1.5 + 1.0 + 1.3) / 3;
    expect(bar.pivotPrice('S2')).toBeCloseTo(pp - 0.5, 5);
  });
});
