import fp from 'fastify-plugin';
import type { FastifyPluginAsync } from 'fastify';
import { AtrModule, AtrMethod, type AtrModuleConfig } from '../../trading-engine.js';

/**
 * AtrModule plugin — decorates fastify.atrModule with a live AtrModule instance.
 *
 * Default config: all multipliers = 0 (disabled), onlyWhenFlat = true.
 * Use PUT /atr/config to activate individual multipliers at runtime.
 */

// Mutable config object shared between plugin and route
export interface MutableAtrConfig extends AtrModuleConfig {}

const atrPlugin: FastifyPluginAsync = fp(async (fastify) => {
  const cfg: MutableAtrConfig = {
    period:               14,
    method:               AtrMethod.Ema,
    shift:                1,
    slMultiplier:         0,
    tpMultiplier:         0,
    trailBeginMultiplier: 0,
    trailDistMultiplier:  0,
    onlyWhenFlat:         true,
  };

  const atrModule = new AtrModule(cfg, fastify.engine, fastify.symbol);

  // Expose both the module and the mutable config so the config route can patch it
  fastify.decorate('atrModule', atrModule);
  fastify.decorate('atrConfig', cfg);
});

export default atrPlugin;
