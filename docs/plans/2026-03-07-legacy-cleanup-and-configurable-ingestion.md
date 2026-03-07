# Legacy Cleanup + Configurable Ingestion Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Remove all legacy code from the Order class hierarchy, then add a configurable ingestion model so the engine can be driven by OHLC bars, individual price ticks, or the internal event bus — caller's choice.

**Architecture:** The engine exposes two ingestion methods (`onBar` for OHLC, `onTick` for single prices); the HTTP layer grows a `POST /ticks` route; a `TickIngestionService` bridges bus `tick` events into `engine.onTick()`. Everything routes through the TypedEventBus — the ingestion source (HTTP, WebSocket, poll) is irrelevant to the engine.

**Tech Stack:** TypeScript ESM, Fastify, TypeBox, Vitest, trading-engine.ts (standalone core), TypedEventBus<AppEventMap>

---

## Part 1 — Legacy Cleanup

### Task 1: Eliminate type-switch in `TrailingOrder.updateTrailingRef`

**Context:** `TrailingOrder.updateTrailingRef()` in `trading-engine.ts` (~line 1008) switches on `this.type` string to decide which direction to trail. This defeats the class hierarchy — direction is already encoded in `this.side` (Side.Long vs Side.Short). `TrailingLimitOrder` and `TrailingStopOrder` trail in opposite directions; `MTOOrder` extends `TrailingStopOrder` and can inherit.

**Files:**
- Modify: `trading-engine.ts` — `TrailingOrder`, `TrailingLimitOrder`, `TrailingStopOrder`, `MTOOrder` classes
- Test: `trading-engine.test.ts` — trailing order tests

**Step 1: Read the current implementation**

Read `trading-engine.ts` lines 990–1055 to understand the full `TrailingOrder` class and its subclasses.

**Step 2: Write a failing test verifying polymorphic updateTrailingRef**

Add to `trading-engine.test.ts` inside the existing trailing order describe block:

```typescript
it('TrailingLimitOrder updateTrailingRef uses side not type string', async () => {
  // Buy trailing limit: trails the HIGH (price = high - dist)
  engine.setNextTrailEntry(TrailMode.Fixed, 10); // 10 pts distance
  engine.addBuyLimitTrail(1.0900, 1);
  const buyTrail = engine.orders[0];
  // Advance bar with high of 1.1000
  const bar = makeBar({ open: 1.0950, high: 1.1000, low: 1.0900, close: 1.0960 });
  await engine.onBar(bar, makeBars([bar]));
  // price should be high - dist = 1.1000 - 0.0010 = 1.0990
  expect(buyTrail.price).toBeCloseTo(1.0990, 4);
});

it('TrailingStopOrder updateTrailingRef uses side not type string', async () => {
  // Sell trailing stop: trails the HIGH (price = high + dist)
  engine.setNextTrailEntry(TrailMode.Fixed, 10);
  engine.addSellStopTrail(1.1100, 1);
  const sellTrail = engine.orders[0];
  const bar = makeBar({ open: 1.1050, high: 1.1100, low: 1.1000, close: 1.1050 });
  await engine.onBar(bar, makeBars([bar]));
  expect(sellTrail.price).toBeCloseTo(1.1110, 4);
});
```

Run: `npx vitest run trading-engine.test.ts -t "updateTrailingRef"` — expect PASS (these document existing behavior, not break it).

**Step 3: Refactor `TrailingOrder.updateTrailingRef` — remove the type-switch**

Replace the body of `TrailingOrder.updateTrailingRef` with a `side`-based abstract delegation:

```typescript
// In abstract class TrailingOrder — make updateTrailingRef abstract
// (remove the if/else chain entirely from the base class)
override updateTrailingRef(bar: Bar, _bars: Bars, symbol: SymbolInfoBase): void {
  if (this.pullbackPts != null) { super.updateTrailingRef(bar, _bars, symbol); return; }
  this._updateTrailRef(bar, symbol);
}

protected abstract _updateTrailRef(bar: Bar, symbol: SymbolInfoBase): void;
```

Then add `_updateTrailRef` overrides in each subclass:

