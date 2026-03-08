# trading-engine

Live trading engine ported from MQL/StereoTrader — pure TypeScript with a Fastify HTTP/WebSocket API.

## Features

- **Order types** — limit, stop, MIT with OCO, bracket SL/TP, pullback, trail-entry, CO (cancel-others), and REV (reverse-on-fill) attributes
- **Position management** — per-position SL/TP, 7 trailing stop modes, break-even logic, hedging and netting account modes
- **Scaled orders** — full grid placement from named presets (progressive spacing, ATR-based sizing, OCO chains)
- **Paper broker** — fills, closes, and equity simulation with no live connectivity required
- **Fastify REST + WebSocket API** — TypeBox schema validation, Swagger UI at `/docs`
- **Persistence** — optional PostgreSQL (bars, filled deals, order ledger, account snapshots) via Drizzle ORM
- **Caching** — `IBarCache` cascade: Postgres → Redis → in-memory
- **Cross-instance messaging** — Redis ephemeral pub/sub (signals, bars) + RabbitMQ durable AMQP (orders, risk events)
- **Audit trail** — durable `te.audit` queue → ring buffer → queryable via `GET /audit/events`
- **Analysis pipeline** — ATR, candle-ATR and volume-breakout strategies, backtest, screener service
- **Execution pipeline** — `ExecutionSaga` (signal → risk check → order placement) with per-symbol mutex
- **OpenBB widgets** — positions, orders, account, deals, equity curve, signals, audit, order history
- **Agent SDK skills** — Claude-powered skill execution via SSE streaming (`/skills`)
- **Event catalog** — 250+ `EventDefinition` records across 11 domains with `ScheduledEventCalendar`
- **700+ tests** (Vitest)

## Getting started

```bash
npm install
npm run build
npm start          # listens on :3000
```

```bash
npm test           # vitest
npm run typecheck  # tsc --noEmit
npm run lint       # biome lint
```

## Environment variables

All variables are optional. The engine runs fully in-memory when none are set.

| Variable | Used by |
|----------|---------|
| `API_KEY` | `x-api-key` header guard on protected routes |
| `OPENBB_API_KEY` | `/openbb/*` route authentication |
| `ANTHROPIC_API_KEY` | Agent SDK key for `/skills` routes |
| `CLAUDE_CODE_OAUTH_TOKEN` | OAuth alternative to `ANTHROPIC_API_KEY` |
| `DATABASE_URL` | PostgreSQL — bars, deals, order ledger, account snapshots (Drizzle ORM) |
| `REDIS_URL` | Redis bar cache (write-through) + cross-instance signal/bar pub/sub |
| `RABBITMQ_URL` | AMQP event bridge (durable order/risk events) + audit trail consumer |
| `NODE_ENV` | Set to `production` to hide stack traces in error responses |

## API reference

### Orders

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/orders` | List all pending orders |
| `POST` | `/orders` | Place a new order (rate-limited: 10/s) |
| `PATCH` | `/orders/:id` | Move an order to a new price |
| `DELETE` | `/orders/:id` | Cancel an order |

**POST /orders**
```json
{
  "type": "BUY_LIMIT",
  "price": 1.09500,
  "size": 1,
  "attributes": {
    "oco": true,
    "bracketSL": 0.0050,
    "bracketTP": 0.0100,
    "co": false,
    "rev": false
  }
}
```
Order types: `BUY_LIMIT`, `BUY_STOP`, `SELL_LIMIT`, `SELL_STOP`, `BUY_MIT`, `SELL_MIT`

### Positions

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/positions` | Get long and short position slots |
| `POST` | `/positions` | Market buy or sell |
| `DELETE` | `/positions/:side` | Close a position (`long`, `short`, `all`) |
| `PUT` | `/positions/:side/sl-tp` | Update SL/TP/trail/BE on a live position |

**PUT /positions/:side/sl-tp** (all fields optional)
```json
{
  "sl": 20,
  "tp": 40,
  "slActive": true,
  "trailBeginPts": 50,
  "beActive": true,
  "beAddPts": 5
}
```

