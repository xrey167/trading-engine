# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm test                          # run all 187 tests (vitest)
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
domain/          — value objects, enums, trade-signal/trade-params types
gateways/types   — port interfaces (IOrderGateway, IPositionGateway, IFullBrokerAdapter, etc.)
use-cases/       — application services (PlaceOrderUseCase, BacktestUseCase, etc.)
strategies/      — ISignalStrategy implementations (CandleAtr, VolumeBreakout)
money-management/— SL/TP calculators, lot sizing (composite pattern)
analysis/        — ATR, local-extremes modules
plugins/         — Fastify plugins (engine, broker, rate-limit, cors, atr)
routes/          — route handlers; use-cases instantiated inline in handlers
lib/             — Result<T,E> type, DomainError, logger
testing/         — factories and mock adapters for tests
schemas/         — TypeBox schemas for request/response validation
types/           — FastifyInstance declaration merging (app.engine, app.broker, etc.)
```

### Key wiring (src/app.ts → buildApp())

- `PaperBroker` wraps an `EventEmitter`; emits fill/close events
- `enginePlugin` decorates `app.engine`, `app.symbol`, `app.broker` on the Fastify instance
- Routes access engine/broker via `fastify.engine` / `fastify.broker`
- WebSocket `/stream` subscribes to the shared `app.emitter` for real-time events
- `@fastify/rate-limit` registered with `global: false` — routes opt-in via `config: { rateLimit: ... }`
- API docs served at `/docs` (Swagger UI) and `/openapi.yaml`

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

## Required Skills

For every task in this project, always consult and apply the following skills:

- **microservices-patterns** — Follow these patterns for all service design and communication
- **rabbitmq-expert** — Use for all message queue implementations
- **redis-development** — Use for all caching, pub/sub, and session management
- **openbb-app-builder** — Use for all financial data integrations
- **typescript-advanced-types** — Apply strict typing patterns across all TypeScript code

Do not skip these skills even for small changes. They define the project's standards.