```typescript
// TrailingLimitOrder — BUY trails bar.high (price below); SELL trails bar.low (price above)
protected override _updateTrailRef(bar: Bar, symbol: SymbolInfoBase): void {
  const dist = symbol.pointsToPrice(this.trailEntry.distPts);
  if (this.side === Side.Long) {
    if (bar.high > (this._trailRef ?? -Infinity)) { this._trailRef = bar.high; this.price = bar.high - dist; }
  } else {
    if (bar.low  < (this._trailRef ??  Infinity)) { this._trailRef = bar.low;  this.price = bar.low  + dist; }
  }
}

// TrailingStopOrder — BUY trails bar.low (price above); SELL trails bar.high (price below)
protected override _updateTrailRef(bar: Bar, symbol: SymbolInfoBase): void {
  const dist = symbol.pointsToPrice(this.trailEntry.distPts);
  if (this.side === Side.Long) {
    if (bar.low  < (this._trailRef ??  Infinity)) { this._trailRef = bar.low;  this.price = bar.low  + dist; }
  } else {
    if (bar.high > (this._trailRef ?? -Infinity)) { this._trailRef = bar.high; this.price = bar.high - dist; }
  }
}

// MTOOrder — inherits TrailingStopOrder._updateTrailRef (same direction logic)
// No override needed.
```

**Step 4: Run full test suite**

```bash
cd "/Users/xrey/Downloads/ex 2/.worktrees/feature/order-class-hierarchy"
npm test 2>&1 | tail -10
```

Expected: all tests pass (number should match pre-change count).

**Step 5: Run typecheck**

```bash
npm run typecheck 2>&1 | tail -5
```

Expected: no errors.

**Step 6: Commit**

```bash
git add trading-engine.ts trading-engine.test.ts
git commit -m "refactor: eliminate type-switch in updateTrailingRef — use side-based polymorphism"
```

---

### Task 2: Collapse `_addOrder` boilerplate duplication

**Context:** The 6 specialized public methods (`addBuyStopLimit`, `addSellStopLimit`, `addBuyMTO`, `addSellMTO`, `addBuyLimitTrail`, `addSellLimitTrail`, `addBuyStopTrail`, `addSellStopTrail`) each duplicate 4 lines of boilerplate: id generation, `_consumeNextParams`, `_resetNextAttrs`, `this.orders.push`. `_addOrder` contains the same 4 lines. Extract two private helpers — `_nextOrderId()` and `_registerOrder(o)` — so each public method calls `createOrder` directly with zero repeated ceremony.

**Files:**
- Modify: `trading-engine.ts` — `_addOrder`, the 8 specialized methods, new `_nextOrderId` and `_registerOrder` helpers

**Step 1: Read the current boilerplate**

Read `trading-engine.ts` lines 1430–1570 (all public add* methods) and lines 1796–1810 (`_addOrder`).

**Step 2: Extract `_nextOrderId()` and `_registerOrder(o)`**

Add these two private helpers immediately before `_addOrder`:

```typescript
private _nextOrderId(): string {
  return `ord_${++this._orderSeq}`;
}

private _registerOrder(o: Order): Order {
  this.orders.push(o);
  return o;
}
```

**Step 3: Simplify `_addOrder` to use the helpers**

```typescript
private _addOrder(
  type: 'BUY_LIMIT' | 'SELL_LIMIT' | 'BUY_STOP' | 'SELL_STOP' | 'BUY_MIT' | 'SELL_MIT',
  side: Side, price: number, size?: number,
): Order {
  const id = this._nextOrderId();
  const p  = this._consumeNextParams(id, type, side, price, size);
  this._resetNextAttrs();
  return this._registerOrder(createOrder(p as CreateOrderParams));
}
```

**Step 4: Refactor each specialized method to use the helpers**

Replace the boilerplate in each of the 8 methods. Example for `addBuyStopLimit`:

```typescript
addBuyStopLimit(price: number, limitPrice: number, size?: number): string {
  const id = this._nextOrderId();
  const p  = this._consumeNextParams<'BUY_STOP_LIMIT'>(id, 'BUY_STOP_LIMIT', Side.Long, price, size);
  this._resetNextAttrs();
  return this._registerOrder(createOrder({ ...p, limitPrice })).id;
}
```

