import type { Result } from '../../shared/lib/result.js';
import { ok } from '../../shared/lib/result.js';
import type { DomainError } from '../../shared/lib/errors.js';
import type { IOrderGateway, OrderResult, PlaceOrderRequest } from '../types.js';

export class InMemoryOrderGateway implements IOrderGateway {
  private seq = 0;

  async placeOrder(req: PlaceOrderRequest): Promise<Result<OrderResult, DomainError>> {
    const ticket = ++this.seq;
    return ok({
      ticket,
      dealTicket: ticket,
      volume: req.lots,
      price: req.price,
      retcode: 10009,
      retcodeDescription: 'Request completed',
      comment: req.comment,
    });
  }

  async modifyOrder(
    _ticket: number,
    _price: number,
    _sl: number,
    _tp: number,
    _userId: string,
  ): Promise<Result<void, DomainError>> {
    return ok(undefined);
  }

  async deleteOrder(_ticket: number, _userId: string): Promise<Result<void, DomainError>> {
    return ok(undefined);
  }
}
