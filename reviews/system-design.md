# System Design Review

**Reviewer:** reviewer-2 (engineering:system-design)
**Date:** 2026-03-07
**Branch:** `review/system-design`
**Scope:** API surface, scalability, event-driven patterns, WebSocket design

---

## Executive Summary

The trading engine exposes a well-structured Fastify HTTP + WebSocket API over a standalone core engine (~1640 lines). The hexagonal architecture cleanly separates domain logic from transport, and the plugin-based wiring in `buildApp()` keeps the composition root readable. However, the system is fundamentally single-instance and single-tenant, with several design choices that will become bottlenecks under real production load: a shared mutable engine singleton, synchronous bar processing blocking all clients, no authentication on most routes, and an unbounded EventEmitter bridging fills to WebSocket clients without backpressure.

**Overall assessment:** Solid for a single-user paper-trading workstation. Significant redesign needed before multi-tenant, multi-symbol, or high-availability deployment.

---

## 1. API Surface Analysis

### 1.1 REST Endpoints

| Route | Method | Purpose | Rate Limited | Auth |
|-------|--------|---------|:---:|:---:|
| `/positions` | GET | Position state (long/short slots) | No | No |
| `/positions/:side` | DELETE | Close position by side | No | No |
| `/positions/:side/sl-tp` | PUT | Update SL/TP/trail/BE | No | No |
| `/positions/long` | POST | Market buy | No | No |
| `/positions/short` | POST | Market sell | No | No |
| `/positions/hedge` | POST | Hedge all | No | No |
| `/positions/long/flat` | POST | Close long + cancel buys | No | No |
| `/positions/short/flat` | POST | Close short + cancel sells | No | No |
| `/positions/flat` | POST | Close all + cancel all | No | No |
| `/orders` | GET | List pending orders | No | No |
| `/orders` | POST | Place pending order | **10/s** | No |
| `/orders/:id` | PATCH | Move order price | No | No |
| `/orders` | DELETE | Bulk delete by side | No | No |
| `/orders/:id` | DELETE | Delete single order | No | No |
| `/orders/bracket` | POST | Place bracket order | No | No |
| `/bars` | POST | Feed bar data (drives engine) | **120/s** | No |
| `/account` | GET | Account equity/balance | No | No |
| `/engine/config` | PUT | Update engine flags | No | No |
| `/scaled-orders` | POST | Place scaled order grid | No | No |
| `/atr` | GET/PUT | ATR module config | No | No |
| `/v1/backtest` | POST | Run backtest | No | No |
| `/v1/signal` | POST | Run signal strategy | No | No |
| `/v1/positions` | GET/POST/... | V1 position CRUD | No | No |
| `/money-management` | POST | Lot sizing calculation | No | No |
| `/openbb/*` | GET | OpenBB Workspace widgets | No | Optional* |
| `/stream` | GET (WS) | Real-time event stream | No | No |
| `/docs` | GET | Swagger UI | No | No |
| `/openapi.yaml` | GET | OpenAPI spec | No | No |

*OpenBB routes have optional API key guard via `OPENBB_API_KEY` env var.

### 1.2 Findings

**[HIGH] SD-API-1: No authentication on trading endpoints**
File: `src/app.ts:63-129`

All mutation endpoints (market orders, position closes, engine config changes) are completely unauthenticated. Any network-reachable client can place orders, close positions, or reconfigure the engine. The OpenBB routes show the project knows how to add auth (`src/routes/openbb/index.ts:117-127`), but it is not applied globally.

**Recommendation:** Add a global `preHandler` hook with bearer token or API key validation. Extract the timing-safe comparison pattern from the OpenBB route into a shared auth plugin.

**[HIGH] SD-API-2: Rate limiting only on 2 of 28+ endpoints**
File: `src/routes/orders/index.ts:38` (10/s), `src/routes/bars/index.ts:11` (120/s)

Market order endpoints (`POST /positions/long`, `POST /positions/short`), position close endpoints, and engine config mutations have no rate limiting. A misbehaving client can spam market orders without throttling.

**Recommendation:** Apply rate limiting to all mutation endpoints. Consider a global baseline (e.g., 100/s) with tighter limits on order-placement routes.

