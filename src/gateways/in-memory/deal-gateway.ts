import type { Result } from '../../lib/result.js';
import { ok, err } from '../../lib/result.js';
import type { DomainError } from '../../lib/errors.js';
import { notFound } from '../../lib/errors.js';
import type { DealInfoVO } from '../../domain/position.js';
import type { IHistoryGateway } from '../types.js';
import type { HistoryOrderInfoVO } from '../../domain/position.js';

export class InMemoryDealGateway implements IHistoryGateway {
  private deals: DealInfoVO[] = [];
  private historyOrders: HistoryOrderInfoVO[] = [];

  seedDeal(d: DealInfoVO): void {
    this.deals.push(d);
  }

  seedHistoryOrder(o: HistoryOrderInfoVO): void {
    this.historyOrders.push(o);
  }

  async getDeals(userId: string, from: Date, to: Date): Promise<Result<DealInfoVO[], DomainError>> {
    return ok(
      this.deals.filter(d => {
        if (d.userId !== userId) return false;
        const t = new Date(d.time).getTime();
        return t >= from.getTime() && t <= to.getTime();
      }),
    );
  }

  async getDealByTicket(ticket: number, userId: string): Promise<Result<DealInfoVO, DomainError>> {
    const d = this.deals.find(deal => deal.ticket === ticket && deal.userId === userId);
    if (!d) return err(notFound(`Deal ${ticket} not found`, String(ticket)));
    return ok(d);
  }

  async getHistoryOrders(userId: string, _from: Date, _to: Date): Promise<Result<HistoryOrderInfoVO[], DomainError>> {
    return ok(this.historyOrders.filter(o => o.userId === userId));
  }
}
