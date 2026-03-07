# Tech Debt Catalog

**Reviewer:** reviewer-7 (engineering:tech-debt)
**Date:** 2026-03-07
**Branch:** `review/tech-debt`
**Scope:** Full `src/` tree + `trading-engine.ts`

---

## Executive Summary

**Debt Score: 6.2 / 10** (moderate-high)

The codebase is well-structured with clean hexagonal architecture, strong typing (zero `any` usage), and a disciplined `Result<T, E>` pattern. However, it carries meaningful tech debt across several categories:

- **3 compile-time errors** in committed/tracked files (`api-utils.ts` references a non-existent `unauthorized` export)
- **20 `notImplemented` stubs** across 4 MT5 gateway files with no implementation path
- **No authentication** on 11 of 13 route groups (only OpenBB has optional API key guard)
- **Use-cases instantiated inline** in route handlers (no composition root)
- **PaperBroker god class** implements 7 interfaces in a single 248-line file
- **`console.log`** used directly in production code paths instead of structured logger
- **OpenAPI spec loaded synchronously** at startup with silent failure on missing file

The debt is manageable at the current project size but will compound quickly as real broker integrations and multi-user support are added.

---

## 1. Compile-Time Errors (Critical)

These are broken imports/types that prevent clean `tsc --noEmit`:

| # | File | Line | Error | Severity |
|---|------|------|-------|----------|
| 1 | `src/lib/api-utils.ts` | 3 | Imports `unauthorized` from `./errors.js` but `errors.ts` does not export it | **Critical** |
| 2 | `src/lib/api-utils.ts` | 12 | References `'UNAUTHORIZED'` in switch case but `DomainError` union has no such variant | **Critical** |
| 3 | `src/routes/skills/index.ts` | 4 | Imports `SkillRunSchema`/`SkillRunBody` from schemas (WIP on `feat/agent-sdk-skills-route` branch, uncommitted on disk) | **Medium** (WIP) |

**Impact:** `api-utils.ts` is an untracked file (not yet committed to main), but `requireApiKey()` and `withErrorHandler()` are the intended auth/error-handling utilities. They cannot be used until `UNAUTHORIZED` is added to the `DomainError` union and an `unauthorized()` factory function is exported from `errors.ts`.

---

## 2. TODO/FIXME Catalog

| # | File:Line | Tag | Description |
|---|-----------|-----|-------------|
| T1 | `src/app.ts:58` | `TODO(architecture)` | Use-cases instantiated inline in route handlers; need composition root as dependency graphs grow |
| T2 | `src/plugins/broker.ts:28` | `TODO(architecture)` | PaperBroker implements 7 interfaces (~230 lines); extract into separate gateway classes for real broker adapters |
| T3 | `src/plugins/broker.ts:119` | `TODO` | O(n) linear scan for `getPositionByTicket` -- replace with `Map<ticket, PositionInfoVO>` |
| T4 | `src/plugins/broker.ts:126` | `TODO` | O(n) linear scan for `closePositionByTicket` -- same Map optimization needed |
| T5 | `src/gateways/types.ts:5` | `TODO(architecture)` | Dependency inversion violation: gateway port imports `Bars` from `trading-engine.ts` (implementation layer) |
| T6 | `src/routes/v1-positions/index.ts:8` | `TODO` | Dev-only stub auth (`DEFAULT_USER_ID = 'default'`) -- replace with real JWT/session before production |

---

## 3. Stub / notImplemented Catalog

All 4 MT5 gateway files return `notImplemented` for every method (20 stubs total):

| File | Methods Stubbed | Count |
|------|----------------|-------|
| `src/gateways/mt5/mt5-account-gateway.ts` | `getAccountInfo`, `getBalance`, `isReal`, `isHedging`, `getSymbolInfo`, `refreshRates`, `getBars`, `getAtr` | 8 |
| `src/gateways/mt5/mt5-position-gateway.ts` | `getPositions`, `getPositionByTicket`, `closePositionByTicket`, `modifyPosition` | 4 |
| `src/gateways/mt5/mt5-order-gateway.ts` | `placeOrder`, `modifyOrder`, `deleteOrder` | 3 |
| `src/gateways/mt5/mt5-deal-gateway.ts` | `getDeals`, `getDealByTicket`, `getHistoryOrders` | 3 |
| | **Total** | **20** |

These stubs exist to satisfy the `IFullBrokerAdapter` interface for future MT5 bridge integration. They are correctly wired through `BrokerRegistry` but have no implementation path or tracking issue.

