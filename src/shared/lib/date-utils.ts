// MT5 / trading date utilities — ported from quant-lib/shared
//
// MT5 timestamps are Unix epoch seconds (same as Math.floor(Date.getTime() / 1000)).

/** Convert a JS Date to an MT5 timestamp (seconds since Unix epoch). */
export function toMT5Time(date: Date): number {
  return Math.floor(date.getTime() / 1000);
}

/** Convert an MT5 timestamp (seconds) to a JS Date. */
export function fromMT5Time(ts: number): Date {
  return new Date(ts * 1000);
}

/** Return a new Date set to 00:00:00.000 UTC on the same calendar day. */
export function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

/** Return a new Date set to 23:59:59.999 UTC on the same calendar day. */
export function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setUTCHours(23, 59, 59, 999);
  return d;
}
