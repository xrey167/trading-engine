# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm test                          # run all tests (vitest)
npx vitest run src/domain         # run tests in a specific directory
npx vitest run -t "trailing stop" # run tests matching a name pattern
npm run typecheck                 # tsc --noEmit
npm run build                     # tsc → dist/
npm run lint                      # biome lint
npm start                         # node dist/src/server.js (port 3000)
npm run dev                       # same with --watch
npm run validate                  # contract validation against running backend (port 3000)
npm run db:push                   # push Drizzle schema to Postgres (dev)
npm run db:generate               # generate Drizzle migration files
npm run clean                     # rm -rf dist
```

## Architecture

### Two-layer design

1. **Core engine** (`trading-engine.ts`) — standalone ~1600-line module ported from MQL/StereoTrader. Contains order book, position management, trailing stops, ATR/SMA/RSI calculations. No framework dependencies. All bar-driven: call `engine.onBar(bar, bars)` to advance state.

2. **Fastify HTTP layer** (`src/`) — REST + WebSocket API wrapping the core engine.

### Module-based structure in `src/`

```
shared/
  lib/              — Result<T,E>, DomainError, logger, mutex, circuit-breaker,
                      redis-client, redis-event-bridge, amqp-client, amqp-event-bridge
  db/               — Drizzle ORM schema, client, deal-writer, snapshot-writer (optional PostgreSQL)
  domain/           — value objects, enums, trade-signal/trade-params, trading-calendar
  schemas/          — common TypeBox schemas (OHLC, enums, errors)
  services/         — IService, BaseService, ServiceRegistry, event-map (AppEventMap)
  plugins/          — rate-limit, cors
  testing/          — factories, mock adapters, mock services
  types/            — FastifyInstance declaration merging
  event-bus.ts      — TypedEventBus<TMap> (typed pub/sub)
broker/             — gateway interfaces, PaperBroker, BrokerService, in-memory/mt5 adapters
engine/             — core engine Fastify wrapping (engine-plugin, atr-plugin, routes)
trading/            — positions, orders, scaled-orders, v1-positions
market-data/        — bars ingestion, WebSocket stream, bar-cache, redis-bar-cache,
                      data-provider-types, internal-provider
