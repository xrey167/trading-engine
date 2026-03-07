import type { Result } from '../../shared/lib/result.js';
import { err } from '../../shared/lib/result.js';
import type { DomainError } from '../../shared/lib/errors.js';
import { notImplemented } from '../../shared/lib/errors.js';
import type { IOrderGateway, OrderResult, PlaceOrderRequest } from '../types.js';

export class MT5OrderGateway implements IOrderGateway {
  constructor(protected readonly bridgeUrl: string) {}

  async placeOrder(_req: PlaceOrderRequest): Promise<Result<OrderResult, DomainError>> {
    return err(notImplemented('MT5OrderGateway.placeOrder', 'Connect a real MT5 bridge'));
  }

  async modifyOrder(_ticket: number, _price: number, _sl: number, _tp: number, _userId: string): Promise<Result<void, DomainError>> {
    return err(notImplemented('MT5OrderGateway.modifyOrder'));
  }

  async deleteOrder(_ticket: number, _userId: string): Promise<Result<void, DomainError>> {
    return err(notImplemented('MT5OrderGateway.deleteOrder'));
  }
}