**[MEDIUM] SD-API-3: Inconsistent URL scheme between v0 and v1 routes**

Core engine routes use flat paths (`/orders`, `/positions`, `/bars`), while quant-lib routes use `/v1/` prefix (`/v1/backtest`, `/v1/signal`, `/v1/positions`). No versioning strategy is documented.

**Recommendation:** Document the versioning convention. Either version all routes or none. If v1 is the "gateway-backed" API layer, make that distinction explicit in route registration.

**[MEDIUM] SD-API-4: DELETE /positions/:side uses string matching without enum validation**
File: `src/routes/positions/index.ts:58-76`

The `side` param is a raw string parsed via switch/case. TypeBox schema only validates it as `Type.String()`, not as a union of allowed values. Same pattern appears for `DELETE /orders?side=`.

**Recommendation:** Use `Type.Union([Type.Literal('long'), Type.Literal('short'), Type.Literal('all')])` for the params schema to get automatic 400 responses for invalid values.

**[LOW] SD-API-5: OpenAPI spec is read from disk at startup and cached forever**
File: `src/app.ts:115-116`

The spec is read once via `readFileSync` during `buildApp()`. If the spec file is updated, the server must restart to serve the new version. This is fine for production but can be confusing during development.

---

## 2. Event-Driven Architecture Review

### 2.1 Current Event Flow

```
POST /bars → broker.setPrice() → engine.onBar() → atrModule.onBar()
                                      ↓
                              IBrokerAdapter.marketOrder()
                              IBrokerAdapter.closePosition()
                                      ↓
                              PaperBroker emits 'fill'/'close'
                                      ↓
                              EventEmitter (shared)
                                      ↓
                              WebSocket /stream listeners
                                      ↓
                              socket.send(JSON.stringify(event))
```

### 2.2 Findings

**[HIGH] SD-EVT-1: Synchronous bar processing blocks all concurrent requests**
File: `src/routes/bars/index.ts:16-39`

The `POST /bars` handler calls `await engine.onBar(bar, bars)` synchronously. The `TradingEngine` is a single shared instance. During bar processing (which may trigger multiple fills and position updates), all other HTTP requests to the same engine are blocked by the Node.js event loop. For a bar that triggers trailing stop adjustments, order fills, and bracket evaluations, this could take multiple milliseconds, during which no other request can be served.

**Recommendation:** Accept bars into a queue (e.g., Redis Streams or an in-process async queue) and process them sequentially in a dedicated worker loop. Return `202 Accepted` from the HTTP handler. Publish state updates via the EventEmitter after processing completes.

**[HIGH] SD-EVT-2: EventEmitter has no backpressure mechanism**
File: `src/app.ts:70-71`, `src/routes/stream/index.ts:9-13`

`emitter.setMaxListeners(0)` removes the listener cap, and each WebSocket client adds 3 listeners (bar, fill, close). If a client's WebSocket send buffer fills up (slow consumer), `socket.send()` will buffer in memory without limit. The EventEmitter fires synchronously, so a large burst of events (e.g., a backtest replay fed through `/bars`) will queue messages for all connected clients before any of them can drain.

**Recommendation:** Check `socket.bufferedAmount` before sending. If above a threshold, drop events or disconnect the slow consumer. Consider switching to an async iterator pattern or a per-client ring buffer.

**[MEDIUM] SD-EVT-3: No event type envelope in WebSocket messages**
File: `src/routes/stream/index.ts:9-13`

All three event types (`bar`, `fill`, `close`) are sent through the same `onEvent` handler. The emitted payloads do not include a `type` field for fills and closes (only bar events include `{ type: 'bar', bar: ... }` from `src/routes/bars/index.ts:36`). Clients must guess the event type from the shape of the payload.

**Recommendation:** Wrap all events in a standard envelope: `{ type: 'fill' | 'close' | 'bar', payload: ... }`. This is a breaking change best done before external clients depend on the current format.

**[MEDIUM] SD-EVT-4: No event persistence or replay capability**
Events are fire-and-forget through the in-memory EventEmitter. If a WebSocket client disconnects and reconnects, it misses all events during the gap. There is no event log, no sequence numbers, and no replay mechanism.