Apply the same pattern to: `addSellStopLimit`, `addBuyMTO`, `addSellMTO`, `addBuyLimitTrail`, `addSellLimitTrail`, `addBuyStopTrail`, `addSellStopTrail`.

**Step 5: Run full test suite and typecheck**

```bash
npm test 2>&1 | tail -10
npm run typecheck 2>&1 | tail -5
```

Expected: all tests pass, no type errors.

**Step 6: Commit**

```bash
git add trading-engine.ts
git commit -m "refactor: extract _nextOrderId/_registerOrder, eliminate _addOrder boilerplate duplication"
```

---

### Task 3: Delete MT5 gateway stubs

**Context:** `src/broker/mt5/` contains 4 files that return `notImplemented()` for every method. They provide zero value — any consumer of `IFullBrokerAdapter` that requires MT5 will fail immediately. Keeping dead stubs signals they are usable. Delete them now; re-add when there is a real MT5 bridge to connect.

**Files:**
- Delete: `src/broker/mt5/mt5-account-gateway.ts`
- Delete: `src/broker/mt5/mt5-deal-gateway.ts`
- Delete: `src/broker/mt5/mt5-order-gateway.ts`
- Delete: `src/broker/mt5/mt5-position-gateway.ts`
- Modify: `src/broker/mt5/index.ts` — remove re-exports (or delete the file entirely)
- Check: `src/broker/broker-registry.ts` or `src/app.ts` — remove any MT5 import/instantiation

**Step 1: Check all import sites**

```bash
grep -rn "mt5\|MT5" src/ --include="*.ts" | grep -v test
```

Note every file that imports from `src/broker/mt5/`.

**Step 2: Remove MT5 imports from each consumer**

For each file found in Step 1, remove the MT5 import and any code that conditionally activates the MT5 adapter. If there is a registry entry, remove it.

**Step 3: Delete the mt5 directory**

```bash
rm -rf src/broker/mt5
```

**Step 4: Run tests and typecheck**

```bash
npm test 2>&1 | tail -10
npm run typecheck 2>&1 | tail -5
```

Expected: all tests pass (MT5 was never tested — there are no MT5 test files). No type errors.

**Step 5: Commit**

```bash
git add -A
git commit -m "chore: delete MT5 gateway stubs — re-add when a real bridge exists"
```

---

## Part 2 — Configurable Ingestion Model

### Task 4: Add `onTick(price, time)` to TradingEngine

**Context:** The engine's fill loop (`_checkOrderFills`, `_checkExits`) uses a `Bar` object to test prices. A tick is a single price point — model it as a synthetic bar where `open = high = low = close = price`. The engine stores the last-seen `Bars` series from `onBar` so tick-triggered fills have access to indicator context (ATR, SMA) without recomputing from scratch.

**Files:**
- Modify: `trading-engine.ts` — add `_lastBars` field, expose `onTick()`, keep `onBar()` unchanged
- Test: `trading-engine.test.ts` — add tick-fill tests

**Step 1: Write failing tests for `onTick`**

Add a new describe block to `trading-engine.test.ts`:

```typescript
describe('onTick — tick-driven fills', () => {
  it('fills a BUY_LIMIT order when tick price crosses the limit', async () => {
    // Set up a bar context first so _lastBars is populated
    const bar = makeBar({ open: 1.1000, high: 1.1050, low: 1.0950, close: 1.1000 });
    await engine.onBar(bar, makeBars([bar]));

    engine.addBuyLimit(1.0980, 1); // will fill when price <= 1.0980
    expect(engine.orders).toHaveLength(1);

    // Tick below limit price — should fill
    await engine.onTick(1.0975, new Date());

    expect(engine.orders).toHaveLength(0);        // order consumed
    expect(engine.longPos.size).toBe(1);          // position opened
  });

  it('does not fill when tick price does not cross the limit', async () => {
    const bar = makeBar({ open: 1.1000, high: 1.1050, low: 1.0950, close: 1.1000 });
    await engine.onBar(bar, makeBars([bar]));

    engine.addBuyLimit(1.0960, 1); // limit below tick price
    await engine.onTick(1.1000, new Date()); // price above limit — no fill

    expect(engine.orders).toHaveLength(1);
    expect(engine.longPos.size).toBe(0);
  });

  it('triggers SL exit on tick', async () => {
    const bar = makeBar({ open: 1.1000, high: 1.1050, low: 1.0950, close: 1.1000 });
    await engine.onBar(bar, makeBars([bar]));
    await engine.buy(1);
    engine.longPos.sl = 1.0950;

    // Tick below SL — should close position
    await engine.onTick(1.0940, new Date());

    expect(engine.longPos.size).toBe(0);
  });

  it('throws if called before any onBar (no bar context)', async () => {
    await expect(engine.onTick(1.1000, new Date())).rejects.toThrow('onTick requires at least one onBar call first');
  });
});
```

