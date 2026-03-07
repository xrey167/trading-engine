// MT5 position gateway — stub implementation.
// Real implementation requires an MT5 bridge (e.g. ZeroMQ socket or HTTP proxy).
import type { Result } from '../../lib/result.js';
import { err } from '../../lib/result.js';
import type { DomainError } from '../../lib/errors.js';
import { notImplemented } from '../../lib/errors.js';
import type { PositionInfoVO } from '../../domain/position.js';
import type { IPositionGateway } from '../types.js';

export class MT5PositionGateway implements IPositionGateway {
  constructor(protected readonly bridgeUrl: string) {}

  async getPositions(_userId: string): Promise<Result<PositionInfoVO[], DomainError>> {
    return err(notImplemented('MT5PositionGateway.getPositions', 'Connect a real MT5 bridge'));
  }

  async getPositionByTicket(_ticket: number, _userId: string): Promise<Result<PositionInfoVO, DomainError>> {
    return err(notImplemented('MT5PositionGateway.getPositionByTicket'));
  }

  async closePositionByTicket(_ticket: number, _deviation: number, _userId: string): Promise<Result<void, DomainError>> {
    return err(notImplemented('MT5PositionGateway.closePositionByTicket'));
  }

  async modifyPosition(_ticket: number, _sl: number, _tp: number, _userId: string): Promise<Result<void, DomainError>> {
    return err(notImplemented('MT5PositionGateway.modifyPosition'));
  }
}
