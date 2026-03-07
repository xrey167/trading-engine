# Fastify TypeScript Review Report

**Reviewer:** reviewer-1 (fastify-typescript skill)
**Date:** 2026-03-07
**Branch:** `review/fastify-typescript`
**Scope:** Plugin wiring, route patterns, TypeBox usage, schema coverage

---

## Executive Summary

The Fastify HTTP layer is well-structured and follows idiomatic Fastify patterns. Plugin encapsulation via `fastify-plugin` (`fp()`) is used correctly, TypeBox schemas cover all core request/response shapes, and the `buildApp()` composition root provides clear, sequential wiring. The codebase is production-ready for its current scope with a few areas that would benefit from tightening -- most notably missing response schemas on OpenBB routes, inconsistent type-narrowing on `req.query`/`req.body`, and the absence of a global error handler.

**Strengths:**
- Clean plugin encapsulation with `fp()` where cross-scope visibility is needed
- Comprehensive TypeBox schema coverage on core trading routes
- Correct use of Fastify's route-level `config.rateLimit` opt-in pattern
- Good declaration merging for decorated properties (`src/types/index.ts`)
- WebSocket route cleanup logic prevents listener leaks

**Key risks:**
- No global `setErrorHandler` -- unhandled exceptions return Fastify's default 500 shape
- Several OpenBB data routes lack response schemas, losing serialization optimization
- Mutable shared state via `engine.orderAttr*()` calls in POST /orders is race-prone under concurrent requests

---

## 1. Plugin Wiring Analysis

### 1.1 Correct `fp()` Usage

| Plugin | `fp()` wrapped? | Correct? | Notes |
|--------|:---:|:---:|-------|
| `engine.ts` | Yes | Yes | Decorates `engine`, `symbol`, `broker` -- must be visible in all scopes |
| `rate-limit.ts` | Yes | Yes | Wraps `@fastify/rate-limit` with `global: false` |
| `cors.ts` | Yes | Yes | CORS hooks must apply globally |
| `atr.ts` | Yes | Yes | Decorates `atrModule` + `atrConfig` for route access |
| `broker.ts` | N/A (class) | N/A | Instantiated in `buildApp()`, passed to engine plugin |

All plugins that decorate the Fastify instance are correctly wrapped with `fp()`, ensuring decorations break out of encapsulation boundaries. The OpenBB route (`src/routes/openbb/index.ts:115`) is intentionally **not** `fp()`-wrapped, which correctly scopes its `preHandler` API-key hook to only OpenBB routes.

### 1.2 Plugin Registration Order

`src/app.ts:63-128` registers plugins in a sensible dependency order:
1. `emitter` decorated directly (no plugin needed)
2. `enginePlugin` -- decorates `engine`, `symbol`, `broker`
3. `rateLimitPlugin` -- makes rate-limit available for per-route opt-in
4. `corsPlugin` -- global CORS hooks
5. `@fastify/websocket` -- required before `streamRoute`
6. `atrPlugin` -- depends on `engine` + `symbol` (registered after engine)
7. All routes

**Finding (Low):** All registrations use `await app.register(...)` sequentially. This is correct and safe but verbose. Fastify's `.after()` chain or Fastify v5's auto-awaiting could simplify this. Not a problem at current scale.

### 1.3 Missing `onClose` Hook

**Finding (Medium):** `src/plugins/engine.ts` does not register an `onClose` hook. If `TradingEngine` or `PaperBroker` ever acquires resources (timers, connections), they would leak on `app.close()`. The `PaperBroker` already has `connect()`/`disconnect()` methods (`src/plugins/broker.ts:245-247`) but they are never called during lifecycle.

```
Recommendation: Add onClose hook in engine plugin:
  fastify.addHook('onClose', async () => { await opts.broker.disconnect(); });
```

### 1.4 Declaration Merging

`src/types/index.ts` correctly augments `FastifyInstance` with all decorated properties. The types are concrete (`TradingEngine`, `PaperBroker`) rather than interface-based (`IBrokerAdapter`), which couples routes to the paper implementation.

**Finding (Medium):** `src/types/index.ts:11` declares `broker: PaperBroker` instead of `broker: IFullBrokerAdapter`. Routes that call `broker.getPrice()` or `broker.setPrice()` rely on `PaperBroker`-specific methods not on `IFullBrokerAdapter`, making a real broker swap non-trivial. Consider adding `getPrice()`/`setPrice()` to `IBrokerAdapter` or creating an `IPriceFeed` interface.

---

## 2. Route Pattern Review

### 2.1 Consistent Route Structure

All 14 route files follow the same pattern:
- Export a `FastifyPluginAsync` function
- Use `fastify.get/post/put/patch/delete` with inline schema + handler
- Access engine/broker via `fastify.engine` / `fastify.broker`

This is clean and idiomatic. Routes are organized by resource in `src/routes/{resource}/index.ts`.

