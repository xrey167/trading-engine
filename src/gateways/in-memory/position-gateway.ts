import type { Result } from '../../lib/result.js';
import { ok, err } from '../../lib/result.js';
import type { DomainError } from '../../lib/errors.js';
import { notFound } from '../../lib/errors.js';
import type { PositionInfoVO } from '../../domain/position.js';
import type { IPositionGateway } from '../types.js';

export class InMemoryPositionGateway implements IPositionGateway {
  private positions: PositionInfoVO[] = [];

  seed(p: PositionInfoVO): void {
    this.positions.push(p);
  }

  clear(): void {
    this.positions = [];
  }

  async getPositions(userId: string): Promise<Result<PositionInfoVO[], DomainError>> {
    return ok(this.positions.filter(p => p.userId === userId));
  }

  async getPositionByTicket(ticket: number, userId: string): Promise<Result<PositionInfoVO, DomainError>> {
    const p = this.positions.find(pos => pos.ticket === ticket && pos.userId === userId);
    if (!p) return err(notFound(`Position ${ticket} not found`, String(ticket)));
    return ok(p);
  }

  async closePositionByTicket(ticket: number, _deviation: number, userId: string): Promise<Result<void, DomainError>> {
    const idx = this.positions.findIndex(p => p.ticket === ticket && p.userId === userId);
    if (idx === -1) return err(notFound(`Position ${ticket} not found`, String(ticket)));
    this.positions.splice(idx, 1);
    return ok(undefined);
  }

  async modifyPosition(ticket: number, sl: number, tp: number, userId: string): Promise<Result<void, DomainError>> {
    const idx = this.positions.findIndex(p => p.ticket === ticket && p.userId === userId);
    if (idx === -1) return err(notFound(`Position ${ticket} not found`, String(ticket)));
    this.positions[idx] = { ...this.positions[idx], stopLoss: sl, takeProfit: tp };
    return ok(undefined);
  }
}