**Recommendation:** Assign monotonically increasing sequence IDs to events. Store recent events in a ring buffer (or Redis Stream). Allow clients to resume from a `lastSeqId` on reconnect.

**[LOW] SD-EVT-5: MonitorTradesUseCase uses polling instead of events**
File: `src/use-cases/monitor-trades.ts:38-48`

The `MonitorTradesUseCase` polls positions via `setInterval`. Since the system already has an EventEmitter broadcasting fills and closes, this use case could react to events instead of polling, reducing latency from `intervalMs` to near-zero.

---

## 3. Scalability Analysis

### 3.1 Current Architecture (Single Instance)

```
                    ┌──────────────────────────────────┐
                    │         Fastify (port 3000)       │
                    │                                    │
                    │  ┌────────────┐  ┌─────────────┐  │
  HTTP/WS ────────►│  │   Routes   │──│ EventEmitter │  │
                    │  └─────┬──────┘  └──────┬──────┘  │
                    │        │                 │         │
                    │  ┌─────▼──────┐  ┌──────▼──────┐  │
                    │  │  Engine    │  │  WebSocket   │  │
                    │  │ (singleton)│  │  /stream     │  │
                    │  └─────┬──────┘  └─────────────┘  │
                    │        │                          │
                    │  ┌─────▼──────┐                   │
                    │  │PaperBroker │                   │
                    │  │ (in-memory)│                   │
                    │  └────────────┘                   │
                    └──────────────────────────────────┘
```

### 3.2 Findings

**[HIGH] SD-SCALE-1: Single-symbol, single-engine architecture**
File: `src/app.ts:72-74`, `src/plugins/engine.ts:15`

The entire application is hardwired to a single `TradingEngine` instance for a single symbol (default: EURUSD). There is no mechanism to run multiple engines for different symbols, timeframes, or accounts. The engine is decorated directly on the Fastify instance as a singleton.

**Recommendation:** For multi-symbol support, introduce an engine registry keyed by `{symbol, timeframe}`. Route handlers would resolve the appropriate engine from request parameters. This is a prerequisite for any multi-instrument trading setup.

**[HIGH] SD-SCALE-2: All state is in-process memory with no persistence**
Files: `src/plugins/broker.ts:40-49`

PaperBroker stores positions, deals, history orders, symbols, bars, and account info in plain arrays and Maps. A process restart loses all state. There is no snapshotting, no WAL, and no external store.

**Recommendation:** For production:
1. **Short term:** Serialize engine state to disk on graceful shutdown; restore on startup.
2. **Medium term:** Use Redis for position/order state with pub/sub for multi-instance coordination.
3. **Long term:** Event-source all state changes to a durable log (RabbitMQ, Kafka, or Redis Streams).

**[HIGH] SD-SCALE-3: No horizontal scaling path**

The `TradingEngine` maintains mutable internal state (order book, position sizes, trailing stop state, SMA/RSI buffers). Two instances of this server cannot share state. There is no shared-nothing partition strategy, no distributed lock, and no state replication.

**Recommendation:** If horizontal scaling is needed:
1. Partition by symbol — each engine instance owns a set of symbols.
2. Use Redis or a message broker for cross-instance coordination.
3. Front with a load balancer that routes by symbol to the correct instance (sticky sessions).

**[MEDIUM] SD-SCALE-4: PaperBroker uses O(n) linear scans for lookups**
File: `src/plugins/broker.ts:120-126`

`getPositionByTicket` and `closePositionByTicket` use `Array.find`/`Array.findIndex`. Existing TODO comments acknowledge this. For a paper broker with <100 positions this is fine, but it would not scale for a historical backtest gateway with thousands of deals.

**[MEDIUM] SD-SCALE-5: No graceful shutdown handling**
File: `src/server.ts:1-5`

The server listens on `0.0.0.0:3000` but has no shutdown signal handlers (`SIGTERM`, `SIGINT`). Fastify supports `app.close()` for graceful shutdown, but it is never wired up. In-flight requests and open WebSocket connections will be abruptly terminated.

**Recommendation:** Add signal handlers that call `app.close()` and drain WebSocket connections before exiting.

