import { Bars, type OHLC } from '../../trading-engine.js';
import type { Logger } from '../lib/logger.js';
import type { ISignalStrategy, IPositionState } from '../strategies/types.js';
import { SignalResult, RunMode } from '../strategies/types.js';

export interface BacktestSummary {
  signalCount: number;
  buyCount: number;
  sellCount: number;
  holdCount: number;
}

export class BacktestUseCase {
  constructor(
    private readonly strategy: ISignalStrategy,
    private readonly logger: Logger,
  ) {}

  async execute(params: {
    ohlcs: OHLC[];
    symbol: string;
    timeframe: string;
    positionState: IPositionState;
  }): Promise<BacktestSummary> {
    await this.strategy.initialize();

    const results: SignalResult[] = [];
    const total = params.ohlcs.length;

    // Walk forward: at each step i, the "window" is ohlcs[i..total-1]
    // where ohlcs[i] is the current (most-recent) bar at that point in time.
    for (let i = total - 1; i >= 0; i--) {
      const windowBars = new Bars(params.ohlcs.slice(i));
      const result = await this.strategy.evaluate({
        isNewBar: true,
        runMode: RunMode.Backtest,
        bars: windowBars,
        positionState: params.positionState,
        symbol: params.symbol,
        timeframe: params.timeframe,
      });
      results.push(result);
      this.logger.debug(`Backtest: bar=${i} result=${result}`);
    }

    let buyCount = 0, sellCount = 0, holdCount = 0;
    for (const r of results) {
      if (r === SignalResult.BUY) buyCount++;
      else if (r === SignalResult.SELL) sellCount++;
      else holdCount++;
    }

    this.logger.info(`Backtest: complete signalCount=${results.length} buy=${buyCount} sell=${sellCount} hold=${holdCount}`);
    return { signalCount: results.length, buyCount, sellCount, holdCount };
  }
}
