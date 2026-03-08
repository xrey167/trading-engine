# Engineering Architecture Review

**Date:** 2026-03-07
**Reviewer:** reviewer-6 (engineering:architecture)
**Branch:** `review/engineering-architecture`
**Status:** Complete

---

## Executive Summary

The codebase follows a hexagonal (ports-and-adapters) architecture with generally correct dependency flow. The domain layer is clean, gateway interfaces (ports) are well-defined, and use-cases depend on abstractions rather than concretions. However, there are several structural violations that weaken the architecture's guarantees:

1. **The core `trading-engine.ts` is treated as both infrastructure and domain** -- it leaks into every layer (domain, gateways, strategies, routes, plugins) creating a de-facto "God module" dependency.
2. **Route handlers bypass use-cases** for the core engine routes (`/positions`, `/orders`, `/bars`), calling `fastify.engine.*` directly and reducing the application layer to a partial facade.
3. **Use-cases are instantiated inline in handlers** rather than through a composition root, coupling route handlers to concrete construction.
4. **PaperBroker implements 7 interfaces** in a single class, conflating adapter and gateway responsibilities.

Overall the architecture is **sound for the current project size** but will encounter friction as it scales.

---

## Architecture Diagram

```
                        ┌─────────────────────────────────────────────┐
                        │              Fastify HTTP Layer              │
                        │                                             │
                        │  routes/        plugins/       schemas/     │
                        │  ┌──────┐      ┌──────────┐   ┌────────┐   │
                        │  │orders│      │engine.ts │   │TypeBox │   │
                        │  │bars  │      │broker.ts │   │schemas │   │
                        │  │pos.  │─────▶│atr.ts    │   └────────┘   │
                        │  │stream│      │rate-limit│                 │
                        │  │v1-*  │      │cors      │                 │
                        │  └──┬───┘      └────┬─────┘                 │
                        └─────┼───────────────┼───────────────────────┘
                              │               │
                     ┌────────▼────────┐      │
                     │   use-cases/    │      │
                     │ PlaceOrder      │      │
                     │ GetPositions    │      │
                     │ BacktestUC      │      │
                     │ RunSignalUC     │      │
                     │ MonitorTrades   │      │
                     │ Correlator      │      │
                     └────────┬────────┘      │
                              │               │
               ┌──────────────▼──────────┐    │
               │     gateways/           │    │
               │  types.ts (ports)       │    │
               │  ┌─────────┐ ┌───────┐  │    │
               │  │InMemory │ │ MT5   │  │    │
               │  │(4 impl) │ │(4 stub│  │    │
               │  └─────────┘ └───────┘  │    │
               │  broker-registry.ts     │    │
               └──────────────┬──────────┘    │
                              │               │
               ┌──────────────▼──────────┐    │
               │     domain/             │    │
               │  enums, VOs, types      │    │
               │  trade-signal, position │    │
               │  session, tick, history │    │
               └─────────────────────────┘    │
                                              │
          ┌───────────────────────────────────▼──┐
          │        trading-engine.ts              │
          │  (standalone ~1640-line module)       │
          │  TradingEngine, Bars, Candle,         │
          │  SymbolInfo, IBrokerAdapter, Side,    │
          │  TrailMode, AtrModule, ScaledOrder... │
          └──────────────────────────────────────┘
```

**Legend:** Arrows show `import` / dependency direction. The arrow from `gateways/types.ts` down to `trading-engine.ts` is a hexagonal violation (port depends on infrastructure).

---

## Hexagonal Architecture Compliance Assessment

### What Works Well

| Principle | Status | Evidence |
|-----------|--------|----------|
| Domain layer has no outward deps | Partial | `src/domain/` does not import routes, plugins, or gateways |
| Ports defined as interfaces | Pass | `gateways/types.ts` defines 6 clean port interfaces |
| Adapters implement ports | Pass | `InMemory*`, `MT5*`, `PaperBroker` all implement gateway interfaces |
| Use-cases depend on port interfaces | Pass | `PlaceOrderUseCase` takes `IOrderGateway`, not `PaperBroker` |
| Result type for error handling | Pass | Consistent `Result<T, DomainError>` across all layers |
| `as const` enum pattern | Pass | Used consistently in domain and engine |

### What Needs Improvement

| Principle | Status | Evidence |
|-----------|--------|----------|
| Domain independence from infrastructure | Fail | `domain/session.ts:2` imports `OHLC` from `trading-engine.ts` |
| Ports independent of infrastructure | Fail | `gateways/types.ts:8` imports `Bars` from `trading-engine.ts` |
| Routes go through use-cases | Fail | Core routes (`/positions`, `/orders`, `/bars`) call engine directly |
| Composition root wires dependencies | Fail | Use-cases instantiated inline in handlers |
| Single Responsibility for adapters | Partial | `PaperBroker` implements 7 interfaces in one class |

