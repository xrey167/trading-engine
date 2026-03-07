# Code Review Checklist -- Trading Engine

**Date:** 2026-03-07
**Reviewer:** reviewer-5 (automated)
**Branch:** `main`
**Test suite:** 668 tests passing (16 test files)

---

## Summary Scorecard

| Category          | Status       | Score |
|-------------------|--------------|-------|
| Security          | **PARTIAL**  | 4/10  |
| Performance       | **PASS**     | 7/10  |
| Maintainability   | **PASS**     | 8/10  |
| Reliability       | **PARTIAL**  | 6/10  |
| Code Quality      | **PASS**     | 8/10  |
| Test Coverage     | **PASS**     | 8/10  |
| Documentation     | **PARTIAL**  | 6/10  |
| **Overall**       | **PARTIAL**  | **6.7/10** |

---

## 1. Security Checklist

### Authentication & Authorization

- [ ] **FAIL** -- No auth layer on core routes (`/orders`, `/positions`, `/bars`, `/account`, `/engine/config`, `/atr/config`, `/scaled-orders`)
  - All engine-controlling endpoints are wide open
  - `src/routes/v1-positions/index.ts:8` -- hardcoded `DEFAULT_USER_ID = 'default'` with `TODO: dev-only stub`
  - Only `/openbb/*` routes have optional API key guard (`src/routes/openbb/index.ts:117-127`)

- [x] **PASS** -- OpenBB API key uses `timingSafeEqual` to prevent timing attacks (`src/routes/openbb/index.ts:124`)

- [ ] **FAIL** -- `requireApiKey` utility exists (`src/lib/api-utils.ts:72-82`) but is never used by any route handler -- dead code

- [ ] **FAIL** -- `unauthorized` function imported in `src/lib/api-utils.ts:3` but does not exist in `src/lib/errors.ts` -- **compile error** confirmed by `npm run typecheck`:
  ```
  src/lib/api-utils.ts(3,24): error TS2305: Module '"./errors.js"' has no exported member 'unauthorized'.
  src/lib/api-utils.ts(12,10): error TS2678: Type '"UNAUTHORIZED"' is not comparable to type ...
  ```
  The `DomainError` union in `src/lib/errors.ts` has no `UNAUTHORIZED` variant, and no `unauthorized()` factory function exists. This means the entire `requireApiKey` + `withErrorHandler` auth path is broken at the type level.

### Input Validation

- [x] **PASS** -- TypeBox schemas enforce request body shapes on all routes (`src/schemas/index.ts`)
- [x] **PASS** -- Fastify's built-in schema validation rejects malformed requests before handlers run
- [x] **PASS** -- Date parsing validates `NaN` checks (`src/lib/api-utils.ts:58`, `src/routes/openbb/index.ts:188-191`)
- [x] **PASS** -- Ticket params validated as finite numbers (`src/routes/v1-positions/index.ts:52`)
- [ ] **PARTIAL** -- `POST /orders` accepts `trailEntry.mode` as a number but casts it with `as TrailMode` without runtime validation that the value is a valid `TrailMode` member (`src/routes/orders/index.ts:74`)

### Secrets Handling

- [x] **PASS** -- API key read from `process.env.OPENBB_API_KEY` (not hardcoded)
- [x] **PASS** -- No secrets, credentials, or `.env` files committed
- [ ] **PARTIAL** -- No `.env.example` or documentation of required env vars

### Rate Limiting

- [x] **PASS** -- `POST /orders` rate-limited at 10 req/s (`src/routes/orders/index.ts:38`)
- [x] **PASS** -- `POST /bars` rate-limited at 120 req/s (`src/routes/bars/index.ts:11`)
- [ ] **FAIL** -- No rate limiting on other mutating endpoints: `DELETE /orders`, `DELETE /positions/:side`, `PUT /positions/:side/sl-tp`, `POST /positions/long`, `POST /positions/short`, `PUT /engine/config`, `PUT /atr/config`, `POST /scaled-orders`

### CORS

- [x] **PASS** -- Allowlist-based CORS with specific origins (`src/plugins/cors.ts:7-11`)
- [x] **PASS** -- `credentials: false` -- no cookie forwarding

---

## 2. Performance Checklist

### Data Structures & Algorithms

- [ ] **PARTIAL** -- `PaperBroker` uses linear array scans (`O(n)`) for position lookups by ticket (`src/plugins/broker.ts:119-126`). Documented as TODO. Acceptable for paper trading, not for production with many positions.

- [x] **PASS** -- `EventEmitter.setMaxListeners(0)` is intentional and documented (`src/app.ts:71`)

### Async Patterns

- [x] **PASS** -- All route handlers properly `await` async operations
- [x] **PASS** -- No fire-and-forget promises without error handling
- [ ] **PARTIAL** -- `MonitorTradesUseCase` uses `setInterval` with async callback (`src/use-cases/monitor-trades.ts:38`). If a poll takes longer than `intervalMs`, overlapping polls will stack. The comment at line 56 acknowledges a related race on `stop()`.