Run: `npx vitest run trading-engine.test.ts -t "onTick"` — expect FAIL (method not found).

**Step 2: Add `_lastBars` field**

Inside `TradingEngine`, add:

```typescript
private _lastBars: Bars | null = null;
```

At the start of `onBar`, save the bars reference:

```typescript
async onBar(bar: Bar, bars: Bars): Promise<void> {
  this._lastBars = bars;          // <-- add this line
  this._spreadAbs = await this.broker.getSpread(this.symbol.name);
  // ... rest unchanged
}
```

**Step 3: Implement `onTick`**

Add after `onBar`:

```typescript
/**
 * Process a single price tick.
 * Runs the fill loop and SL/TP exit checks using a synthetic bar
 * (all OHLC = tick price). Indicator updates (ATR, trailing entry)
 * are bar-level and are NOT run here.
 *
 * Requires at least one prior `onBar` call to establish bar context.
 */
async onTick(price: number, time: Date): Promise<void> {
  if (!this._lastBars) throw new Error('onTick requires at least one onBar call first');

  this._spreadAbs = await this.broker.getSpread(this.symbol.name);

  // Synthetic single-price bar — all OHLC equal the tick price
  const tick: Bar = new Bar({
    open: price, high: price, low: price, close: price,
    time, volume: 0, symbol: this.symbol.name, timeframe: 'tick',
  });

  for (const slot of [this.longPos, this.shortPos]) {
    if (slot.size === 0) continue;
    await this._checkExits(slot, tick);
  }

  await this._checkOrderFills(tick, this._lastBars);
}
```

**Step 4: Run the tick tests**

```bash
npx vitest run trading-engine.test.ts -t "onTick" 2>&1 | tail -20
```

Expected: all 4 tick tests pass.

**Step 5: Run full test suite and typecheck**

```bash
npm test 2>&1 | tail -10
npm run typecheck 2>&1 | tail -5
```

Expected: all pre-existing tests still pass. Zero type errors.

**Step 6: Commit**

```bash
git add trading-engine.ts trading-engine.test.ts
git commit -m "feat: add onTick(price, time) to TradingEngine for tick-driven fill checks"
```

---

### Task 5: Add `tick` event to AppEventMap + `POST /ticks` route

**Context:** The AppEventBus already has a `tick` key in AppEventMap (from the domain `tick` type). We need to verify its shape, then add a `POST /ticks` HTTP route that accepts a price + timestamp and emits the `tick` event to the bus. The bars route is the model: it calls `engine.onBar()` directly; the ticks route emits to the bus and lets TickIngestionService (Task 6) call `engine.onTick()`.

**Files:**
- Read: `src/shared/services/event-map.ts` — verify `tick` event shape
- Read: `src/shared/domain/tick.ts` — Tick value object fields
- Create: `src/market-data/schemas.ts` — add `PostTickBodySchema` (or extend existing file)
- Modify: `src/market-data/routes/bars.ts` — copy as model; do NOT change it
- Create: `src/market-data/routes/ticks.ts` — new route file
- Modify: `src/market-data/index.ts` — register ticks route
- Test: `src/market-data/ticks.test.ts` — route-level tests

**Step 1: Read the existing tick event shape**

```bash
cat src/shared/services/event-map.ts
cat src/shared/domain/tick.ts
```

Note: the `tick` event in AppEventMap has `{ price, time, symbol }` (or similar). Match your schema to it.

**Step 2: Write failing route tests**

