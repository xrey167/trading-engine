# Code Review: Trading Engine Codebase

**Reviewer:** reviewer-4 (engineering:code-review)
**Date:** 2026-03-07
**Branch:** `main`
**Scope:** General code quality, bugs, correctness, security

---

## Executive Summary

The trading engine codebase demonstrates solid architectural foundations with a clean hexagonal/ports-and-adapters structure, well-typed interfaces, and a disciplined `Result<T, E>` pattern. Test coverage is strong (654+ tests). However, the review identified **1 Critical**, **3 High**, **5 Medium**, and **4 Low** severity findings across security, correctness, and performance dimensions.

The most critical issue is a **compilation-breaking bug** in `src/lib/api-utils.ts` that imports a non-existent `unauthorized` error constructor and references a non-existent `UNAUTHORIZED` DomainError type. Several routes also lack any authentication, exposing order placement and position management to unauthenticated access.

---

## Dimension Ratings

| Dimension       | Rating | Notes |
|-----------------|--------|-------|
| Security        | 3/5    | Auth absent on most routes; timing-safe comparison used correctly on OpenBB |
| Performance     | 4/5    | O(n^2) backtest allocation; linear scans acceptable for paper broker |
| Correctness     | 3/5    | Compilation error in api-utils; race condition in MonitorTrades; shared engine state mutation |
| Maintainability | 4/5    | Clean architecture; Result pattern used consistently; good separation of concerns |

---

## Findings

### Critical

#### CR-01: `api-utils.ts` imports non-existent `unauthorized` -- compilation error
- **File:** `src/lib/api-utils.ts:3`
- **Severity:** Critical
- **Description:** The file imports `unauthorized` from `./errors.js`, but `errors.ts` does not define an `unauthorized` factory function or an `UNAUTHORIZED` variant in the `DomainError` union type. The `statusForError` function at line 12 also has a `case 'UNAUTHORIZED': return 401;` branch that can never match. Running `npx tsc --noEmit` confirms:
  ```
  src/lib/api-utils.ts(3,24): error TS2305: Module '"./errors.js"' has no exported member 'unauthorized'.
  src/lib/api-utils.ts(12,10): error TS2678: Type '"UNAUTHORIZED"' is not comparable to type '...'
  ```
- **Impact:** The `requireApiKey` function cannot be used anywhere without breaking compilation. Any route attempting to use `withErrorHandler` + `requireApiKey` will fail to compile.
- **Recommendation:** Add the `UNAUTHORIZED` variant to `DomainError` in `src/lib/errors.ts` and export an `unauthorized(message: string)` factory function.

---

### High

#### CR-02: No authentication on trading routes
- **File:** `src/routes/orders/index.ts`, `src/routes/positions/index.ts`, `src/routes/bars/index.ts`
- **Severity:** High
- **Description:** All core trading routes (POST /orders, POST /positions/long, POST /positions/short, DELETE /positions/:side, POST /bars, PUT /engine/config, PUT /atr/config) have no authentication or authorization. The `requireApiKey` utility exists in `api-utils.ts` but is never used by any route handler. The `withErrorHandler` wrapper is also unused.
- **Impact:** Anyone with network access to the server can place orders, close positions, and modify engine configuration. The server binds to `0.0.0.0:3000` (`src/server.ts:5`), making it accessible on all interfaces.
- **Recommendation:** Wire `requireApiKey` (once CR-01 is fixed) as a preHandler hook in `buildApp()` or per-route, gated by an environment variable.

#### CR-03: Hardcoded `DEFAULT_USER_ID` in v1-positions route
- **File:** `src/routes/v1-positions/index.ts:9`
- **Severity:** High
- **Description:** `const DEFAULT_USER_ID = 'default'` is used for all position operations. The comment says "dev-only stub -- replace with real auth". In a multi-tenant scenario, all users share the same position namespace, leading to data leakage.
- **Impact:** Every request operates on the same user's positions regardless of who is calling. Combined with CR-02 (no auth), any caller can view, modify, or close any position.
- **Recommendation:** Extract user identity from an authenticated session (JWT, API key header, etc.) and pass it through to use-cases.