---

## 4. Missing Pieces

### 4.1 Authentication (Security Debt)

| Route Group | Auth? | Notes |
|-------------|-------|-------|
| `GET/POST/DELETE /orders` | None | Rate-limited but unauthenticated |
| `GET/DELETE /positions` | None | |
| `POST /bars` | None | Rate-limited (120/s) but unauthenticated |
| `GET /stream` (WebSocket) | None | |
| `GET /account` | None | |
| `GET /engine/*` | None | |
| `POST /scaled-orders` | None | |
| `GET /atr` | None | |
| `POST /v1/backtest` | None | |
| `POST /v1/signal` | None | |
| `/v1/positions/*` | **Hardcoded** | `DEFAULT_USER_ID = 'default'` |
| `/openbb/*` | **Optional** | Only when `OPENBB_API_KEY` env var is set |
| `/money-management` | None | |

The `requireApiKey()` utility exists in `api-utils.ts` but cannot compile (see Section 1) and is not applied to any route.

### 4.2 Composition Root

Use-cases are instantiated inline in 6 route handlers:

- `src/routes/signal/index.ts:47` -- `new RunSignalUseCase(strategy, fastify.log)`
- `src/routes/backtest/index.ts:41` -- `new BacktestUseCase(strategy, fastify.log)`
- `src/routes/money-management/index.ts:16` -- `new CreateMoneyManagementUseCase(fastify.log)`
- `src/routes/v1-positions/index.ts:28` -- `new GetPositionsUseCase(broker, log)`
- `src/routes/v1-positions/index.ts:56` -- `new ClosePositionUseCase(broker, log)`
- `src/routes/v1-positions/index.ts:86` -- `new ModifyPositionUseCase(broker, log)`

This couples route handlers to concrete use-case constructors. The TODO at `src/app.ts:58` acknowledges this.

### 4.3 Missing `flatMapResult`

The MEMORY.md references `flatMapResult` being added to `src/lib/result.ts`, but the file only contains `ok`, `err`, `isOk`, `isErr`, and `mapResult`. Either it was removed or never merged.

### 4.4 OpenAPI Spec Silent Failure

At `src/app.ts:115-116`, the OpenAPI spec is loaded synchronously with a silently swallowed error:
```typescript
let specContent = '';
try { specContent = readFileSync(specPath, 'utf8'); } catch { /* spec not built */ }
```
If the spec file is missing, `/openapi.yaml` returns an empty string with 200 OK and no warning.

---

## 5. Coupling Issues

| # | Issue | Files | Severity |
|---|-------|-------|----------|
| C1 | **Gateway port depends on engine implementation**: `gateways/types.ts` imports `Bars` from `trading-engine.ts` (violates dependency inversion) | `src/gateways/types.ts:8` | High |
| C2 | **PaperBroker implements both IBrokerAdapter (engine) and all 6 gateway interfaces**: mixing infrastructure adapter with application ports in one class | `src/plugins/broker.ts:39` | Medium |
| C3 | **EventEmitter is untyped**: `app.emitter` is a raw Node.js `EventEmitter` with no type-safe event map; consumers rely on string event names (`'fill'`, `'close'`) | `src/app.ts:70`, `src/plugins/broker.ts:72,79` | Medium |
| C4 | **Routes directly access `fastify.engine` and `fastify.broker`**: hexagonal boundary is pierced; routes should go through use-cases only | Multiple route files | Low |
| C5 | **`BrokerAdapterFactory` uses module-level mutable state**: `_registry` is a module singleton `Map`, making it hard to test in isolation and creating implicit global state | `src/gateways/broker-registry.ts:19` | Low |

---

## 6. `console.log` in Production Code

| File:Line | Usage | Should Be |
|-----------|-------|-----------|
| `src/plugins/broker.ts:71` | `console.log(\`[PaperBroker] fill ...\`)` | `this.logger.info(...)` or Fastify logger |
| `src/plugins/broker.ts:78` | `console.log(\`[PaperBroker] close ...\`)` | `this.logger.info(...)` or Fastify logger |

The project has a `src/lib/logger.ts` module, but `PaperBroker` doesn't accept a logger dependency.

---

## 7. Hardcoded Values