### 2.2 Schema-Handler Separation

The skill guidelines recommend separating schemas from handlers into `schemas.ts` and `handlers.ts` files. Currently, route-local schemas (e.g., `BacktestBodySchema` in `src/routes/backtest/index.ts:7-15`, `SignalBodySchema` in `src/routes/signal/index.ts:9-17`) are defined inline in the route file. For the current codebase size this is acceptable, but extracting them would improve testability.

### 2.3 Type Narrowing Issues

**Finding (Medium):** Several routes cast `req.query` or `req.body` instead of using Fastify's generic type parameters:

- `src/routes/orders/index.ts:143` -- `const { side } = req.query as { side: string }` instead of typing the route generic
- `src/routes/backtest/index.ts:31` -- `const body = req.body as { ... }` despite having a TypeBox schema
- `src/routes/signal/index.ts:34` -- same pattern
- `src/routes/openbb/index.ts:121,185,213` -- `req.query as { ... }` casts

When a TypeBox schema is provided in the route's `schema` option, Fastify infers the type automatically if the route generic is specified. The `as` casts bypass this safety.

**Recommendation:** Use route generics consistently:
```typescript
fastify.delete<{ Querystring: { side: 'buy' | 'sell' | 'all' } }>('/orders', { ... })
```

### 2.4 Use-Case Instantiation

`src/app.ts:58-62` has a TODO noting that use-cases are instantiated inline in route handlers (e.g., `new GetPositionsUseCase(broker, log)` in `src/routes/v1-positions/index.ts:28`). This is fine at current scale but creates a new object per request. For stateless use-cases, pre-wiring them in `buildApp()` would be more efficient.

### 2.5 Race Condition in POST /orders

**Finding (High):** `src/routes/orders/index.ts:51-59` calls `engine.orderAttrOCO()`, `engine.orderAttrCO()`, etc. to set shared engine state before placing the order. Under concurrent requests, one request could set attributes that affect another request's order. The `POST /orders` route has a rate limit of 10/s, which mitigates but does not eliminate the issue.

**Recommendation:** Either (a) make attribute-setting and order-placement atomic in the engine, or (b) document that POST /orders is not safe for concurrent use.

### 2.6 Trailing Entry Size Leak Pattern

**Finding (Low):** `src/routes/orders/index.ts:73-76` sets `engine.orderSize(size)` before the trailing order and resets it to `1` afterward. If the `addBuyLimitTrail` call throws, the size is never reset. Use try/finally:
```typescript
try { id = engine.addBuyLimitTrail(...); } finally { if (size !== undefined) engine.orderSize(1); }
```

---

## 3. TypeBox Schema Coverage

### 3.1 Core Schemas (src/schemas/index.ts)

Comprehensive coverage of all engine-level types:

| Schema | Lines | Used By |
|--------|-------|---------|
| `SideSchema` | 13-17 | `PositionSlotSchema`, `PendingOrderSchema` |
| `TrailModeSchema` | 21-29 | `TrailConfigSchema`, `PostOrderBodySchema` |
| `OHLCSchema` | 60-68 | `PostBarsBodySchema`, backtest/signal routes |
| `PositionSlotSchema` | 99-117 | GET /positions response |
| `PendingOrderSchema` | 123-130 | GET /orders response |
| `PostOrderBodySchema` | 142-162 | POST /orders body |
| `PostBarsBodySchema` | 136-139 | POST /bars body |
| `AccountSchema` | 181-184 | GET /account response |
| `PutPositionSlTpBodySchema` | 191-206 | PUT /positions/:side/sl-tp body |
| `PostScaledOrdersBodySchema` | 259-266 | POST /scaled-orders body |
| `PutAtrConfigBodySchema` | 278-288 | PUT /atr/config body |

Domain-level schemas are co-located with their domain modules and re-exported at the bottom of `src/schemas/index.ts:294-298`. This is a good pattern.

### 3.2 Missing Response Schemas

**Finding (Medium):** Several routes define response schemas for success but not for all error codes, or omit response schemas entirely:

| Route | File:Line | Missing |
|-------|-----------|---------|
| GET /openbb/positions | `openbb/index.ts:141` | No response schema at all |
| GET /openbb/orders | `openbb/index.ts:164` | No response schema |
| GET /openbb/account/equity | `openbb/index.ts:170` | No response schema |
| GET /openbb/account/balance | `openbb/index.ts:175` | No response schema |
| GET /openbb/deals | `openbb/index.ts:182` | Only querystring schema, no response |
| GET /openbb/symbol | `openbb/index.ts:211` | Only querystring schema, no response |
| GET /openbb/engine-config | `openbb/index.ts:223` | No response schema |
| GET /widgets.json | `openbb/index.ts:131` | No response schema |
| GET /apps.json | `openbb/index.ts:135` | No response schema |
| GET /stream (WS) | `stream/index.ts:6` | No message schema (expected for WS) |
| GET /openapi.yaml | `app.ts:118` | No response schema |
| GET /docs | `app.ts:123` | No response schema |