---

## Dependency Flow Analysis

### Violation 1: `trading-engine.ts` as Ubiquitous Dependency (HIGH)

The standalone `trading-engine.ts` module is imported by **every layer**:

| Layer | Files importing `trading-engine.ts` |
|-------|-------------------------------------|
| domain/ | `session.ts:2` (OHLC type) |
| gateways/ | `types.ts:8` (Bars), `in-memory/account-gateway.ts:7-8` (Bars, OHLC), `mt5/mt5-account-gateway.ts:7` |
| use-cases/ | `backtest.ts:1` (Bars, OHLC) |
| strategies/ | `types.ts:1`, `volume-breakout.ts:1`, `candle-atr.ts` (Bars) |
| routes/ | `positions/index.ts:2` (Side), `orders/index.ts:3` (TrailMode), `bars/index.ts:2` (Candle, Bars), `signal/index.ts:4` (Bars), `scaled-orders/index.ts:3`, `openbb/index.ts:4` (Side), `shared/strategy-helpers.ts:1` (OHLC) |
| plugins/ | `engine.ts:3-4`, `broker.ts:2-3`, `atr.ts:3` |
| types/ | `index.ts:2` |
| analysis/ | `atr.ts:1`, `local-extremes.ts:1` |

**Impact:** `trading-engine.ts` is simultaneously domain logic (TradingEngine), value objects (Bars, Candle, OHLC, Side), port interfaces (IBrokerAdapter), and configuration (SymbolInfo, AtrModule). In a strict hexagonal model, domain types (Side, OHLC) should live in `domain/`, port interfaces in `gateways/`, and only the engine class itself should remain in the infrastructure boundary.

**File references:**
- `src/gateways/types.ts:8` -- port imports concrete `Bars` from engine
- `src/domain/session.ts:2` -- domain imports `OHLC` from engine
- `src/use-cases/backtest.ts:1` -- use-case imports `Bars` from engine

### Violation 2: Routes Bypass Application Layer (MEDIUM)

Two distinct patterns exist for route handlers:

**Pattern A -- Use-case mediated (correct hexagonal):**
- `routes/v1-positions/index.ts` -- creates `GetPositionsUseCase`, `ClosePositionUseCase`, `ModifyPositionUseCase`
- `routes/backtest/index.ts` -- creates `BacktestUseCase`
- `routes/signal/index.ts` -- creates `RunSignalUseCase`
- `routes/money-management/index.ts` -- creates `CreateMoneyManagementUseCase`

**Pattern B -- Direct engine access (hexagonal violation):**
- `routes/positions/index.ts` -- calls `fastify.engine.buy()`, `engine.closeBuy()`, `engine.getSizeBuy()`, etc. directly (14+ engine method calls)
- `routes/orders/index.ts` -- calls `fastify.engine.addBuyLimit()`, `engine.deleteOrder()`, etc. directly
- `routes/bars/index.ts` -- calls `engine.onBar()`, `broker.setPrice()` directly
- `routes/scaled-orders/index.ts` -- instantiates `ScaledOrderEngine` from `trading-engine.ts`
- `routes/engine/index.ts` -- likely calls engine state directly
- `routes/atr/index.ts` -- calls `fastify.atrModule` / `fastify.atrConfig`

**Impact:** The application layer (`use-cases/`) is only used by the `v1-*` routes, `backtest`, `signal`, and `money-management` routes. The original core routes interact with the engine directly, making it impossible to add cross-cutting concerns (logging, validation, authorization) in a single place.

### Violation 3: Domain Layer Imports Infrastructure (LOW-MEDIUM)

- `src/domain/session.ts:2` imports `OHLC` from `../../trading-engine.js`

In hexagonal architecture, the domain layer should be the innermost ring with zero outward dependencies. The `OHLC` type is a plain structural type (`{ open, high, low, close, time, volume }`) that could trivially be defined in `domain/`.

---

## Coupling Analysis

### Tight Coupling: PaperBroker (7 interfaces, ~250 lines)

`src/plugins/broker.ts:39` -- `PaperBroker` implements:
1. `IBrokerAdapter` (from `trading-engine.ts`)
2. `IOrderGateway`
3. `IPositionGateway`
4. `IHistoryGateway`
5. `IMarketDataGateway`
6. `IAccountGateway`
7. `IIndicatorGateway`

The codebase acknowledges this in a TODO comment (`broker.ts:29-37`) and has already created split implementations in `gateways/in-memory/` (4 gateways: position, order, deal, account). However, these split gateways are **not wired into the application** -- only `PaperBroker` is used at runtime.

**Impact:** Testing is harder because you must construct the entire PaperBroker to test any single gateway concern. The split gateways exist but are orphaned.

