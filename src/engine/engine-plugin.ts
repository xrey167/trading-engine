import fp from 'fastify-plugin';
import type { FastifyPluginAsync } from 'fastify';
import { TradingEngine, type SymbolInfo } from '../../trading-engine.js';
import type { IFullBrokerAdapter } from '../broker/types.js';
import { Mutex } from '../shared/lib/mutex.js';
import '../shared/types/index.js';

export interface EnginePluginOptions {
  symbol:  SymbolInfo;
  broker:  IFullBrokerAdapter;
  hedging: boolean;
}

const enginePlugin: FastifyPluginAsync<EnginePluginOptions> = async (fastify, opts) => {
  const engine = new TradingEngine(opts.symbol, opts.broker, opts.hedging);
  fastify.decorate('engine',  engine);
  fastify.decorate('symbol',  opts.symbol);
  fastify.decorate('broker',  opts.broker);
  fastify.decorate('engineMutex', new Mutex());

  fastify.addHook('onClose', async () => {
    await opts.broker.disconnect();
  });
};

export default fp(enginePlugin, { name: 'engine' });
