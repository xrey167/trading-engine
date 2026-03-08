import { Side, TrailMode } from '../shared/domain/engine-enums.js';
import type { ExitReason } from '../shared/domain/engine-enums.js';
import type { Bar } from '../shared/domain/bar/bar.js';
import type { Bars } from '../market-data/bars.js';
import type { SymbolInfoBase } from '../engine/core/symbol.js';

export interface TrailConfig {
  mode:        TrailMode;
  distancePts: number;
  periods:     number;
}

export interface TrailState {
  active: boolean;
  plhRef: number;
}

export function calcTrailingSL(p: {
  side:          Side;
  bar:           Bar;
  bars:          Bars;
  posPrice:      number;
  currentSL:     number;
  spreadAbs:     number;
  trailBeginPts: number;
  trail:         TrailConfig;
  state:         TrailState;
  symbol:        SymbolInfoBase;
}): number {
  const { side, bar, bars, posPrice, spreadAbs, trail, state, symbol } = p;
  let { currentSL } = p;
  if (trail.mode === TrailMode.None) return currentSL;

  const beginPrice = symbol.pointsToPrice(p.trailBeginPts);
  const distPrice  = symbol.pointsToPrice(Math.abs(trail.distancePts));
  const distFrac   = trail.distancePts < 0 ? Math.abs(trail.distancePts) / 1000 : 0;

  if (side === Side.Long) {
    if (bar.high < posPrice + beginPrice) return currentSL;
    state.active = true;
    let cand = -Infinity;
    switch (trail.mode) {
      case TrailMode.Dst:      cand = bar.high - distPrice; break;
      case TrailMode.Eop:      cand = bars.lowestLow(trail.periods)  - distPrice; break;
      case TrailMode.Ma:       cand = bars.sma(trail.periods)        - distPrice; break;
      case TrailMode.PlhPeak:  if (bar.high > state.plhRef) { state.plhRef = bar.high;  cand = bar.low  - distPrice; } break;
      case TrailMode.PlhClose: if (bar.close > state.plhRef){ state.plhRef = bar.close; cand = bar.low  - distPrice; } break;
      case TrailMode.Prx:
        if (bar.close > state.plhRef) {
          state.plhRef = bar.high;
          cand = distFrac > 0 ? bar.low - bar.range() * distFrac : bar.low - distPrice;
        }
        break;
      default: break;
    }
    if (cand > -Infinity) currentSL = Math.max(currentSL === -1 ? -Infinity : currentSL, cand);

  } else if (side === Side.Short) {
    if (bar.low + spreadAbs > posPrice - beginPrice) return currentSL;
    state.active = true;
    let cand = Infinity;
    switch (trail.mode) {
      case TrailMode.Dst:      cand = bar.low  + distPrice; break;
      case TrailMode.Eop:      cand = bars.highestHigh(trail.periods) + distPrice; break;
      case TrailMode.Ma:       cand = bars.sma(trail.periods)         + distPrice; break;
      case TrailMode.PlhPeak:  if (bar.low  < state.plhRef) { state.plhRef = bar.low;   cand = bar.high + distPrice; } break;
      case TrailMode.PlhClose: if (bar.close < state.plhRef){ state.plhRef = bar.close; cand = bar.high + distPrice; } break;
      case TrailMode.Prx:
        if (bar.close < state.plhRef) {
          state.plhRef = bar.low;
          cand = distFrac > 0 ? bar.high + bar.range() * distFrac : bar.high + distPrice;
        }
        break;
      default: break;
    }
    cand += spreadAbs;
    if (cand < Infinity)
      currentSL = currentSL === -1 ? cand : Math.min(currentSL, cand);
  }

  return currentSL;
}

export interface HitResult {
  reason:    ExitReason;
  exitPrice: number;
}

export function checkSLTP(p: {
  side:        Side;
  bar:         Bar;
  sl:          number;
  tp:          number;
  slActive:    boolean;
  tpActive:    boolean;
  trailActive: boolean;
  spreadAbs:   number;
}): HitResult | null {
  const { side, bar, sl, tp, slActive, tpActive, trailActive, spreadAbs } = p;
  const slOn = (slActive || trailActive) && sl > 0;
  const tpOn = tpActive && tp > 0;

  if (side === Side.Long) {
    const slHit = slOn && bar.low  <= sl;
    const tpHit = tpOn && bar.high >= tp;
    if (!slHit && !tpHit) return null;
    if (slHit && tpHit) return { reason: 'SL_BOTH', exitPrice: Math.min(bar.open, sl) };
    if (slHit) return { reason: 'SL', exitPrice: Math.min(bar.open, sl) };
    return          { reason: 'TP', exitPrice: Math.max(bar.open, tp) };
  }

  if (side === Side.Short) {
    const slHit = slOn && bar.high + spreadAbs >= sl;
    const tpHit = tpOn && bar.low  + spreadAbs <= tp;
    if (!slHit && !tpHit) return null;
    if (slHit && tpHit) return { reason: 'TP_BOTH', exitPrice: Math.min(bar.open, tp) };
    if (slHit) return { reason: 'SL', exitPrice: Math.max(bar.open, sl) };
    return          { reason: 'TP', exitPrice: Math.min(bar.open, tp) };
  }

  return null;
}
