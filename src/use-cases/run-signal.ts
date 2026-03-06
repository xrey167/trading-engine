import type { Logger } from '../lib/logger.js';
import type { ISignalStrategy, ISignalContext, SignalResult } from '../strategies/types.js';

export class RunSignalUseCase {
  constructor(
    private readonly strategy: ISignalStrategy,
    private readonly logger: Logger,
  ) {}

  async execute(context: ISignalContext): Promise<SignalResult> {
    this.logger.debug(`RunSignal: evaluating symbol=${context.symbol}`);
    const result = await this.strategy.evaluate(context);
    this.logger.info(`RunSignal: result symbol=${context.symbol} result=${result}`);
    return result;
  }
}