### Memory & Resource Management

- [x] **PASS** -- WebSocket cleanup removes all event listeners on close/error (`src/routes/stream/index.ts:19-23`)
- [x] **PASS** -- Test teardown properly calls `app.close()` in every `afterEach`
- [ ] **PARTIAL** -- OpenAPI spec loaded synchronously at startup with `readFileSync` (`src/app.ts:116`). Fine for startup but blocks the event loop.

### Caching

- [x] **PASS** -- OpenAPI spec content cached in memory after first read (`src/app.ts:115-116`)
- [ ] **N/A** -- No database layer to evaluate query caching

---

## 3. Maintainability Checklist

### Code Structure

- [x] **PASS** -- Clean hexagonal architecture: `domain/` -> `gateways/` -> `use-cases/` -> `routes/` -> `plugins/`
- [x] **PASS** -- Gateway interfaces (ports) properly defined in `src/gateways/types.ts`
- [x] **PASS** -- `as const` enum pattern consistently applied across domain and engine
- [x] **PASS** -- TypeBox schemas co-located in `src/schemas/index.ts` with domain re-exports
- [x] **PASS** -- ESM `.js` import convention followed everywhere
- [ ] **PARTIAL** -- Use-cases instantiated inline in route handlers (acknowledged TODO in `src/app.ts:58-62`). Works at current scale but will cause dependency wiring issues as complexity grows.

### Code Duplication

- [ ] **PARTIAL** -- Position slot construction in `GET /positions` (`src/routes/positions/index.ts:28-53`) and `GET /openbb/positions` (`src/routes/openbb/index.ts:144-158`) are duplicated with slightly different shapes. Could share a mapping helper.
- [ ] **PARTIAL** -- Trailing order handling in `POST /orders` (`src/routes/orders/index.ts:71-98`) repeats identical `if (size !== undefined) engine.orderSize(size)` / reset pattern 4 times.

### Type Safety

- [x] **PASS** -- `strict: true` in `tsconfig.json` with `noImplicitAny`, `strictNullChecks`, `noImplicitReturns`, `noFallthroughCasesInSwitch`
- [x] **PASS** -- `Result<T, DomainError>` pattern enforced across all gateway and use-case methods
- [ ] **FAIL** -- Type checking is broken (`npm run typecheck` reports errors in `src/lib/api-utils.ts` -- missing `unauthorized` export). While these are in unused code paths, broken types erode confidence in the type system.
- [ ] **INFO** -- `noUnusedLocals: false` and `noUnusedParameters: false` -- dead code can accumulate silently

### Dependencies

- [x] **PASS** -- Minimal dependency tree (Fastify ecosystem + TypeBox)
- [x] **PASS** -- All deps pinned with `^` (minor version range)
- [ ] **INFO** -- No `npm audit` results checked in CI pipeline (no CI config found)

---

## 4. Reliability Checklist

### Error Handling

- [x] **PASS** -- `Result<T, DomainError>` discriminated union prevents uncaught errors in business logic
- [x] **PASS** -- `DomainError` type maps cleanly to HTTP status codes via `statusForError()` (`src/lib/api-utils.ts:8-19`)
- [x] **PASS** -- `withErrorHandler` wrapper available for routes using Result pattern (`src/lib/api-utils.ts:31-43`)
- [ ] **PARTIAL** -- Most core routes (`/orders`, `/positions`, `/bars`) handle errors inline with `reply.status().send()` rather than using the `withErrorHandler` wrapper, creating inconsistent error response shapes
- [ ] **PARTIAL** -- `POST /scaled-orders` catches constructor errors (`src/routes/scaled-orders/index.ts:42-45`) but doesn't catch errors from `soe.placeLong/placeShort/placeBoth` which could throw

### Logging

- [x] **PASS** -- Logger interface abstraction (`src/lib/logger.ts`) with `nullLogger` for tests
- [x] **PASS** -- Fastify's built-in pino logger enabled in production (`src/server.ts:3`)
- [ ] **PARTIAL** -- `PaperBroker` uses raw `console.log` instead of the Logger interface (`src/plugins/broker.ts:71,78`). Bypasses structured logging.

### Graceful Shutdown

- [ ] **FAIL** -- No `SIGTERM`/`SIGINT` signal handlers in `src/server.ts`. The server will be killed abruptly without draining connections or cleaning up resources.
  ```typescript
  // src/server.ts (entire file):
  const app = await buildApp({ logger: true });
  await app.listen({ port: 3000, host: '0.0.0.0' });
  ```
  Missing: `process.on('SIGTERM', () => app.close())` or equivalent.

- [ ] **FAIL** -- `MonitorTradesUseCase` timer (`setInterval`) has no lifecycle hook integration. If the server shuts down, the timer keeps firing.