---

## 4. WebSocket Design Review

### 4.1 Current Design

The WebSocket endpoint at `GET /stream` (`src/routes/stream/index.ts`) provides a read-only event stream. Clients receive `bar`, `fill`, and `close` events as JSON.

### 4.2 Findings

**[HIGH] SD-WS-1: No heartbeat or keepalive mechanism**
File: `src/routes/stream/index.ts:4-27`

There is no ping/pong or application-level heartbeat. If a client silently disconnects (e.g., network failure without TCP FIN), the server will continue buffering events for that client until the OS TCP timeout fires (typically 2+ hours). This leaks memory and EventEmitter listeners.

**Recommendation:** Implement a server-side ping interval (e.g., every 30s). If no pong is received within a timeout, force-close the socket and run cleanup.

**[MEDIUM] SD-WS-2: No client-to-server message handling**
File: `src/routes/stream/index.ts:6`

The WebSocket handler ignores all incoming messages from clients. There is no subscription mechanism (e.g., subscribe to specific event types or symbols), no command channel, and no acknowledgment protocol.

**Recommendation:** Define a simple message protocol:
```json
{ "action": "subscribe", "events": ["fill", "close"] }
{ "action": "unsubscribe", "events": ["bar"] }
```

**[MEDIUM] SD-WS-3: No authentication on WebSocket upgrade**
The WebSocket upgrade happens without any auth check. Anyone who can reach the server can connect and receive all trading events including fill prices, position sizes, and P&L data.

**[LOW] SD-WS-4: JSON serialization on every send per client**

Each client's `onEvent` handler calls `JSON.stringify(event)` independently. For N connected clients receiving the same event, the same object is serialized N times. Pre-serialize once and send the string to all clients.

---

## 5. Trade-off Analysis

| Decision | Benefit | Cost | Revisit When |
|----------|---------|------|--------------|
| Single TradingEngine singleton | Simple wiring, no coordination | No multi-symbol, no horizontal scaling | Adding second symbol or second user |
| EventEmitter for pub/sub | Zero-dependency, synchronous delivery | No persistence, no backpressure, no replay | Adding event durability or >10 WS clients |
| PaperBroker implements all 7 interfaces | Single file, easy to understand | God-object risk, hard to swap individual gateways | Adding real broker adapter (MT5/IB) |
| In-memory state only | Fast, no infrastructure dependencies | State loss on restart, no audit trail | Moving beyond paper trading |
| Use-cases instantiated inline in handlers | No DI container needed | Hard to share instances, no lifecycle management | Use-case count exceeds ~15 or dependency graphs deepen |
| `fp()` wrapping for plugins | Engine/broker available in all scopes | Tight coupling between plugins and routes | Introducing plugin isolation or multi-tenant routing |

---

## 6. Prioritized Recommendations

### High Priority
1. **Add global authentication** -- All trading mutation endpoints are unprotected
2. **Add backpressure to WebSocket streaming** -- Slow consumers can cause unbounded memory growth
3. **Implement WebSocket heartbeat/keepalive** -- Silent disconnects leak resources
4. **Persist engine state** -- Process restart loses all positions and orders
5. **Queue bar processing** -- Synchronous `onBar()` blocks all concurrent requests

### Medium Priority
6. **Standardize event envelope format** -- Add `type` field to all WebSocket events
7. **Add event replay on reconnect** -- Clients currently miss events during disconnection
8. **Extend rate limiting to all mutation endpoints** -- Only 2 of 28+ routes are rate-limited
9. **Add graceful shutdown** -- Wire up SIGTERM/SIGINT to `app.close()`
10. **Validate route params with TypeBox unions** -- Prevent invalid `side` values reaching handler logic

### Low Priority
11. **Document API versioning strategy** -- v0 vs v1 convention is implicit
12. **Pre-serialize WebSocket messages** -- Avoid N redundant `JSON.stringify` calls
13. **Convert MonitorTradesUseCase to event-driven** -- Replace polling with EventEmitter subscription
14. **Cache OpenAPI spec with file watcher** -- Avoid restart requirement during development

---

*Report generated by engineering:system-design skill review.*