Create `src/market-data/ticks.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { buildApp } from '../../app.js';
import type { FastifyInstance } from 'fastify';

describe('POST /ticks', () => {
  let app: FastifyInstance;

  beforeEach(async () => { app = await buildApp(); });
  afterEach(async () => { await app.close(); });

  it('accepts a valid tick and returns 204', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/ticks',
      payload: { price: 1.1050, time: new Date().toISOString() },
    });
    expect(res.statusCode).toBe(204);
  });

  it('rejects missing price with 400', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/ticks',
      payload: { time: new Date().toISOString() },
    });
    expect(res.statusCode).toBe(400);
  });

  it('rejects invalid price type with 400', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/ticks',
      payload: { price: 'not-a-number', time: new Date().toISOString() },
    });
    expect(res.statusCode).toBe(400);
  });
});
```

Run: `npx vitest run src/market-data/ticks.test.ts` — expect FAIL (route not found).

**Step 3: Add TypeBox schema**

In `src/market-data/schemas.ts` (or wherever `PostBarsBodySchema` is defined), add:

```typescript
export const PostTickBodySchema = Type.Object({
  price: Type.Number({ minimum: 0, description: 'Current market price' }),
  time:  Type.Optional(Type.String({ format: 'date-time', description: 'Tick timestamp (ISO 8601); defaults to now' })),
});
export type PostTickBody = Static<typeof PostTickBodySchema>;
```

**Step 4: Create `src/market-data/routes/ticks.ts`**

```typescript
import type { FastifyPluginAsync } from 'fastify';
import { PostTickBodySchema, type PostTickBody } from '../schemas.js';

const ticksRoute: FastifyPluginAsync = async (fastify) => {
  fastify.post<{ Body: PostTickBody }>('/ticks', {
    schema: {
      body: PostTickBodySchema,
      response: { 204: { type: 'null' } },
    },
  }, async (req, reply) => {
    const { price, time } = req.body;
    const tickTime = time ? new Date(time) : new Date();

    fastify.emitter.emit('tick', {
      price,
      time:   tickTime,
      symbol: fastify.symbol,
    });

    return reply.status(204).send();
  });
};

export default ticksRoute;
```

**Step 5: Register in `src/market-data/index.ts`**

```typescript
import ticksRoute from './routes/ticks.js';
// Inside the plugin function, after registering bars route:
fastify.register(ticksRoute);
```

**Step 6: Run failing tests → pass**

```bash
npx vitest run src/market-data/ticks.test.ts 2>&1 | tail -20
```

Expected: all 3 tests pass.

**Step 7: Run full suite and typecheck**

```bash
npm test 2>&1 | tail -10
npm run typecheck 2>&1 | tail -5
```

**Step 8: Commit**

```bash
git add src/market-data/routes/ticks.ts src/market-data/schemas.ts src/market-data/index.ts src/market-data/ticks.test.ts
git commit -m "feat: POST /ticks route — emits tick event to bus for downstream consumers"
```

---

### Task 6: TickIngestionService — bridge bus tick events to engine.onTick()

**Context:** `TickIngestionService` subscribes to `tick` events on the AppEventBus and calls `engine.onTick()` inside the engine mutex (same pattern as the bars route, which holds `app.engineMutex` during `onBar`). It extends `BaseService` so it starts/stops with the app and appears in `/services`.

**Files:**
- Create: `src/market-data/tick-ingestion-service.ts`
- Modify: `src/market-data/index.ts` — export the new service
- Test: `src/market-data/tick-ingestion-service.test.ts`

**Step 1: Write failing tests**

