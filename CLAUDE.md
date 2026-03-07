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
```

## Architecture

### Two-layer design

1. **Core engine** (`trading-engine.ts`) — standalone ~1600-line module ported from MQL/StereoTrader. Contains order book, position management, trailing stops, ATR/SMA/RSI calculations. No framework dependencies. All bar-driven: call `engine.onBar(bar, bars)` to advance state.

2. **Fastify HTTP layer** (`src/`) — REST + WebSocket API wrapping the core engine.

### Hexagonal / ports-and-adapters structure in `src/`

```
domain/           — value objects, enums, trade-signal/trade-params types
gateways/         — port interfaces + in-memory/mt5 adapters, broker registry
use-cases/        — application services (9 use-cases, see list below)
strategies/       — ISignalStrategy implementations (CandleAtr, VolumeBreakout)
money-management/ — SL/TP calculators, lot sizing (composite pattern)
analysis/         — ATR, local-extremes modules
plugins/          — Fastify plugins (engine, broker, rate-limit, cors, atr)
routes/           — 15 route groups (see below)
lib/              — Result<T,E> type, DomainError, logger
testing/          — factories (makeBar, makePosition) and mock adapters
schemas/          — TypeBox schemas for request/response validation
types/            — FastifyInstance declaration merging (app.engine, app.broker, etc.)
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
| `/openbb/*` | GET | widgets.json, positions, orders, account, deals |
| `/skills` | GET, POST | Agent SDK skill execution via SSE streaming |
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

### Result type pattern

All gateway and use-case methods return `Result<T, DomainError>` (discriminated union with `ok: boolean`). Use `ok()` / `err()` constructors and `isOk()` / `isErr()` guards from `src/lib/result.ts`.

## Conventions

- **Enums use `as const` maps** — both in the core engine and domain layer:
  ```typescript
  export const Side = { None: 0, Long: 1, Short: -1 } as const;
  export type Side = (typeof Side)[keyof typeof Side];
  ```
- **ESM with `.js` extensions** — all relative imports must use `.js` (Node ESM requirement)
- **biome v2** — `biome.json` uses `includes` (not `include`); formatter disabled, linter only
- **TypeBox for schemas** — request/response validation and serialization in `src/schemas/index.ts`
- **No formatter** — biome formatter is disabled; don't add prettier or similar

## Environment

| Variable | Required | Used by |
|----------|----------|---------|
| `API_KEY` | No | `x-api-key` header guard on protected routes; disabled if unset |
| `OPENBB_API_KEY` | No | `/openbb/*` routes (timing-safe compare) |
| `ANTHROPIC_API_KEY` | For `/skills` | Agent SDK key (or use `CLAUDE_CODE_OAUTH_TOKEN`) |
| `CLAUDE_CODE_OAUTH_TOKEN` | For `/skills` | OAuth alternative to `ANTHROPIC_API_KEY` |
| `NODE_ENV` | No | `production` hides stack traces in error responses |

No `.env` file is committed. Node 18+ required (ES2022 target).

## Gotchas

- **Vitest runs both `src/` and `dist/` tests** — no vitest.config exists; discovery is automatic. If `dist/` is stale, you'll see doubled or failing tests. Run `npm run build` to sync, or delete `dist/` test files.
- **Engine is bar-driven** — orders and positions only update when `POST /bars` calls `engine.onBar()`. Nothing happens between bars.
- **`app.inject()` for tests, not HTTP** — Fastify's zero-cost injection; all route tests use this pattern with `beforeEach(buildApp)` / `afterEach(app.close)`.
- **Mutex on engine** — `app.engineMutex` serializes concurrent writes. Don't call `engine.onBar()` outside the mutex.

## Relevant Skills

Use these skills **when the task involves their domain**:

- **typescript-advanced-types** — strict typing, generic patterns, `as const` maps
- **openbb-app-builder** — OpenBB widget/app integrations (`/openbb/*` routes)
- **fastify-typescript** — Fastify plugin patterns, route schemas, lifecycle hooks
- **microservices-patterns** — if adding inter-service communication
- **redis-development** — if adding caching or pub/sub (not currently used)
- **rabbitmq-expert** — if adding message queues (not currently used)