### Bars

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/bars` | Feed a bar to the engine (rate-limited: 120/s) |

**POST /bars** — drives `engine.onBar()`, advancing fills, trailing stops, and all bar-dependent logic.
```json
{
  "bar":  { "open": 1.1, "high": 1.11, "low": 1.095, "close": 1.105, "time": "2024-01-01T00:00:00Z" },
  "bars": [ ... ]
}
```
`bar` is the current candle; `bars` is the full lookback array with `bars[0]` most recent.

### Scaled orders

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/scaled-orders` | Place a full order grid from a named preset |

### Account & engine

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/account` | Equity and balance |
| `PUT` | `/engine/config` | Toggle engine flags (e.g. `removeOrdersOnFlat`) |
| `PUT` | `/atr/config` | Update ATR multipliers at runtime |

### Analysis

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/v1/backtest` | Backtest a strategy on a bar series |
| `POST` | `/v1/signal` | Evaluate a strategy → `BUY` / `SELL` / `HOLD` |
| `POST` | `/v1/money-management` | Validate a money-management config |
| `GET` | `/v1/positions` | List ticket-based positions (quant-lib VO) |
| `DELETE` | `/v1/positions/:ticket` | Close a ticket-based position |
| `PATCH` | `/v1/positions/:ticket` | Update SL/TP on a ticket-based position |

### Services

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/services` | List all registered services and their status |
| `GET` | `/services/:name` | Detail for a single service |
| `POST` | `/services/:name/start` | Start a service |
| `POST` | `/services/:name/stop` | Stop a service |

### Audit trail

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/audit/events` | Query audit events (filters: `type`, `since`, `limit`); 503 when `RABBITMQ_URL` unset |

### WebSocket stream

```
GET /stream  (ws://)
```

Real-time JSON events with a 15-second heartbeat:
```json
{ "type": "bar",   "bar": { ... } }
{ "type": "fill",  "side": 1, "size": 1, "price": 1.0950, "time": "...", "id": "fill-1" }
{ "type": "close", "side": 1, "size": 1, "price": 1.1000, "time": "..." }
```

### Agent SDK skills

```
GET  /skills       — list available skills
POST /skills/:name — execute a skill; streams SSE chunks to the client
```

### OpenBB widgets