#### CR-04: Shared mutable engine state in order placement
- **File:** `src/routes/orders/index.ts:70-98`
- **Severity:** High
- **Description:** For trailing entry order types, the handler mutates shared engine state via `engine.orderSize(size)` then resets it after the call:
  ```typescript
  if (size !== undefined) engine.orderSize(size);
  id = engine.addBuyLimitTrail(...);
  if (size !== undefined) engine.orderSize(1); // reset
  ```
  Under concurrent requests, a second request can interleave between the `orderSize(size)` and `orderSize(1)` calls, causing the wrong order size to be used.
- **Impact:** Race condition can cause orders to be placed with incorrect sizes. Although Node.js is single-threaded, if `addBuyLimitTrail` (or any engine method) is async or yields (e.g., via `await`), interleaving is possible.
- **Recommendation:** Pass `size` directly to the trail methods (as done for non-trail order types), or use a per-request engine snapshot/lock.

---

### Medium

#### CR-05: Backtest use-case has O(n^2) array copying
- **File:** `src/use-cases/backtest.ts:39`
- **Severity:** Medium
- **Description:** On each iteration, the backtest copies and reverses the growing `oldestFirst` array:
  ```typescript
  bars: new Bars(oldestFirst.slice().reverse()),
  ```
  For `n` bars, this performs `sum(1..n)` = O(n^2) copy operations. With large datasets (e.g., 10,000+ bars), this becomes a significant performance bottleneck.
- **Impact:** Backtest endpoint could be slow or cause memory pressure with large bar datasets.
- **Recommendation:** Maintain a secondary newest-first array alongside `oldestFirst`, or use a view/wrapper that provides reversed access without copying.

#### CR-06: `console.log` used in PaperBroker instead of injected logger
- **File:** `src/plugins/broker.ts:71,78`
- **Severity:** Medium
- **Description:** `PaperBroker.marketOrder()` and `closePosition()` use `console.log` directly rather than the `Logger` interface used everywhere else. This bypasses log-level filtering and structured logging.
- **Impact:** Fill/close logs cannot be silenced in tests or filtered by log level. Inconsistent with the rest of the codebase which uses the `Logger` abstraction.
- **Recommendation:** Inject a `Logger` instance into `PaperBroker` constructor and use `this.logger.info(...)`.

#### CR-07: MonitorTradesUseCase race condition after `stop()`
- **File:** `src/use-cases/monitor-trades.ts:56-61`
- **Severity:** Medium
- **Description:** The code comments acknowledge that after `stop()` is called, an in-flight poll callback may still invoke `onPosition` or `onError`. However, no guard is implemented. The comment suggests adding a `_stopped` flag but doesn't do so.
- **Impact:** If `onPosition` has side-effects (e.g., placing orders), stale callbacks can execute after the monitor is stopped, leading to unexpected behavior.
- **Recommendation:** Add a `private _stopped = false` flag, set it in `stop()`, and check it at the top of the interval callback.

#### CR-08: OpenBB API key transmitted in query string
- **File:** `src/routes/openbb/index.ts:104,109,121`
- **Severity:** Medium
- **Description:** The OpenBB routes accept the API key via `?apiKey=...` query parameter. Query parameters are typically logged in access logs, proxy logs, and browser history, making the key susceptible to leakage.
- **Impact:** API key exposure through server logs, reverse proxies, or browser history.
- **Recommendation:** Accept the API key via a header (e.g., `x-api-key` or `Authorization: Bearer ...`) instead of query string. The `requireApiKey` utility already uses headers -- align OpenBB routes with it.

#### CR-09: `flatMapResult` referenced in MEMORY.md but not implemented
- **File:** `src/lib/result.ts`
- **Severity:** Medium
- **Description:** The project memory references `flatMapResult` as being added to `src/lib/result.ts`, but the function does not exist in the file. Only `ok`, `err`, `isOk`, `isErr`, and `mapResult` are implemented.
- **Impact:** Any code relying on `flatMapResult` would fail at import time. This may indicate incomplete work from a prior session.
- **Recommendation:** Either implement `flatMapResult` or remove the reference from documentation.

---

### Low

