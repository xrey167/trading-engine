export const TrailMode = {
  None:     0,
  Dst:      1,
  Eop:      2,
  Ma:       3,
  PlhPeak:  5,
  PlhClose: 6,
  Prx:      7,
} as const;
export type TrailMode = (typeof TrailMode)[keyof typeof TrailMode];

export interface TrailConfig {
  mode:        TrailMode;
  distancePts: number;
  periods:     number;
}

export interface TrailState {
  active: boolean;
  plhRef: number;
}

export interface HitResult {
  reason:    import('../order/order.js').ExitReason;
  exitPrice: number;
}
