import type { Logger } from '../../shared/lib/logger.js';
import type { Result } from '../../shared/lib/result.js';
import type { DomainError } from '../../shared/lib/errors.js';
import { err } from '../../shared/lib/result.js';
import { invalidInput } from '../../shared/lib/errors.js';
import type { IPositionGateway } from '../../broker/types.js';

export class ClosePositionUseCase {
  constructor(
    private readonly broker: IPositionGateway,
    private readonly logger: Logger,
  ) {}

  async execute(ticket: number, deviation: number, userId: string): Promise<Result<void, DomainError>> {
    if (deviation < 0) {
      return err(invalidInput('deviation must be non-negative', 'deviation'));
    }
    this.logger.debug(`ClosePosition: ticket=${ticket} deviation=${deviation}`);
    return this.broker.closePositionByTicket(ticket, deviation, userId);
  }
}
