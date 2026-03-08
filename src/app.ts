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
import { PostgresBarCache } from './market-data/pg-bar-cache.js';
import type { IBarCache } from './market-data/data-provider-types.js';
import { DealWriter } from './shared/db/deal-writer.js';
import { SnapshotWriter } from './shared/db/snapshot-writer.js';
import { InternalProvider } from './market-data/internal-provider.js';
import { toLogger } from './shared/lib/logger.js';
import { createRedisClient } from './shared/lib/redis-client.js';
import { RedisEventBridge } from './shared/lib/redis-event-bridge.js';
import type { BridgeableEvent } from './shared/lib/redis-event-bridge.js';
import { createAmqpClient, closeAmqpClient } from './shared/lib/amqp-client.js';
import { AmqpEventBridge } from './shared/lib/amqp-event-bridge.js';
import { AuditConsumer } from './audit/audit-consumer.js';
import { createDatabase, OrderWriter } from './shared/db/index.js';
import { TypedEventBus } from './shared/event-bus.js';
import type { AppEventMap } from './shared/services/event-map.js';
import { ServiceRegistry } from './shared/services/service-registry.js';
import { BrokerService } from './broker/broker-service.js';
import { RiskManagerService } from './managers/risk-manager.js';
import { ExecutionSaga } from './managers/execution-saga.js';
import { OrderManagerService } from './managers/order-manager.js';
import { TickIngestionService } from './market-data/tick-ingestion-service.js';
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
  // Tags follow the order defined in openapi.yaml (no alpha sort)
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
  const broker  = new PaperBroker(emitter, app.log, symbol.name);

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

  // 1c. Bar cache — Postgres > Redis > in-memory cascade
  const logger = toLogger(app.log);

  const redis = createRedisClient(logger);
  const database = createDatabase(logger);

  let barCache: IBarCache;
  if (database) {
    const pgCache = new PostgresBarCache(database.db, logger);
    const count = await pgCache.hydrate(pair, 'M1');
    if (count > 0) app.log.info(`Hydrated ${count} bars from Postgres for ${pair}:M1`);
    barCache = pgCache;
  } else if (redis) {
    const redisCache = new RedisBarCache(redis, logger);
    const count = await redisCache.hydrate(pair, 'M1');
    if (count > 0) app.log.info(`Hydrated ${count} bars from Redis for ${pair}:M1`);
    barCache = redisCache;
  } else {
    barCache = new InMemoryBarCache();
  }
  app.decorate('barCache', barCache);

  // 1c.2 Internal data provider (bridges bar → normalized_bar)
  const internalProvider = new InternalProvider(pair, 'M1', barCache, emitter, logger);
  await internalProvider.start();
  serviceRegistry.register(internalProvider);

  // 1c.3 Event bridges — cross-instance pub/sub
  // When both REDIS_URL and RABBITMQ_URL are set, split events to prevent duplicate delivery:
  //   AMQP  → order, risk (persistent, durable — reliability matters)
  //   Redis → signal, normalized_bar (ephemeral, high-frequency — speed matters)
  // When only one bridge is configured, it handles all events.
  const ALL_BRIDGE_EVENTS: readonly BridgeableEvent[] = ['signal', 'order', 'risk', 'normalized_bar'];
  const AMQP_EVENTS: readonly BridgeableEvent[] = ['order', 'risk'];
  const REDIS_EVENTS: readonly BridgeableEvent[] = ['signal', 'normalized_bar'];

  let redisBridge: RedisEventBridge | undefined;
  let amqpBridge: AmqpEventBridge | undefined;
  const amqpClient = await createAmqpClient(logger);

  if (redis) {
    const pubClient = createRedisClient(logger, { url: process.env.REDIS_URL, lazyConnect: true });
    const subClient = createRedisClient(logger, { url: process.env.REDIS_URL, lazyConnect: true });
    if (pubClient && subClient) {
      const redisEvents = amqpClient ? REDIS_EVENTS : ALL_BRIDGE_EVENTS;
      redisBridge = new RedisEventBridge(emitter, pubClient, subClient, redisEvents, logger);
      await redisBridge.start();
    }
  }

  let auditConsumer: AuditConsumer | null = null;
  if (amqpClient) {
    const amqpEvents = redisBridge ? AMQP_EVENTS : ALL_BRIDGE_EVENTS;
    amqpBridge = new AmqpEventBridge(emitter, amqpClient.channel, amqpEvents, logger);
    await amqpBridge.start();

    // Dedicated channel for audit consumer — channel failures are isolated per concern
    const auditChannel = await amqpClient.connection.createConfirmChannel();
    auditConsumer = new AuditConsumer(auditChannel, logger, { db: database?.db });
    await auditConsumer.start();
  }
  app.decorate('auditConsumer', auditConsumer);

  // 1c.3b. PostgreSQL persistence (optional — falls back to in-memory when DATABASE_URL unset)
  let snapshotWriter: SnapshotWriter | null = null;
  if (database) {
    new OrderWriter(database.db, emitter, logger);
    new DealWriter(database.db, emitter, logger);
    snapshotWriter = new SnapshotWriter(database.db, broker, logger);
    snapshotWriter.start(60_000, emitter);
  }
  app.decorate('snapshotWriter', snapshotWriter);

  // 1c.4 Manager services (risk → saga → order-manager)
  const riskManager = new RiskManagerService(
    { id: 'risk:primary', name: 'risk-primary', maxOpenPositions: 10, maxPositionsPerSymbol: 3, maxDailyLoss: 1000 },
    emitter,
    logger,
  );
  const executionSaga = new ExecutionSaga('saga:primary', 'execution-saga-primary', riskManager, serviceRegistry, emitter, logger);
  const orderManager = new OrderManagerService({ id: 'order-mgr:primary', name: 'order-manager-primary' }, executionSaga, emitter, logger);
  await riskManager.start();
  await executionSaga.start();
  await orderManager.start();
  serviceRegistry.register(riskManager);
  serviceRegistry.register(executionSaga);
  serviceRegistry.register(orderManager);

  // 1c.5 Tick ingestion (bridges tick events → engine.onTick via mutex)
  const mutexAdapter = {
    async runExclusive<T>(fn: () => Promise<T>): Promise<T> {
      const release = await app.engineMutex.acquire();
      try { return await fn(); } finally { release(); }
    },
  };
  const tickIngestion = new TickIngestionService(app.engine, mutexAdapter, emitter, logger);
  await tickIngestion.start();
  serviceRegistry.register(tickIngestion);

  // 1d. Graceful shutdown — bridges first (prevent cross-instance propagation during teardown)
  app.addHook('onClose', async () => {
    if (redisBridge) await redisBridge.stop();
    if (amqpBridge) await amqpBridge.stop();
    if (auditConsumer) await auditConsumer.stop();
    if (snapshotWriter) snapshotWriter.stop();
    await serviceRegistry.stopAll();
    if (amqpClient) await closeAmqpClient(amqpClient, logger);
    if (redis) redis.disconnect();
    if (database) await database.pool.end();
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
  // Try project root first (process.cwd()), fall back to relative-from-dist path
  const specCandidates = [
    join(process.cwd(), 'openapi.yaml'),
    join(__dirname, '../../openapi.yaml'),
    join(__dirname, '../openapi.yaml'),
  ];
  let specContent = '';
  for (const candidate of specCandidates) {
    try { specContent = readFileSync(candidate, 'utf8'); break; } catch { /* try next */ }
  }

  app.get('/openapi.yaml', async (_req, reply) => {
    if (!specContent) {
      reply.status(404).send('openapi.yaml not found — run npm run build first');
      return;
    }
    reply.header('Content-Type', 'text/yaml; charset=utf-8');
    reply.header('Cache-Control', 'no-cache');
    return reply.send(specContent);
  });

  const sendDocs = async (_req: unknown, reply: { header: (k: string, v: string) => unknown; send: (v: string) => unknown }) => {
    reply.header('Content-Type', 'text/html; charset=utf-8');
    reply.header('Cache-Control', 'no-cache');
    return reply.send(SWAGGER_UI_HTML);
  };
  app.get('/docs', sendDocs);
  app.get('/docs/', sendDocs);

  // Serve TypeDoc output (generated by `npm run docs:api`) at /docs/api/
  const docsApiDir = join(__dirname, '../../docs-api');
  // Kubernetes / load-balancer health probes
  app.get('/health', async (_req, reply) => {
    reply.send({ status: 'ok', uptime: process.uptime() });
  });
  app.get('/readyz', async (_req, reply) => {
    reply.send({ status: 'ok' });
  });

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
