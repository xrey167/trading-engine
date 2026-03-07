import type { Result } from '../../lib/result.js';
import { err } from '../../lib/result.js';
import type { DomainError } from '../../lib/errors.js';
import { notImplemented } from '../../lib/errors.js';
import type { DealInfoVO, HistoryOrderInfoVO } from '../../domain/position.js';
import type { IHistoryGateway } from '../types.js';

export class MT5DealGateway implements IHistoryGateway {
  constructor(protected readonly bridgeUrl: string) {}

  async getDeals(_userId: string, _from: Date, _to: Date): Promise<Result<DealInfoVO[], DomainError>> {
    return err(notImplemented('MT5DealGateway.getDeals', 'Connect a real MT5 bridge'));
  }

  async getDealByTicket(_ticket: number, _userId: string): Promise<Result<DealInfoVO, DomainError>> {
    return err(notImplemented('MT5DealGateway.getDealByTicket'));
  }

  async getHistoryOrders(_userId: string, _from: Date, _to: Date): Promise<Result<HistoryOrderInfoVO[], DomainError>> {
    return err(notImplemented('MT5DealGateway.getHistoryOrders'));
  }
}
