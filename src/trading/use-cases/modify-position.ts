import type { Logger } from '../../shared/lib/logger.js';
import type { Result } from '../../shared/lib/result.js';
import type { DomainError } from '../../shared/lib/errors.js';
import { err } from '../../shared/lib/result.js';
import { invalidInput } from '../../shared/lib/errors.js';
import type { IPositionGateway } from '../../broker/types.js';

export class ModifyPositionUseCase {
  constructor(
    private readonly broker: IPositionGateway,
    private readonly logger: Logger,
  ) {}

  async execute(
    ticket: number,
    stopLoss: number,
    takeProfit: number,
    userId: string,
  ): Promise<Result<void, DomainError>> {
    if (stopLoss < 0) {
      return err(invalidInput('stopLoss must be non-negative', 'stopLoss'));
    }
    if (takeProfit < 0) {
      return err(invalidInput('takeProfit must be non-negative', 'takeProfit'));
    }
    this.logger.debug(`ModifyPosition: ticket=${ticket} sl=${stopLoss} tp=${takeProfit}`);
    return this.broker.modifyPosition(ticket, stopLoss, takeProfit, userId);
  }
}