All routes under `/openbb/*` return data formatted for the [OpenBB Terminal Pro](https://openbb.co) widget layer. A `widgets.json` manifest is served at `/widgets.json`.

| Path | Description |
|------|-------------|
| `/openbb/positions` | Live positions |
| `/openbb/orders` | Pending orders |
| `/openbb/account/equity` | Equity over time |
| `/openbb/account/balance` | Current balance |
| `/openbb/deals` | Filled deals history |
| `/openbb/equity-curve` | Equity curve (account snapshots) |
| `/openbb/signals` | Recent strategy signals |
| `/openbb/audit` | Audit event stream |
| `/openbb/order-history` | Order lifecycle ledger |
| `/openbb/symbol` | Current symbol info |
| `/openbb/engine-config` | Engine flag configuration |

### API docs

```
GET /docs          — Swagger UI (dark theme)
GET /openapi.yaml  — raw OpenAPI 3.0 spec
```

## Architecture

```
trading-engine.ts          — standalone core engine (~1700 lines)
                             order book, position management, trailing stops,
                             ATR/SMA/RSI, scaled-order grid engine
trading-engine.test.ts     — engine unit tests

src/
  app.ts                   — buildApp() factory; registers 9 module plugins
  server.ts                — entry point (port 3000)

  shared/
    lib/                   — Result<T,E>, DomainError, logger, mutex,
                             circuit-breaker, api-utils, amqp-client,
                             amqp-event-bridge, redis-client, redis-event-bridge
    db/                    — Drizzle ORM: schema, client, deal-writer,
                             order-writer, snapshot-writer
    domain/                — value objects, enums, trade-signal, trade-params,
                             trading-calendar, event catalog (250+ definitions)
    schemas/               — shared TypeBox schemas (OHLC, enums, errors)
    services/              — IService, BaseService, ServiceRegistry, AppEventMap
    plugins/               — rate-limit, cors
    testing/               — factories, mock adapters
    event-bus.ts           — TypedEventBus<TMap> (generic typed pub/sub)

  broker/                  — gateway interfaces, PaperBroker, BrokerService,
                             in-memory and MT5 adapters

  engine/                  — engine-plugin, atr-plugin, routes (engine + atr + account)

  trading/                 — positions, orders, scaled-orders, v1-positions

  market-data/             — bars ingestion, WebSocket stream, bar-cache,
                             redis-bar-cache, pg-bar-cache, data-provider-service

  analysis/                — ATR, candle-ATR + volume-breakout strategies,
                             backtest, signal evaluation, screener-service

  managers/                — ExecutionSaga (signal→risk→order),
                             RiskManager, OrderManager

  money-management/        — SL/TP calculators, composite lot-size module

  audit/                   — AuditConsumer (AMQP durable queue → ring buffer)
                             + GET /audit/events route

  services/                — /services/* health and lifecycle routes

  integrations/
    openbb/                — OpenBB widget routes + widgets.json manifest
    skills/                — Agent SDK SSE skill execution
```

### Persistence cascade

When `DATABASE_URL` is set, bars, deals, the order lifecycle ledger, and account snapshots are persisted to PostgreSQL via Drizzle ORM. Redis (`REDIS_URL`) provides a write-through bar cache and ephemeral cross-instance pub/sub. RabbitMQ (`RABBITMQ_URL`) adds durable order/risk event delivery and the `te.audit` audit trail queue.

```
Bar cache:     Postgres → Redis → in-memory  (first available)
Order events:  TypedEventBus → AmqpEventBridge → te.audit queue → AuditConsumer ring buffer
Deals:         DealWriter (order FILLED events → deals table)
Equity curve:  SnapshotWriter (periodic + post-fill snapshots → account_snapshots table)
Order ledger:  OrderWriter (all order lifecycle events → order_events table)
```

### Event flow

```
POST /bars
  └─ engine.onBar()          — fills, trailing stops, position updates
       └─ emitter events     — bar / fill / close
            ├─ WebSocket /stream clients
            ├─ StrategyService  → signal event
            │    └─ OrderManager → ExecutionSaga → RiskManager → order placement
            ├─ SnapshotWriter  (on FILLED events with significant equity change)
            ├─ DealWriter      (on FILLED events)
            └─ AmqpEventBridge (order + risk events → RabbitMQ)
                   └─ AuditConsumer (te.audit queue → ring buffer)
```

## Result type pattern

All use-cases and gateway methods return `Result<T, DomainError>`:

```typescript
import { ok, err, isOk, isErr } from './src/shared/lib/result.js';

const result = await broker.placeOrder(params);
if (isErr(result)) {
  console.error(result.error.code, result.error.message);
} else {
  console.log(result.value);
}
```

## Using as a library

```typescript
import { buildApp } from './src/app.js';

const app = await buildApp(
  { logger: true },
  { symbol: { pair: 'GBPUSD', digits: 5 }, hedging: false },
);
await app.listen({ port: 3000 });
```

## Event catalog

Static catalog of 250+ event definitions across 11 domains for strategy-layer filtering.

```typescript
import { queryEvents, highImpactEvents, EventDomain } from './src/shared/domain/events/index.js';
import { ScheduledEventCalendar } from './src/shared/domain/events/scheduled.js';
import { TradingCalendar } from './src/shared/domain/trading-calendar.js';
import { NYSE } from './src/shared/domain/countries.js';

const usHighImpact = queryEvents({ domain: EventDomain.Economic, countryCode: 'US', importance: 'HIGH' });

const cal = new ScheduledEventCalendar(new TradingCalendar(NYSE));
cal.add({ id: 'nfp-2025-08-01', definitionId: 'US.JOBS.NFP', date: '2025-08-01', ticker: 'EURUSD', currency: 'USD' });

cal.isEventToday(new Date('2025-08-01T14:00:00Z'), 'US.JOBS.NFP');               // true
cal.isTradingDaysBeforeEvent(new Date('2025-07-30'), 'US.JOBS.NFP', 2);          // true
cal.hasHighImpactEventToday(new Date('2025-08-01'), { currency: 'USD' });         // true
```

## Database setup

When `DATABASE_URL` is set, run once to create the schema:

```bash
npm run db:push       # push schema to Postgres (dev / CI)
npm run db:generate   # generate migration files (production deploys)
```

## Rate limits

- `POST /orders` — 10 requests/second
- `POST /bars` — 120 requests/second
