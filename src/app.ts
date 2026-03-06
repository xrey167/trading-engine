import { EventEmitter } from 'node:events';
import Fastify, { type FastifyInstance, type FastifyServerOptions } from 'fastify';
import websocket from '@fastify/websocket';
import { SymbolInfo } from '../trading-engine.js';
import { PaperBroker } from './plugins/broker.js';
import enginePlugin from './plugins/engine.js';
import rateLimitPlugin from './plugins/rate-limit.js';
import corsPlugin from './plugins/cors.js';
import atrPlugin from './plugins/atr.js';
import positionsRoute from './routes/positions/index.js';
import ordersRoute from './routes/orders/index.js';
import barsRoute from './routes/bars/index.js';
import streamRoute from './routes/stream/index.js';
import accountRoute from './routes/account/index.js';
import engineRoute from './routes/engine/index.js';
import scaledOrdersRoute from './routes/scaled-orders/index.js';
import atrRoute from './routes/atr/index.js';
import backtestRoute from './routes/backtest/index.js';
import signalRoute from './routes/signal/index.js';
import v1PositionsRoute from './routes/v1-positions/index.js';
import moneyManagementRoute from './routes/money-management/index.js';
import openbbRoute from './routes/openbb/index.js';
import './types/index.js';

export interface BuildAppConfig {
  symbol?:  { pair: string; digits: number };
  hedging?: boolean;
}

// TODO(architecture): Use-cases are instantiated inline in route handlers (e.g.
// `new GetPositionsUseCase(broker, log)`). At the current project size this is fine, but
// if the number of use-cases or their dependency graphs grow, consider a factory or
// composition root here in buildApp() that pre-wires use-cases and decorates them on the
// Fastify instance, keeping route handlers thin.
export async function buildApp(
  opts: FastifyServerOptions = {},
  cfg: BuildAppConfig = {},
): Promise<FastifyInstance> {
  const app = Fastify(opts);

  // 1. Shared infrastructure
  const emitter = new EventEmitter();
  emitter.setMaxListeners(0); // each WS client adds 3 listeners; unbounded is intentional
  const { pair = 'EURUSD', digits = 5 } = cfg.symbol ?? {};
  const symbol  = new SymbolInfo(pair, digits);
  const broker  = new PaperBroker(emitter);

  app.decorate('emitter', emitter);

  // 2. Engine plugin (decorates app.engine + app.symbol + app.broker)
  await app.register(enginePlugin, { symbol, broker, hedging: cfg.hedging ?? true });

  // 3. Rate-limit plugin (global: false — opt-in per route)
  await app.register(rateLimitPlugin);

  // 3b. CORS (fp()-wrapped — hook applies globally across all scopes)
  await app.register(corsPlugin);

  // 4. WebSocket support
  await app.register(websocket);

  // 5. AtrModule plugin (decorates app.atrModule + app.atrConfig)
  await app.register(atrPlugin);

  // 6. Routes
  await app.register(positionsRoute);
  await app.register(ordersRoute);
  await app.register(barsRoute);
  await app.register(streamRoute);
  await app.register(accountRoute);
  await app.register(engineRoute);
  await app.register(scaledOrdersRoute);
  await app.register(atrRoute);

  // 7. quant-lib integration routes
  await app.register(backtestRoute);
  await app.register(signalRoute);
  await app.register(v1PositionsRoute);
  await app.register(moneyManagementRoute);

  // 8. OpenBB Workspace integration (widgets.json, apps.json, /openbb/* data routes)
  await app.register(openbbRoute);

  return app;
}
