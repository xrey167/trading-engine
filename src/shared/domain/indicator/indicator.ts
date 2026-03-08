export const AtrMethod = { Sma: 0, Ema: 1 } as const;
export type AtrMethod = (typeof AtrMethod)[keyof typeof AtrMethod];

export const MAType = {
  SMA: 0,
  EMA: 1,
  DEMA: 2,
  TEMA: 3,
  VWMA: 4,
  Hull: 5,
  RMA: 6,
  LinearRegression: 7,
} as const;
export type MAType = (typeof MAType)[keyof typeof MAType];

export const PriceType = {
  Close: 0,
  Open: 1,
  High: 2,
  Low: 3,
  Median: 4,
  Typical: 5,
  Weighted: 6,
  MedianBody: 7,
  Average: 8,
  TrendBiased: 9,
  Volume: 10,
} as const;
export type PriceType = (typeof PriceType)[keyof typeof PriceType];
