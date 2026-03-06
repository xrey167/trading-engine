import type { Logger } from '../lib/logger.js';
import type { Result } from '../lib/result.js';
import type { DomainError } from '../lib/errors.js';
import type { PlaceOrderRequest, OrderResult, IOrderGateway } from '../gateways/types.js';

export class PlaceOrderUseCase {
  constructor(
    private readonly broker: IOrderGateway,
    private readonly logger: Logger,
  ) {}

  async execute(req: PlaceOrderRequest): Promise<Result<OrderResult, DomainError>> {
    this.logger.debug(`PlaceOrder: symbol=${req.symbol} direction=${req.direction}`);
    const result = await this.broker.placeOrder(req);
    if (!result.ok) {
      this.logger.error(`PlaceOrder: gateway error type=${result.error.type} msg=${result.error.message}`);
    }
    return result;
  }
}
