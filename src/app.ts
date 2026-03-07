import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
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
import skillsRoute from './routes/skills/index.js';
import udfRoute from './routes/udf/index.js';
import './types/index.js';

const SWAGGER_UI_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <title>Trading Engine API Docs</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css">
  <style>
    body { margin: 0; background: #1a1a2e; }
    .swagger-ui .topbar { display: none; }
    .swagger-ui .info .title { color: #e2e8f0; }
    .swagger-ui .info p, .swagger-ui .info li { color: #cbd5e1; }
    .swagger-ui .scheme-container { background: #16213e; box-shadow: none; }
    .swagger-ui .opblock-tag { color: #e2e8f0; border-bottom-color: #334155; }
    .swagger-ui .opblock-tag:hover { color: #38bdf8; }
    .swagger-ui .filter .operation-filter-input {
      background: #0f3460; color: #e2e8f0; border: 1px solid #334155;
    }
    .swagger-ui .filter .operation-filter-input::placeholder { color: #64748b; }
    .swagger-ui .opblock.opblock-get { background: rgba(56,189,248,0.08); border-color: #38bdf8; }
    .swagger-ui .opblock.opblock-get .opblock-summary { border-color: #38bdf8; }
    .swagger-ui .opblock.opblock-post { background: rgba(52,211,153,0.08); border-color: #34d399; }
    .swagger-ui .opblock.opblock-post .opblock-summary { border-color: #34d399; }
    .swagger-ui .opblock.opblock-put { background: rgba(251,191,36,0.08); border-color: #fbbf24; }
    .swagger-ui .opblock.opblock-put .opblock-summary { border-color: #fbbf24; }
    .swagger-ui .opblock.opblock-delete { background: rgba(248,113,113,0.08); border-color: #f87171; }
    .swagger-ui .opblock.opblock-delete .opblock-summary { border-color: #f87171; }
    .swagger-ui .opblock.opblock-patch { background: rgba(168,85,247,0.08); border-color: #a855f7; }
    .swagger-ui .opblock.opblock-patch .opblock-summary { border-color: #a855f7; }
    .swagger-ui section.models { border-color: #334155; }
    .swagger-ui .model-title { color: #e2e8f0; }
    .swagger-ui .wrapper { max-width: 1400px; }
    .swagger-ui .btn.execute { background: #38bdf8; border-color: #38bdf8; }
    .swagger-ui .btn.execute:hover { background: #0ea5e9; }
    #header-bar {
      background: linear-gradient(135deg, #0f3460 0%, #1a1a2e 100%);
      padding: 16px 24px; display: flex; align-items: center; gap: 12px;
      border-bottom: 1px solid #334155;
    }
    #header-bar h1 { margin: 0; font: 700 20px/1.2 system-ui, sans-serif; color: #e2e8f0; }
    #header-bar span { font: 400 13px/1 system-ui, sans-serif; color: #64748b; }
    #header-bar .badge {
      background: #34d399; color: #0f3460; font: 600 11px/1 system-ui, sans-serif;
      padding: 3px 8px; border-radius: 4px; text-transform: uppercase;
    }
  </style>
</head>
<body>
<div id="header-bar">
  <h1>Trading Engine</h1>
  <span class="badge">v1.0</span>
  <span>REST + WebSocket API</span>
</div>
<div id="swagger-ui"></div>
<script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
<script>
SwaggerUIBundle({
  url: '/openapi.yaml',
  dom_id: '#swagger-ui',
  presets: [SwaggerUIBundle.presets.apis, SwaggerUIBundle.SwaggerUIStandalonePreset],
  layout: 'BaseLayout',
  deepLinking: true,
  displayRequestDuration: true,
  persistAuthorization: true,
  filter: true,
  tryItOutEnabled: true,
  docExpansion: 'list',
  defaultModelsExpandDepth: 1,
  tagsSorter: 'alpha',
  operationsSorter: 'method',
});
</script>
</body>
</html>`;

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
  const broker  = new PaperBroker(emitter, app.log);

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

  // 5b. Global error handler — sanitised responses, no stack traces in production
  app.setErrorHandler((err: Error & { statusCode?: number }, _request, reply) => {
    app.log.error(err);
    const statusCode = err.statusCode ?? 500;
    const response: Record<string, unknown> = {
      error: statusCode >= 500 ? 'Internal Server Error' : err.name,
      message: statusCode >= 500 ? 'An internal error occurred' : err.message,
      statusCode,
    };
    if (process.env.NODE_ENV !== 'production') {
      response.stack = err.stack;
    }
    return reply.status(statusCode).send(response);
  });

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

  // 9. Agent SDK skills (SSE streaming, auth-gated)
  await app.register(skillsRoute);

  // 10. TradingView UDF-compatible charting data
  await app.register(udfRoute);

  // 11. API docs — /openapi.yaml (raw spec) + /docs (Swagger UI via CDN)
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const specPath = join(__dirname, '../../openapi.yaml');
  let specContent = '';
  try { specContent = readFileSync(specPath, 'utf8'); } catch { /* spec not built */ }

  app.get('/openapi.yaml', async (_req, reply) => {
    reply.header('Content-Type', 'text/yaml; charset=utf-8');
    reply.header('Cache-Control', 'public, max-age=3600');
    return reply.send(specContent);
  });

  app.get('/docs', async (_req, reply) => {
    reply.header('Content-Type', 'text/html; charset=utf-8');
    reply.header('Cache-Control', 'public, max-age=3600');
    return reply.send(SWAGGER_UI_HTML);
  });

  return app;
}
