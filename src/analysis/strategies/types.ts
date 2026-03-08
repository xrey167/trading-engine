import type { Bars } from '../../market-data/bars.js';

// Signal results
export const SignalResult = { BUY: 'BUY', SELL: 'SELL', HOLD: 'HOLD' } as const;
export type SignalResult = (typeof SignalResult)[keyof typeof SignalResult];

// Run mode
export const RunMode = { Backtest: 'BACKTEST', Live: 'LIVE' } as const;
export type RunMode = (typeof RunMode)[keyof typeof RunMode];

// Position state for strategies to query
export interface IPositionState {
  isFlat(): boolean;
  longCount(): number;
  shortCount(): number;
}

// Context passed to strategy.evaluate()
export interface ISignalContext {
  readonly isNewBar: boolean;
  readonly runMode: RunMode;
  readonly bars: Bars;
  readonly positionState: IPositionState;
  readonly symbol: string;
  readonly timeframe: string;
}

// Strategy interface
export interface ISignalStrategy {
  initialize(): Promise<void>;
  evaluate(context: ISignalContext): Promise<SignalResult>;
}

// Config type for CandleAtrStrategy
export interface CandleAtrConfig {
  atrPeriod: number;
  atrMultiplier: number;
  localWindow: number;
  tailPartThreshold: number;
  wickPartThreshold: number;
  slOffsetPoints: number;
}
