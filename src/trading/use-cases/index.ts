import type { FastifyBaseLogger } from 'fastify';
import type { IFullBrokerAdapter } from '../../broker/types.js';
import { GetPositionsUseCase } from './get-positions.js';
import { ClosePositionUseCase } from './close-position.js';
import { ModifyPositionUseCase } from './modify-position.js';
import { PlaceOrderUseCase } from './place-order.js';

export function createTradingUseCases(adapter: IFullBrokerAdapter, log: FastifyBaseLogger) {
  return {
    getPositions:  new GetPositionsUseCase(adapter, log),
    closePosition: new ClosePositionUseCase(adapter, log),
    modifyPosition: new ModifyPositionUseCase(adapter, log),
    placeOrder:    new PlaceOrderUseCase(adapter, log),
  };
}

export type TradingUseCases = ReturnType<typeof createTradingUseCases>;
