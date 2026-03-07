import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import fastifyStatic from '@fastify/static';
import Fastify, { type FastifyInstance, type FastifyServerOptions } from 'fastify';
import websocket from '@fastify/websocket';
import { SymbolInfoForex } from '../trading-engine.js';
import { PaperBroker } from './broker/paper/paper-broker.js';
import { InMemoryBarCache } from './market-data/bar-cache.js';
import { RedisBarCache } from './market-data/redis-bar-cache.js';
import type { IBarCache } from './market-data/data-provider-types.js';
import { InternalProvider } from './market-data/internal-provider.js';
import { toLogger } from './shared/lib/logger.js';
import { createRedisClient } from './shared/lib/redis-client.js';
import { RedisEventBridge } from './shared/lib/redis-event-bridge.js';
import { createAmqpClient, closeAmqpClient, type AmqpClient } from './shared/lib/amqp-client.js';
import { AmqpEventBridge } from './shared/lib/amqp-event-bridge.js';
import { AuditConsumer } from './audit/audit-consumer.js';
import { TypedEventBus } from './shared/event-bus.js';
import type { AppEventMap } from './shared/services/event-map.js';
import { ServiceRegistry } from './shared/services/service-registry.js';
import { BrokerService } from './broker/broker-service.js';
import rateLimitPlugin from './shared/plugins/rate-limit.js';
import corsPlugin from './shared/plugins/cors.js';
import engineModule from './engine/index.js';
import tradingModule from './trading/index.js';
import marketDataModule from './market-data/index.js';
import analysisModule from './analysis/index.js';
import mmModule from './money-management/module.js';
import openbbModule from './integrations/openbb/index.js';
import skillsModule from './integrations/skills/index.js';
import servicesModule from './services/index.js';
import auditModule from './audit/index.js';
import './shared/types/index.js';

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
  <a href="/docs/api/" style="margin-left:auto;color:#38bdf8;font:500 13px/1 system-ui,sans-serif;text-decoration:none;padding:6px 12px;border:1px solid #38bdf8;border-radius:4px;">Class &amp; Function Docs</a>
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