### Tight Coupling: Fastify Type Declarations

`src/types/index.ts:11` declares `broker: PaperBroker` on `FastifyInstance`, coupling the Fastify type system to the concrete PaperBroker class rather than the `IFullBrokerAdapter` interface. This means:
- All route handlers that access `fastify.broker` are type-coupled to PaperBroker
- Swapping to a real broker adapter would require changing the type declaration

### Loose Coupling (Good)

- Use-cases accept interface types: `PlaceOrderUseCase(IOrderGateway)`, `GetPositionsUseCase(IPositionGateway)`
- `BrokerRegistry` uses `IFullBrokerAdapter` interface
- `MonitorTradesUseCase` depends on `IPositionGateway` port
- Strategy pattern: `ISignalStrategy` interface with `CandleAtrStrategy` and `VolumeBreakoutStrategy` implementations
- Money management: `IStopLossCalculator`, `ITakeProfitCalculator`, `ILotsProvider` interfaces with composite pattern

---

## Composition Root Analysis

**Current state:** There is no composition root. `src/app.ts:63` (`buildApp()`) wires infrastructure (EventEmitter, PaperBroker, plugins) but does **not** pre-wire use-cases.

Use-cases are instantiated inline in route handlers:
- `routes/v1-positions/index.ts:28` -- `new GetPositionsUseCase(broker, log)`
- `routes/v1-positions/index.ts:56` -- `new ClosePositionUseCase(broker, log)`
- `routes/backtest/index.ts:41` -- `new BacktestUseCase(strategy, fastify.log)`
- `routes/signal/index.ts:47` -- `new RunSignalUseCase(strategy, fastify.log)`

The code has a self-aware TODO at `src/app.ts:58-62`:
> *"Use-cases are instantiated inline in route handlers... if the number of use-cases or their dependency graphs grow, consider a factory or composition root here in buildApp()"*

**Impact at current scale:** Acceptable. Use-cases have 1-2 constructor parameters.
**Impact at scale:** Each new cross-cutting concern (auth, telemetry, caching) must be threaded through every handler individually.

---

## Port/Adapter Completeness

### Ports Defined (`gateways/types.ts`)

| Port | InMemory Adapter | MT5 Adapter | PaperBroker |
|------|:---:|:---:|:---:|
| `IOrderGateway` | `InMemoryOrderGateway` | `MT5OrderGateway` (stub) | Implemented |
| `IPositionGateway` | `InMemoryPositionGateway` | `MT5PositionGateway` (stub) | Implemented |
| `IHistoryGateway` | -- | -- | Implemented |
| `IMarketDataGateway` | -- | -- | Implemented |
| `IAccountGateway` | `InMemoryAccountGateway` | `MT5AccountGateway` (stub) | Implemented |
| `IIndicatorGateway` | -- | -- | Implemented |

**Gaps:**
- No `InMemoryHistoryGateway`, `InMemoryMarketDataGateway`, or `InMemoryIndicatorGateway`
- MT5 adapters are all stubs returning `notImplemented` errors
- `IHistoryGateway` and `IIndicatorGateway` have no split in-memory adapter

### Ports Not Used

The `BrokerRegistry` (`gateways/broker-registry.ts`) and `BrokerAdapterFactory` are defined but **never wired** in `buildApp()`. They exist as infrastructure for future multi-broker support but are currently dead code in the runtime path.

---

## Specific Findings

### F1. Gateway port depends on engine concrete type (HIGH)

**File:** `src/gateways/types.ts:8`
```typescript
import type { Bars } from '../../trading-engine.js';
```

The `IMarketDataGateway.getBars()` return type is `Result<Bars, DomainError>` where `Bars` is a class from `trading-engine.ts`. This means the port interface depends on the engine implementation, inverting the dependency arrow.

**Fix:** Define an `IBars` interface in `domain/` or `gateways/` and have `trading-engine.Bars` implement it.

### F2. Two parallel position APIs with different architectures (MEDIUM)

**Files:** `src/routes/positions/index.ts` vs `src/routes/v1-positions/index.ts`

- `/positions` -- direct engine access, no use-cases, manages engine-level position slots (long/short aggregates)
- `/v1/positions` -- use-case mediated, manages individual positions via `IPositionGateway`

These represent two different abstraction levels (engine-level vs broker-level) exposed simultaneously, which could confuse API consumers.

### F3. Strategy creation coupled to route layer (LOW)

**File:** `src/routes/shared/strategy-helpers.ts:37-41`

```typescript
export function createStrategy(name: string | undefined, log: Logger): ISignalStrategy {
  const resolved = name ?? 'CandleAtr';
  return resolved === 'VolumeBreakout'
    ? new VolumeBreakoutStrategy({}, log)
    : new CandleAtrStrategy({}, log);
}
```

