// Forex session helpers — ported from quant-lib/domain
import type { OHLC } from '../../trading-engine.js';

export const ForexSession = {
  Sydney:  'SYDNEY',
  Tokyo:   'TOKYO',
  London:  'LONDON',
  NewYork: 'NEW_YORK',
  Overlap: 'OVERLAP',   // London / New York overlap
} as const;
export type ForexSession = (typeof ForexSession)[keyof typeof ForexSession];

// UTC hours: half-open interval [open, close).
// Sessions that cross midnight (Sydney) have open > close.
const SESSION_UTC: Record<ForexSession, { open: number; close: number }> = {
  [ForexSession.Sydney]:  { open: 21, close: 6  },
  [ForexSession.Tokyo]:   { open: 0,  close: 9  },
  [ForexSession.London]:  { open: 8,  close: 17 },
  [ForexSession.NewYork]: { open: 13, close: 22 },
  [ForexSession.Overlap]: { open: 13, close: 17 },
};

/** Returns the UTC open/close hours for a given Forex session. */
export function sessionHours(session: ForexSession): { open: number; close: number } {
  return SESSION_UTC[session];
}

/** Returns true if the bar's timestamp falls within the given Forex session. */
export function isInSession(bar: OHLC, session: ForexSession): boolean {
  const hour = bar.time.getUTCHours();
  const { open, close } = SESSION_UTC[session];
  // Normal session (no midnight crossing)
  if (open < close) return hour >= open && hour < close;
  // Crosses midnight (e.g. Sydney 21:00–06:00)
  return hour >= open || hour < close;
}