analysis/           — ATR, strategies, signals, backtest, strategy-service, screener-service
managers/           — execution-saga, order-manager, risk-manager
money-management/   — SL/TP calculators, lot sizing (composite pattern)
services/           — /services/* health + management routes
audit/              — AMQP audit trail consumer + /audit/events route
integrations/
  openbb/           — OpenBB widget routes
  skills/           — Agent SDK skill execution via SSE
```

### Route groups

| Prefix | Methods | Notes |
|--------|---------|-------|
| `/positions` | GET, POST, DELETE, PUT | market buy/sell, close, SL/TP, flat, hedge |
| `/orders` | GET, POST, PATCH, DELETE | place/move/cancel; POST rate-limited 10/s |
| `/bars` | POST | drives `engine.onBar()`; rate-limited 120/s |
| `/stream` | WS GET | real-time bar/fill/close events, 15s heartbeat |
| `/account` | GET | equity & balance |
| `/engine/config` | PUT | toggle engine flags (removeOrdersOnFlat) |
| `/scaled-orders` | POST | place full order grid from named preset |
| `/atr/config` | PUT | update ATR multipliers at runtime |
| `/v1/backtest` | POST | backtest strategy on bars → signal counts |
| `/v1/signal` | POST | evaluate strategy → BUY/SELL/HOLD |
| `/v1/positions` | GET, DELETE, PATCH | ticket-based position CRUD (quant-lib VO) |
| `/v1/money-management` | POST | validate money management config |
| `/openbb/*` | GET | widgets.json, positions, orders, account, deals, equity-curve, signals, audit |
| `/skills` | GET, POST | Agent SDK skill execution via SSE streaming |
| `/audit/events` | GET | audit trail query (type/since/limit filters); 503 when RABBITMQ_URL unset |
| `/docs`, `/openapi.yaml` | GET | Swagger UI (dark theme) and raw spec |

### Key wiring (src/app.ts → buildApp())

- `PaperBroker` wraps an `EventEmitter`; emits fill/close events
- `enginePlugin` decorates `app.engine`, `app.symbol`, `app.broker` on the Fastify instance
- Routes access engine/broker via `fastify.engine` / `fastify.broker`
- WebSocket `/stream` subscribes to the shared `app.emitter` for real-time events
- `@fastify/rate-limit` registered with `global: false` — routes opt-in via `config: { rateLimit: ... }`
- API docs served at `/docs` (Swagger UI) and `/openapi.yaml`
- `app.engineMutex` — Mutex serializing concurrent engine mutations
- `app.atrModule` / `app.atrConfig` — ATR indicator with runtime-mutable config
- `app.emitter.setMaxListeners(0)` — unbounded; each WS client adds 3 listeners
- Skills routes use `@anthropic-ai/claude-agent-sdk` — `query()` streams via SSE to clients
- `app.barCache` — `IBarCache` (Postgres > Redis > in-memory cascade based on env vars)
- `app.snapshotWriter` — `SnapshotWriter | null` (periodic + event-driven equity snapshots; null when `DATABASE_URL` unset)
- `DealWriter` — subscribes to order events, writes filled deals to Postgres (fire-and-forget)
- `RedisEventBridge` — optional cross-instance pub/sub for `signal`, `normalized_bar` events (ephemeral)
- `AmqpEventBridge` — optional durable cross-instance pub/sub via RabbitMQ for `order`, `risk` events; enabled when `RABBITMQ_URL` set
- When both bridges active, events are split to prevent duplicate delivery
- `AuditConsumer` — durable queue `te.audit` consuming all bridged events into a ring buffer; queryable via `GET /audit/events`

### Result type pattern

All gateway and use-case methods return `Result<T, DomainError>` (discriminated union with `ok: boolean`). Use `ok()` / `err()` constructors and `isOk()` / `isErr()` guards from `src/shared/lib/result.ts`.

## Conventions

- **Enums use `as const` maps** — both in the core engine and domain layer:
  ```typescript
  export const Side = { None: 0, Long: 1, Short: -1 } as const;
  export type Side = (typeof Side)[keyof typeof Side];
  ```
- **ESM with `.js` extensions** — all relative imports must use `.js` (Node ESM requirement)
- **biome v2** — `biome.json` uses `includes` (not `include`); formatter disabled, linter only
- **TypeBox for schemas** — request/response validation and serialization. Schemas are now co-located with their modules (e.g., `src/trading/schemas.ts`).
- **No formatter** — biome formatter is disabled; don't add prettier or similar

## Environment

| Variable | Required | Used by |
|----------|----------|---------|
| `API_KEY` | No | `x-api-key` header guard on protected routes; disabled if unset |
| `OPENBB_API_KEY` | No | `/openbb/*` routes (timing-safe compare) |
| `ANTHROPIC_API_KEY` | For `/skills` | Agent SDK key (or use `CLAUDE_CODE_OAUTH_TOKEN`) |
| `CLAUDE_CODE_OAUTH_TOKEN` | For `/skills` | OAuth alternative to `ANTHROPIC_API_KEY` |
| `DATABASE_URL` | No | PostgreSQL persistence (bars, deals, audit, account snapshots via Drizzle ORM); falls back to Redis/in-memory when unset |
| `REDIS_URL` | No | Redis bar cache (write-through) + cross-instance pub/sub event bridge; falls back to in-memory when unset |
| `RABBITMQ_URL` | No | AMQP event bridge (durable order/risk events) + audit trail consumer; disabled when unset |
| `NODE_ENV` | No | `production` hides stack traces in error responses |

No `.env` file is committed. Node 18+ required (ES2022 target).

## Gotchas

- **Vitest runs both `src/` and `dist/` tests** — no vitest.config exists; discovery is automatic. If `dist/` is stale, you'll see doubled or failing tests. Run `npm run build` to sync, or delete `dist/` test files.
- **Engine is bar-driven** — orders and positions only update when `POST /bars` calls `engine.onBar()`. Nothing happens between bars.
- **`app.inject()` for tests, not HTTP** — Fastify's zero-cost injection; all route tests use this pattern with `beforeEach(buildApp)` / `afterEach(app.close)`.
- **Mutex on engine** — `app.engineMutex` serializes concurrent writes. Don't call `engine.onBar()` outside the mutex.
- **Directory name has a space** — `npx vitest run "src/market-data"` requires quoted paths; prefer `-t "pattern"` for targeted test runs.

## Relevant Skills

Use these skills **when the task involves their domain**:

- **typescript-advanced-types** — strict typing, generic patterns, `as const` maps
- **openbb-app-builder** — OpenBB widget/app integrations (`/openbb/*` routes)
- **fastify-typescript** — Fastify plugin patterns, route schemas, lifecycle hooks
- **microservices-patterns** — if adding inter-service communication
- **redis-development** — Redis bar cache (`RedisBarCache`) and pub/sub event bridge (`RedisEventBridge`)
- **rabbitmq-expert** — AMQP event bridge (`AmqpEventBridge`) for durable order/risk events