Strategy factory logic lives in the route layer. This should be in `strategies/` or `use-cases/` to keep routes thin.

### F4. Hardcoded user ID in v1 routes (LOW)

**File:** `src/routes/v1-positions/index.ts:9`
```typescript
const DEFAULT_USER_ID = 'default';
```

Authentication is stubbed with a hardcoded user ID. While acknowledged via a TODO comment, this is an architectural concern -- the entire v1 route set has no auth middleware injection point.

### F5. EventEmitter as cross-cutting pub/sub (INFO)

**File:** `src/app.ts:70-71`

The `EventEmitter` is used as a lightweight event bus (fill, close, bar events). This is appropriate for the current single-process deployment but would need replacement (Redis pub/sub, RabbitMQ) for multi-process/multi-node scenarios per the project's CLAUDE.md conventions.

### F6. `analysis/` module dependency direction (INFO)

**Files:** `src/analysis/atr.ts:1`, `src/analysis/local-extremes.ts:1`

Both import `Bars` from `trading-engine.ts`. The `analysis/` layer sits at the same level as `strategies/` but has no port interface -- it operates directly on engine types. If `analysis/` is meant to be a domain service, it should depend on domain types, not engine types.

---

## Prioritized Recommendations

### HIGH Priority

1. **Extract shared value types from `trading-engine.ts` into `domain/`**
   - Move `OHLC`, `Side`, `TrailMode`, `AtrMethod` type definitions to `src/domain/enums.ts` or new `src/domain/bar-types.ts`
   - Define an `IBars` interface in `domain/` or `gateways/`; have `trading-engine.Bars` implement it
   - This eliminates the root cause of most dependency violations
   - **Effort:** Medium. Requires updating imports across ~25 files.

2. **Change `FastifyInstance.broker` type from `PaperBroker` to `IFullBrokerAdapter`**
   - In `src/types/index.ts:11`, change `broker: PaperBroker` to `broker: IFullBrokerAdapter`
   - Enables adapter swapping without type-system changes
   - **Effort:** Low. May require adding missing methods to `IFullBrokerAdapter` (e.g., `setPrice`, `seedPosition`).

### MEDIUM Priority

3. **Wrap core routes in use-cases for consistency**
   - Create `BuyUseCase`, `SellUseCase`, `OnBarUseCase` etc. that encapsulate engine calls
   - Core routes (`/positions`, `/orders`, `/bars`) should follow the same pattern as `/v1/positions`
   - **Effort:** Medium. Each use-case is thin but there are many engine methods.

4. **Wire split gateways into the application**
   - The `InMemoryPositionGateway`, `InMemoryOrderGateway`, etc. exist but are unused
   - Either wire them via `BrokerRegistry` in `buildApp()` or remove them to avoid dead code
   - **Effort:** Low-Medium.

5. **Move strategy factory out of routes**
   - Relocate `createStrategy()` from `routes/shared/strategy-helpers.ts` to `strategies/factory.ts`
   - Routes should only import the factory, not concrete strategy classes
   - **Effort:** Low.

### LOW Priority

6. **Introduce a composition root in `buildApp()`**
   - Pre-wire use-cases and decorate them on the Fastify instance (or use a DI container)
   - Currently manageable with 7 use-cases, but will become painful beyond ~15
   - **Effort:** Low-Medium.

7. **Complete the in-memory gateway set**
   - Add `InMemoryHistoryGateway`, `InMemoryMarketDataGateway`, `InMemoryIndicatorGateway`
   - Enables isolated testing of use-cases without PaperBroker
   - **Effort:** Low (each is ~30 lines, following existing patterns).

8. **Consolidate or clearly differentiate the two position APIs**
   - `/positions` (engine-level aggregates) vs `/v1/positions` (individual broker-level positions)
   - Document the distinction in the API spec or merge them behind a single facade
   - **Effort:** Low (documentation) to High (merge).

---

## Summary Scorecard

| Dimension | Score | Notes |
|-----------|:-----:|-------|
| Dependency direction correctness | 6/10 | `trading-engine.ts` breaks inward-only rule across all layers |
| Port/adapter separation | 7/10 | Ports well-defined; PaperBroker conflates too many roles |
| Application layer coverage | 5/10 | Only v1/backtest/signal routes use use-cases; core routes bypass |
| Domain purity | 7/10 | Clean except `session.ts` importing `OHLC` from engine |
| Composition root | 4/10 | No composition root; inline instantiation |
| Testability via architecture | 7/10 | Use-cases are testable; core routes require full app setup |
| Overall hexagonal compliance | **6/10** | Foundations are solid; execution is partial |

---

*Generated by engineering:architecture skill review.*