### Configuration

- [x] **PASS** -- Server port hardcoded to 3000 (`src/server.ts:5`) -- acceptable for development, should be configurable for production
- [x] **PASS** -- Symbol defaults (`EURUSD`, 5 digits) configurable via `BuildAppConfig`
- [ ] **PARTIAL** -- No environment-based configuration (dev/staging/prod). Host is `0.0.0.0` always.

---

## 5. Test Coverage Checklist

- [x] **PASS** -- 668 tests passing across 16 test files
- [x] **PASS** -- Route tests cover all major endpoints including edge cases (`src/routes.test.ts` -- 133 tests)
- [x] **PASS** -- Domain layer has dedicated tests (`src/domain/domain.test.ts`)
- [x] **PASS** -- Gateway layer has dedicated tests (`src/gateways/gateways.test.ts`)
- [x] **PASS** -- Use-case layer has dedicated tests (`src/use-cases/use-cases.test.ts`)
- [x] **PASS** -- Strategy layer has dedicated tests (`src/strategies/strategies.test.ts`)
- [x] **PASS** -- Money management has dedicated tests (`src/money-management/money-management.test.ts`)
- [x] **PASS** -- Lib utilities have dedicated tests (`src/lib/lib.test.ts`)
- [x] **PASS** -- Tests properly clean up via `afterEach(() => app.close())`
- [ ] **PARTIAL** -- No integration tests for WebSocket `/stream` endpoint (only unit-level route tests)
- [ ] **PARTIAL** -- `MonitorTradesUseCase` timer behavior not tested for edge cases (overlapping polls, stop-during-poll)

---

## 6. Documentation Checklist

- [x] **PASS** -- `CLAUDE.md` provides comprehensive architecture overview and conventions
- [x] **PASS** -- OpenAPI 3.1 spec exists with Swagger UI at `/docs`
- [x] **PASS** -- TODOs are well-documented with `(architecture)` tags explaining rationale
- [ ] **PARTIAL** -- No README.md for general project setup/onboarding
- [ ] **PARTIAL** -- No API changelog or versioning strategy documented
- [ ] **PARTIAL** -- No environment variable documentation (`.env.example`)

---

## 7. Git & Build Checklist

- [x] **PASS** -- Clean ESM build with `tsc`
- [x] **PASS** -- `.gitignore` properly configured (node_modules, dist excluded)
- [x] **PASS** -- Biome linter configured with 18 warnings, 2 infos (no errors)
- [ ] **FAIL** -- `npm run typecheck` fails with 2 project errors (`unauthorized` import) + SDK-related errors in `node_modules`
- [ ] **PARTIAL** -- No CI/CD pipeline configuration found in repository

---

## Critical Findings

### P0 -- Must Fix

1. **Broken type exports** -- `src/lib/api-utils.ts:3` imports `unauthorized` from `src/lib/errors.ts` which doesn't export it. The `DomainError` union also lacks an `UNAUTHORIZED` variant. This breaks `npm run typecheck`. Either add the missing type variant + factory function, or remove the unused import and switch case.

2. **No authentication on trading endpoints** -- Routes like `POST /positions/long`, `DELETE /positions/:side`, `PUT /engine/config` can place trades, close positions, and reconfigure the engine without any authentication. A single unauthenticated request could liquidate all positions.

3. **No graceful shutdown** -- `src/server.ts` has no signal handlers. On `SIGTERM` (container restart, deployment), in-flight requests are dropped and WebSocket connections are severed without cleanup.

### P1 -- Should Fix

4. **No rate limiting on destructive endpoints** -- `DELETE /positions/:side`, `POST /positions/flat`, `PUT /engine/config`, `PUT /atr/config` have no rate limiting. An attacker or misbehaving client could spam position closes or config changes.

5. **PaperBroker uses `console.log`** -- `src/plugins/broker.ts:71,78` bypass structured logging. In production this will produce unstructured noise mixed with pino JSON output.

6. **Error response inconsistency** -- Core routes return `{ error: string }` while `withErrorHandler` returns `{ error: DomainError }`. Clients must handle both shapes.

### P2 -- Consider

7. **MonitorTradesUseCase overlapping polls** -- `src/use-cases/monitor-trades.ts:38` -- `setInterval` with async callback can stack if gateway is slow.

8. **Position slot duplication** -- `GET /positions` and `GET /openbb/positions` build similar objects independently. Extract a shared mapper.

9. **Linear scan in PaperBroker** -- `src/plugins/broker.ts:119-126` -- `O(n)` position lookup. Use a `Map<ticket, PositionInfoVO>` for production.

---

## Verification

```
npm test           -- 668 passed (0 failed)
npm run lint       -- 18 warnings, 2 infos, 0 errors
npm run typecheck  -- FAILS (2 project errors: missing unauthorized export)
```