#### CR-10: `specContent` read once at startup -- never refreshed
- **File:** `src/app.ts:115-116`
- **Severity:** Low
- **Description:** The OpenAPI spec is read from disk once during `buildApp()`:
  ```typescript
  let specContent = '';
  try { specContent = readFileSync(specPath, 'utf8'); } catch { /* spec not built */ }
  ```
  If the spec file doesn't exist at startup (e.g., build hasn't run yet), `/openapi.yaml` will always return an empty string for the lifetime of the process.
- **Impact:** `/docs` Swagger UI will show an empty spec if the server starts before `npm run build`.
- **Recommendation:** Consider lazy-loading the spec on first request, or log a warning when the spec file is missing.

#### CR-11: Swagger UI loaded from unpkg CDN -- no SRI hashes
- **File:** `src/app.ts:35-36`
- **Severity:** Low
- **Description:** The Swagger UI JS and CSS are loaded from `unpkg.com` without Subresource Integrity (SRI) hashes:
  ```html
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css">
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  ```
- **Impact:** If unpkg is compromised or serves a different version, malicious code could execute in the context of the `/docs` page.
- **Recommendation:** Pin to a specific version with SRI hashes, or bundle Swagger UI locally.

#### CR-12: `EventEmitter` maxListeners set to 0 (unbounded)
- **File:** `src/app.ts:71`
- **Severity:** Low
- **Description:** `emitter.setMaxListeners(0)` disables the listener leak warning. The comment explains why (each WS client adds 3 listeners), and the stream route properly cleans up listeners on disconnect. However, without the warning, a listener leak bug would go undetected.
- **Impact:** If a bug prevents cleanup, memory will grow unbounded without any warning.
- **Recommendation:** Set a generous but finite limit (e.g., `1000`) rather than `0` to catch real leaks while allowing many concurrent WebSocket clients.

#### CR-13: Order type validation uses string default branch instead of exhaustive check
- **File:** `src/routes/orders/index.ts:99-100`
- **Severity:** Low
- **Description:** The `switch (type)` in POST /orders uses a `default` branch to catch unknown types. Since `type` comes from a TypeBox schema with `Type.Union([Type.Literal(...)])`, unknown types should be rejected by schema validation before reaching the handler. The `default` branch is technically dead code but serves as a safety net.
- **Impact:** No functional issue, but TypeScript cannot verify exhaustiveness since the default branch exists.
- **Recommendation:** Consider using a `satisfies never` exhaustive check pattern for better compile-time safety.

---

## Positive Observations

1. **Result<T, E> pattern** is used consistently across all gateway and use-case methods, providing explicit error handling without exceptions.
2. **TypeBox schema validation** on request bodies and responses ensures runtime type safety at the API boundary.
3. **Clean separation of concerns** -- domain types, gateway interfaces, use-cases, and route handlers are well-separated following hexagonal architecture.
4. **Timing-safe comparison** used correctly in OpenBB auth (`src/routes/openbb/index.ts:124`) to prevent timing attacks.
5. **WebSocket cleanup** in stream route properly removes all event listeners on close/error.
6. **Rate limiting** applied judiciously (POST /orders at 10/s, POST /bars at 120/s) rather than globally.
7. **Strong test coverage** with 654+ passing tests across domain, gateways, use-cases, and integration.

---

## Summary of Recommendations

| Priority | Action |
|----------|--------|
| P0 | Fix `unauthorized` import/type in `errors.ts` + `api-utils.ts` (CR-01) |
| P0 | Add authentication to trading routes (CR-02) |
| P1 | Replace hardcoded `DEFAULT_USER_ID` with real auth (CR-03) |
| P1 | Eliminate shared mutable state in trailing order placement (CR-04) |
| P2 | Optimize backtest array copying (CR-05) |
| P2 | Inject logger into PaperBroker (CR-06) |
| P2 | Add stop guard to MonitorTradesUseCase (CR-07) |
| P2 | Move OpenBB API key from query string to header (CR-08) |
| P3 | Implement or remove `flatMapResult` (CR-09) |
| P3 | Address remaining low-severity items (CR-10 through CR-13) |