Without response schemas, Fastify skips its fast JSON serialization and falls back to `JSON.stringify()`. For the OpenBB data routes that serve to external dashboards, this is a performance miss.

### 3.3 Inline vs Centralized Schemas

Route-local schemas exist in:
- `src/routes/backtest/index.ts:7-22` -- `BacktestBodySchema`, `BacktestResponseSchema`
- `src/routes/signal/index.ts:9-25` -- `SignalBodySchema`, `SignalResponseSchema`
- `src/routes/v1-positions/index.ts:11-14` -- `ModifyBodySchema`
- `src/routes/openbb/index.ts:101-110` -- `DealsQuerySchema`, `SymbolQuerySchema`

These are not exported or reusable. If any of these shapes are needed for client SDK generation or OpenAPI spec, they should be moved to `src/schemas/index.ts` or co-located schema files.

### 3.4 Schema Constraints

**Finding (Low):** Most numeric schemas use `Type.Number()` without constraints. Trading-specific fields like `price`, `size`, and `sl`/`tp` should have `{ minimum: 0 }` or `{ exclusiveMinimum: 0 }` to reject nonsensical values at the validation layer. `PutAtrConfigBodySchema` (`src/schemas/index.ts:279-287`) correctly uses `{ minimum: 0 }` and `{ minimum: 1 }` -- apply this pattern elsewhere.

---

## 4. Additional Findings

### 4.1 No Global Error Handler

**Finding (High):** There is no `app.setErrorHandler()` registered in `buildApp()`. Unhandled exceptions (e.g., engine methods throwing) will produce Fastify's default error response `{ statusCode: 500, error: "Internal Server Error", message: "..." }` which may leak implementation details in production.

**Recommendation:** Add a global error handler in `src/app.ts` that maps `DomainError` types to HTTP status codes and sanitizes messages.

### 4.2 No Graceful Shutdown

**Finding (Medium):** `src/server.ts` calls `app.listen()` but does not handle `SIGTERM`/`SIGINT` for graceful shutdown. Fastify's `app.close()` would drain connections and trigger `onClose` hooks. Add:
```typescript
for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => app.close());
}
```

### 4.3 Static Swagger HTML

**Finding (Low):** `src/app.ts:28-51` serves Swagger UI via an inline HTML string loading scripts from `unpkg.com`. This works but couples the documentation endpoint to external CDN availability. Consider using `@fastify/swagger` + `@fastify/swagger-ui` for integrated OpenAPI generation and UI serving.

### 4.4 EventEmitter Type Safety

**Finding (Low):** The `emitter` is typed as `EventEmitter` (Node.js generic). Event names (`'bar'`, `'fill'`, `'close'`) and payloads are untyped. A typed event emitter (e.g., `TypedEmitter` from `tiny-typed-emitter` or a custom interface) would prevent misspelled event names and payload mismatches.

### 4.5 Security: API Key in Query String

**Finding (Medium):** `src/routes/openbb/index.ts:121` reads the API key from `req.query.apiKey`. Query strings are logged in access logs and may appear in browser history. Prefer `Authorization` header or a custom header like `X-API-Key`.

---

## 5. Prioritized Recommendations

### High Priority
1. **Add a global error handler** -- Map `DomainError` to HTTP status codes, sanitize messages in production (`src/app.ts`)
2. **Address POST /orders race condition** -- Make attribute-setting + order-placement atomic, or serialize requests (`src/routes/orders/index.ts:51-103`)

### Medium Priority
3. **Add response schemas to OpenBB routes** -- Enable fast serialization and OpenAPI completeness (`src/routes/openbb/index.ts`)
4. **Use route generics instead of `as` casts** -- Leverage Fastify's type inference from TypeBox schemas
5. **Add `onClose` hook for broker lifecycle** -- Call `broker.disconnect()` on shutdown (`src/plugins/engine.ts`)
6. **Move API key from query string to header** -- Prevent key leakage via logs (`src/routes/openbb/index.ts`)
7. **Type the `broker` decoration as an interface** -- Decouple routes from `PaperBroker` (`src/types/index.ts:11`)
8. **Add graceful shutdown signal handlers** -- Handle SIGTERM/SIGINT in `src/server.ts`

### Low Priority
9. **Add numeric constraints to trading schemas** -- `minimum: 0` on price/size/sl/tp fields
10. **Use try/finally for trailing entry size reset** -- Prevent state leak on exception (`src/routes/orders/index.ts:73-98`)
11. **Move route-local schemas to centralized location** -- Enable reuse and OpenAPI generation
12. **Consider typed EventEmitter** -- Prevent event name/payload mismatches
13. **Consider `@fastify/swagger` for OpenAPI** -- Replace static HTML + manual YAML