Create `src/market-data/tick-ingestion-service.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TickIngestionService } from './tick-ingestion-service.js';
import { TypedEventBus } from '../shared/event-bus.js';
import type { AppEventMap } from '../shared/services/event-map.js';

describe('TickIngestionService', () => {
  let bus: TypedEventBus<AppEventMap>;
  let mockEngine: { onTick: ReturnType<typeof vi.fn> };
  let mockMutex: { runExclusive: ReturnType<typeof vi.fn> };
  let svc: TickIngestionService;

  beforeEach(() => {
    bus = new TypedEventBus();
    mockEngine = { onTick: vi.fn().mockResolvedValue(undefined) };
    mockMutex  = { runExclusive: vi.fn(fn => fn()) };
    svc = new TickIngestionService(mockEngine as any, mockMutex as any, bus, console as any);
  });

  it('calls engine.onTick when a tick event fires (after start)', async () => {
    await svc.start();
    bus.emit('tick', { price: 1.1050, time: new Date(), symbol: 'EURUSD' });
    // give the event loop a tick
    await new Promise(r => setImmediate(r));
    expect(mockEngine.onTick).toHaveBeenCalledWith(1.1050, expect.any(Date));
  });

  it('does not call engine.onTick before start', async () => {
    bus.emit('tick', { price: 1.1050, time: new Date(), symbol: 'EURUSD' });
    await new Promise(r => setImmediate(r));
    expect(mockEngine.onTick).not.toHaveBeenCalled();
  });

  it('stops listening after stop()', async () => {
    await svc.start();
    await svc.stop();
    bus.emit('tick', { price: 1.1050, time: new Date(), symbol: 'EURUSD' });
    await new Promise(r => setImmediate(r));
    expect(mockEngine.onTick).not.toHaveBeenCalled();
  });

  it('health returns signalsProcessed count', async () => {
    await svc.start();
    bus.emit('tick', { price: 1.1050, time: new Date(), symbol: 'EURUSD' });
    await new Promise(r => setImmediate(r));
    const h = svc.health();
    expect(h.ticksProcessed).toBe(1);
  });
});
```

Run: `npx vitest run src/market-data/tick-ingestion-service.test.ts` — expect FAIL.

**Step 2: Implement `TickIngestionService`**

Create `src/market-data/tick-ingestion-service.ts`:

```typescript
import { BaseService } from '../shared/services/base-service.js';
import { ServiceKind } from '../shared/services/types.js';
import type { TypedEventBus } from '../shared/event-bus.js';
import type { AppEventMap } from '../shared/services/event-map.js';
import type { Logger } from '../shared/lib/logger.js';
import type { Mutex } from '../shared/lib/mutex.js';
import type { TradingEngine } from '../../trading-engine.js';

export class TickIngestionService extends BaseService {
  readonly id   = 'ingestion:tick';
  readonly kind = ServiceKind.DataProvider;
  readonly name = 'tick-ingestion';

  private _ticksProcessed = 0;

  constructor(
    private readonly engine: Pick<TradingEngine, 'onTick'>,
    private readonly mutex: Pick<Mutex, 'runExclusive'>,
    eventBus: TypedEventBus<AppEventMap>,
    logger: Logger,
  ) {
    super(eventBus, logger);
  }

  protected async onStart(): Promise<void> {
    this.eventBus.off('tick', this._handleTick);
    this.eventBus.on('tick', this._handleTick);
  }

  protected async onStop(): Promise<void> {
    this.eventBus.off('tick', this._handleTick);
  }

  private _handleTick = (event: AppEventMap['tick']): void => {
    void this.mutex.runExclusive(async () => {
      try {
        await this.engine.onTick(event.price, event.time);
        this._ticksProcessed++;
      } catch (err) {
        this.logger.error({ err }, '[TickIngestionService] onTick error');
      }
    });
  };

  override getHealthMetadata(): Record<string, unknown> {
    return { ticksProcessed: this._ticksProcessed };
  }

  health(): { ticksProcessed: number } {
    return { ticksProcessed: this._ticksProcessed };
  }
}
```

**Step 3: Add `DataProvider` ServiceKind if `TickIngestionService` reuses it, or add `TickIngestion`**

Check `src/shared/services/types.ts`. If `ServiceKind.DataProvider` is already there, reuse it. If you want a dedicated kind:

```typescript
// In ServiceKind:
TickIngestion: 'TICK_INGESTION',
```

Also add `'TICK_INGESTION'` to `ServiceKindSchema` in `src/services/schemas.ts`.

**Step 4: Run the service tests**

```bash
npx vitest run src/market-data/tick-ingestion-service.test.ts 2>&1 | tail -20
```

Expected: all 4 tests pass.

**Step 5: Run full suite and typecheck**

```bash
npm test 2>&1 | tail -10
npm run typecheck 2>&1 | tail -5
```

**Step 6: Commit**

```bash
git add src/market-data/tick-ingestion-service.ts src/market-data/tick-ingestion-service.test.ts src/market-data/index.ts src/shared/services/types.ts src/services/schemas.ts
git commit -m "feat: TickIngestionService — bridges bus tick events to engine.onTick() via mutex"
```

