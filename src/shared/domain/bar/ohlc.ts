export interface OHLC {
  open: number; high: number; low: number; close: number;
  time: Date; volume?: number | undefined;
}
