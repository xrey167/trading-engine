import type { Logger } from '../lib/logger.js';
import type { Result } from '../lib/result.js';
import type { DomainError } from '../lib/errors.js';
import type { PositionInfoVO } from '../domain/position.js';
import type { IPositionGateway } from '../gateways/types.js';

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
