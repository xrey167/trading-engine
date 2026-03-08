import { Bars } from '../../market-data/bars.js';
import type { OHLC } from '../../shared/domain/bar/ohlc.js';
import type { Logger } from '../../shared/lib/logger.js';
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

    // Walk forward in time (oldest → newest). ohlcs[0] is newest, so we
    // iterate in reverse. `oldestFirst` grows with O(1) push; we reverse a
    // copy when constructing Bars (which expects newest-first). This avoids
    // the O(n) per-step array shift that `unshift` would cause.
    const oldestFirst: OHLC[] = [];
    for (let i = params.ohlcs.length - 1; i >= 0; i--) {
      oldestFirst.push(params.ohlcs[i]);
      const result = await this.strategy.evaluate({
        isNewBar: true,
        runMode: RunMode.Backtest,
        bars: new Bars(oldestFirst.slice().reverse()),
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
