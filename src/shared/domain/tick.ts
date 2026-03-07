// Tick types — ported from quant-lib/domain

export const TickFlag = {
  None:          0,
  Bid:           1,
  Ask:           2,
  Last:          4,
  Volume:        8,
  BuyVolume:     16,
  SellVolume:    32,
  SessionQuote:  64,
  SessionTrade:  128,
  ValidBid:      256,
  ValidAsk:      512,
  ValidLast:     1024,
  ValidVolume:   2048,
} as const;
export type TickFlag = (typeof TickFlag)[keyof typeof TickFlag];

/** Full MQL5 tick structure */
export interface MqlTick {
  /** Unix timestamp in seconds */
  time: number;
  bid: number;
  ask: number;
  last: number;
  volume: number;
  /** Milliseconds since epoch */
  timeMsc: number;
  flags: number;
  volumeReal: number;
}

/** Minimal tick as stored in the time-and-sales array (TAB = Time-Ask-Bid) */
export interface TickTAB {
  time: number;
  bid: number;
  ask: number;
  volume: number;
}
