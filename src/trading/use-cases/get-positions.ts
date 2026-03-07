import type { Logger } from '../../shared/lib/logger.js';
import type { Result } from '../../shared/lib/result.js';
import type { DomainError } from '../../shared/lib/errors.js';
import type { PositionInfoVO } from '../../shared/domain/position.js';
import type { IPositionGateway } from '../../broker/types.js';

export class GetPositionsUseCase {
  constructor(
    private readonly broker: IPositionGateway,
    private readonly logger: Logger,
  ) {}

  async execute(userId: string): Promise<Result<PositionInfoVO[], DomainError>> {
    this.logger.debug(`GetPositions: fetching userId=${userId}`);
    return this.broker.getPositions(userId);
  }
}
