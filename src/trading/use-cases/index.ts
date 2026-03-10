import type { FastifyBaseLogger } from 'fastify';
import type { IFullBrokerAdapter } from '../../broker/types.js';
import type { BrokerService } from '../../broker/broker-service.js';
import { GetPositionsUseCase } from './get-positions.js';
import { ClosePositionUseCase } from './close-position.js';
import { ModifyPositionUseCase } from './modify-position.js';
import { PlaceOrderUseCase } from './place-order.js';

export function createTradingUseCases(
  adapter: IFullBrokerAdapter,
  brokerService: BrokerService,
  log: FastifyBaseLogger,
) {
  return {
    getPositions:  new GetPositionsUseCase(brokerService, log),
    closePosition: new ClosePositionUseCase(adapter, log),
    modifyPosition: new ModifyPositionUseCase(adapter, log),
    placeOrder:    new PlaceOrderUseCase(adapter, log),
  };
}

export type TradingUseCases = ReturnType<typeof createTradingUseCases>;
