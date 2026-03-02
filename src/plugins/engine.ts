import fp from 'fastify-plugin';
import type { FastifyPluginAsync } from 'fastify';
import { TradingEngine, type SymbolInfo } from '../../trading-engine.js';
import type { IBrokerAdapter } from '../../trading-engine.js';
import type { PaperBroker } from './broker.js';
import '../types/index.js';

interface EnginePluginOptions {
  symbol:  SymbolInfo;
  broker:  IBrokerAdapter & PaperBroker;
  hedging: boolean;
}

const enginePlugin: FastifyPluginAsync<EnginePluginOptions> = async (fastify, opts) => {
  const engine = new TradingEngine(opts.symbol, opts.broker, opts.hedging);
  fastify.decorate('engine',  engine);
  fastify.decorate('symbol',  opts.symbol);
  fastify.decorate('broker',  opts.broker);
};

export default fp(enginePlugin, { name: 'engine' });