| File:Line | Value | Description |
|-----------|-------|-------------|
| `src/plugins/broker.ts:88` | `0.00010` | Default spread (1 pip) -- should be configurable per symbol |
| `src/plugins/broker.ts:92` | `10_000` | Hardcoded equity/balance for `getAccount()` |
| `src/routes/v1-positions/index.ts:9` | `'default'` | Hardcoded user ID |
| `src/app.ts:71` | `setMaxListeners(0)` | Unbounded listeners (intentional per comment, but no upper bound safety) |

---

## 8. Debt by Category

### Security Debt (Priority: Critical)
- No auth on 11/13 route groups
- `requireApiKey` utility broken (missing `unauthorized` error type)
- Hardcoded `DEFAULT_USER_ID` bypasses multi-user isolation
- `process.env.OPENBB_API_KEY` read at request time with no validation

### Architectural Debt (Priority: High)
- Dependency inversion violation in `gateways/types.ts` (C1)
- PaperBroker god class (T2)
- No composition root (T1)
- Untyped EventEmitter (C3)

### Feature Debt (Priority: Medium)
- 20 MT5 gateway stubs with no implementation
- `MonitorTradesUseCase.stop()` has documented race condition (`src/use-cases/monitor-trades.ts:56-61`)
- No graceful shutdown hook (server doesn't call `app.close()` on SIGTERM)
- OpenAPI spec silent failure

### Code Debt (Priority: Low)
- O(n) position lookups (T3, T4) -- fine for paper trading, problematic at scale
- `console.log` instead of structured logger
- Hardcoded spread and balance values
- Module-level mutable singleton in `BrokerAdapterFactory`

### Test Debt (Priority: Low)
- `MonitorTradesUseCase` has no tests in `use-cases.test.ts`
- No integration tests for WebSocket `/stream` endpoint behavior
- No test for OpenAPI spec serving or `/docs` endpoint

---

## 9. Prioritized Paydown Plan

### Priority Score Formula
`Priority = (Impact + Risk) x (6 - Effort)`

### Quick Wins (1-2 hours each)

| Item | Impact | Risk | Effort | Score | Action |
|------|--------|------|--------|-------|--------|
| Fix `unauthorized` compile error | 4 | 5 | 1 | 45 | Add `UNAUTHORIZED` variant to `DomainError`, export `unauthorized()` from `errors.ts` |
| Replace `console.log` in PaperBroker | 2 | 2 | 1 | 20 | Inject logger via constructor |
| Add `_stopped` guard to MonitorTrades | 2 | 3 | 1 | 25 | Add boolean flag checked inside setInterval callback |
| Warn on missing OpenAPI spec | 1 | 2 | 1 | 15 | Log warning when `readFileSync` catches |

### Medium Term (half-day to 1 day each)

| Item | Impact | Risk | Effort | Score | Action |
|------|--------|------|--------|-------|--------|
| Add auth middleware | 5 | 5 | 3 | 30 | Create Fastify `preHandler` hook using fixed `requireApiKey`, apply to all routes |
| Extract composition root | 3 | 2 | 3 | 15 | Wire use-cases in `buildApp()`, decorate on Fastify instance |
| Type-safe EventEmitter | 3 | 3 | 2 | 24 | Define `TradingEvents` interface, use typed emitter |
| Fix dependency inversion (Bars) | 3 | 3 | 2 | 24 | Define `IBars` interface in `domain/`, have `trading-engine.Bars` implement it |
| Map-based position lookups | 2 | 2 | 2 | 16 | Replace arrays with `Map<ticket, PositionInfoVO>` in PaperBroker |

### Long Term (multi-day)

| Item | Impact | Risk | Effort | Score | Action |
|------|--------|------|--------|-------|--------|
| Implement MT5 gateway bridge | 5 | 3 | 5 | 8 | Replace 20 stubs with real MT5 REST/WebSocket bridge |
| Split PaperBroker | 3 | 2 | 4 | 10 | Extract into 6 separate gateway implementations |
| Add graceful shutdown | 3 | 4 | 3 | 21 | Register SIGTERM/SIGINT handlers, call `app.close()`, drain WS connections |
| WebSocket integration tests | 2 | 3 | 3 | 15 | Test `/stream` subscription, event delivery, reconnection |

---

## 10. Summary Metrics

| Metric | Value |
|--------|-------|
| Total TODOs/FIXMEs | 6 |
| `notImplemented` stubs | 20 |
| Compile errors (own code) | 3 |
| `any` type usage | 0 |
| Unauthenticated route groups | 11 / 13 |
| Routes without rate limiting | 10 / 13 |
| `console.log` in production paths | 2 |
| Test files | 7 |
| Passing tests | 663 |