export async function buildApp(
  opts: FastifyServerOptions = {},
  cfg: BuildAppConfig = {},
): Promise<FastifyInstance> {
  const app = Fastify(opts);

  // 1. Shared infrastructure
  const emitter = new TypedEventBus<AppEventMap>();
  const { pair = 'EURUSD', digits = 5 } = cfg.symbol ?? {};
  const symbol  = new SymbolInfoForex(pair, digits);
  const broker  = new PaperBroker(emitter, app.log);

  app.decorate('emitter', emitter);

  // 1b. Service registry
  const serviceRegistry = new ServiceRegistry();
  app.decorate('serviceRegistry', serviceRegistry);

  // 2. Infrastructure plugins
  await app.register(rateLimitPlugin);
  await app.register(corsPlugin);
  await app.register(websocket);

  // 3. Engine module (engine + atr plugins + engine/atr/account routes)
  await app.register(engineModule, { symbol, broker, hedging: cfg.hedging ?? true });

  // 3b. Wrap primary broker+engine as a BrokerService (reuses engine-plugin instances)
  const primaryBrokerService = new BrokerService(
    { id: 'broker:paper:primary', name: 'paper-primary', broker, symbol, hedging: cfg.hedging ?? true, engine: app.engine, engineMutex: app.engineMutex },
    emitter,
    toLogger(app.log),
  );
  // Start the broker service — PaperBroker.connect() is idempotent
  await primaryBrokerService.start();
  serviceRegistry.register(primaryBrokerService);

  // 1c. Bar cache — Redis-backed if REDIS_URL is set, otherwise in-memory
  const logger = toLogger(app.log);
  const redis = createRedisClient(logger);
  const barCache: IBarCache = redis ? new RedisBarCache(redis, logger) : new InMemoryBarCache();
  app.decorate('barCache', barCache);

  // If Redis available, hydrate cache from previous session
  if (barCache instanceof RedisBarCache) {
    const count = await barCache.hydrate(pair, 'M1');
    if (count > 0) app.log.info(`Hydrated ${count} bars from Redis for ${pair}:M1`);
  }

  // 1c.2 Internal data provider (bridges bar → normalized_bar)
  const internalProvider = new InternalProvider(pair, 'M1', barCache, emitter, logger);
  await internalProvider.start();
  serviceRegistry.register(internalProvider);

  // 1c.3 Redis event bridge — cross-instance pub/sub
  let eventBridge: RedisEventBridge | undefined;
  if (redis) {
    const pubClient = createRedisClient(logger, { url: process.env.REDIS_URL, lazyConnect: true });
    const subClient = createRedisClient(logger, { url: process.env.REDIS_URL, lazyConnect: true });
    if (pubClient && subClient) {
      eventBridge = new RedisEventBridge(emitter, pubClient, subClient, ['signal', 'order', 'normalized_bar'], logger);
      await eventBridge.start();
    }
  }

  // 1e. AMQP — event bridge + audit consumer (conditional on RABBITMQ_URL)
  let amqpClient: AmqpClient | null = null;
  let amqpBridge: AmqpEventBridge | undefined;
  let auditConsumer: AuditConsumer | null = null;

  amqpClient = await createAmqpClient(logger);
  if (amqpClient) {
    amqpBridge = new AmqpEventBridge(
      emitter, amqpClient.channel,
      ['signal', 'order', 'risk', 'normalized_bar', 'screener', 'tick'],
      logger,
    );
    await amqpBridge.start();

    auditConsumer = new AuditConsumer(amqpClient.channel, logger);
    await auditConsumer.start();
  }
  app.decorate('auditConsumer', auditConsumer);

  // 1f. Graceful shutdown — bridges first (prevent cross-instance propagation during teardown)
  app.addHook('onClose', async () => {
    if (eventBridge) await eventBridge.stop();
    if (amqpBridge) await amqpBridge.stop();
    if (auditConsumer) await auditConsumer.stop();
    await serviceRegistry.stopAll();
    if (redis) redis.disconnect();
    if (amqpClient) await closeAmqpClient(amqpClient, logger);
  });

  // 4. Global error handler
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

  // 5. Feature modules
  await app.register(tradingModule);
  await app.register(marketDataModule);
  await app.register(analysisModule);
  await app.register(mmModule);

  // 6. Integration modules
  await app.register(openbbModule);
  await app.register(skillsModule);

  // 6b. Services module (health routes, service management)
  await app.register(servicesModule);

  // 6c. Audit module (GET /audit/events)
  await app.register(auditModule);

  // 7. API docs
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const specPath = join(__dirname, '../../openapi.yaml');
  let specContent = '';
  try { specContent = readFileSync(specPath, 'utf8'); } catch { /* spec not built */ }

  app.get('/openapi.yaml', async (_req, reply) => {
    reply.header('Content-Type', 'text/yaml; charset=utf-8');
    reply.header('Cache-Control', 'public, max-age=3600');
    return reply.send(specContent);
  });

  const sendDocs = async (_req: unknown, reply: { header: (k: string, v: string) => unknown; send: (v: string) => unknown }) => {
    reply.header('Content-Type', 'text/html; charset=utf-8');
    reply.header('Cache-Control', 'public, max-age=3600');
    return reply.send(SWAGGER_UI_HTML);
  };
  app.get('/docs', sendDocs);
  app.get('/docs/', sendDocs);

  // Serve TypeDoc output (generated by `npm run docs:api`) at /docs/api/
  const docsApiDir = join(__dirname, '../../docs-api');
  if (existsSync(docsApiDir)) {
    // Redirect bare /docs/api to /docs/api/index.html
    app.get('/docs/api', async (_req, reply) => reply.redirect('/docs/api/index.html'));
    app.get('/docs/api/', async (_req, reply) => reply.redirect('/docs/api/index.html'));
    await app.register(fastifyStatic, {
      root: docsApiDir,
      prefix: '/docs/api/',
      decorateReply: false,
    });
  }

  return app;
}