---

### Task 7: Wire TickIngestionService into app.ts lifecycle

**Context:** Following the same pattern used for `RiskManagerService`, `ExecutionSaga`, and `OrderManagerService` (Task 3 of the previous plan), wire `TickIngestionService` into `buildApp()`. It needs `engine`, `engineMutex`, `emitter`, and `logger`. Register it in `serviceRegistry` and start/stop via the existing hooks.

**Files:**
- Modify: `src/app.ts` — instantiate and register `TickIngestionService`
- Test: `src/routes.test.ts` — check `/services` list includes `tick-ingestion`

**Step 1: Write a failing test**

In `src/routes.test.ts`, find the existing test that checks `/services` list and add:

```typescript
it('includes tick-ingestion in /services list', async () => {
  const res = await app.inject({ method: 'GET', url: '/services' });
  expect(res.statusCode).toBe(200);
  const body = res.json();
  const svc = body.services.find((s: { id: string }) => s.id === 'ingestion:tick');
  expect(svc).toBeDefined();
});
```

Run: `npx vitest run src/routes.test.ts -t "tick-ingestion"` — expect FAIL.

**Step 2: Wire in `src/app.ts`**

After the existing manager service registrations (~line 214), add:

```typescript
import { TickIngestionService } from './market-data/tick-ingestion-service.js';

// Inside buildApp(), after riskManager/executionSaga/orderManager:
const tickIngestion = new TickIngestionService(engine, app.engineMutex, emitter, logger);
serviceRegistry.register(tickIngestion);
```

In the `onReady` hook, add:
```typescript
await tickIngestion.start();
```

In the `onClose` hook, `serviceRegistry.stopAll()` already handles it (if it does) — or add:
```typescript
await tickIngestion.stop();
```

**Step 3: Run the failing test → pass**

```bash
npx vitest run src/routes.test.ts -t "tick-ingestion" 2>&1 | tail -10
```

**Step 4: Run full suite and typecheck**

```bash
npm test 2>&1 | tail -10
npm run typecheck 2>&1 | tail -5
```

Expected: 713+ tests pass (net gain from new tests), zero type errors.

**Step 5: Run lint**

```bash
npm run lint 2>&1 | grep "error" | head -10
```

Expected: no new errors (41 existing warnings are acceptable).

**Step 6: Commit**

```bash
git add src/app.ts
git commit -m "feat: wire TickIngestionService into app.ts lifecycle"
```

---

## E2E Verification

After all 7 tasks:

```bash
cd "/Users/xrey/Downloads/ex 2/.worktrees/feature/order-class-hierarchy"
npm test && npm run typecheck && npm run build && npm run lint
```

Smoke test (after `npm start`):
```bash
# Send a bar to establish context
curl -X POST localhost:3000/bars \
  -H 'Content-Type: application/json' \
  -d '{"open":1.1000,"high":1.1050,"low":1.0950,"close":1.1000,"time":"2026-01-01T10:00:00Z","volume":1000}'

# Place a buy limit
curl -X POST localhost:3000/orders \
  -H 'Content-Type: application/json' \
  -d '{"type":"BUY_LIMIT","price":1.0980,"size":1}'

# Send a tick that crosses the limit — order should fill
curl -X POST localhost:3000/ticks \
  -H 'Content-Type: application/json' \
  -d '{"price":1.0975}'

# Verify position opened
curl localhost:3000/positions
```

---

## Summary

| # | Task | Legacy removed / Feature added |
|---|------|-------------------------------|
| 1 | Polymorphic updateTrailingRef | Eliminates `this.type` string-switch in favour of `this.side`-based dispatch |
| 2 | Collapse _addOrder boilerplate | 20 lines of duplicated ceremony → 2 private helpers |
| 3 | Delete MT5 stubs | 4 dead files removed |
| 4 | engine.onTick() | Tick-driven fill checks, synthetic bar, lastBars context |
| 5 | POST /ticks route | HTTP tick ingestion → bus event |
| 6 | TickIngestionService | Bus tick event → engine.onTick() via mutex |
| 7 | Wire in app.ts | Service registered, started, visible in /services |
