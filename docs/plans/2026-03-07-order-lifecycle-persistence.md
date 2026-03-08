# Order Lifecycle Persistence Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Persist every order state transition (PLACED, FILLED, CANCELLED, REJECTED, EXPIRED, MODIFIED) to a Postgres `order_events` append-only ledger, then expose the history as an OpenBB SSRM widget at `GET /openbb/order-history`.

**Architecture:** Append-only event ledger (never UPDATE/DELETE) written by a new `OrderWriter` service that subscribes to the typed `order` event on the app-level `TypedEventBus<AppEventMap>`. The HTTP routes for orders (`POST /orders`, `PATCH /orders/:id`, `DELETE /orders/:id`) will emit the missing events (`PLACED`, `MODIFIED`, `CANCELLED`). Engine-internal fills already emit `FILLED`; `REJECTED` events come from `ExecutionSaga`; `EXPIRED` will be emitted when the engine removes pending orders.

**Tech Stack:** Drizzle ORM (drizzle-orm/node-postgres), TypeBox, Fastify, TypedEventBus, Vitest.

---

## Task 1: Extend OrderEvent type

**Files:**
- Modify: `src/shared/services/event-map.ts`

**Context:**
`OrderEvent` currently has `action: 'PLACED' | 'FILLED' | 'REJECTED' | 'CANCELLED'`.
We need `'EXPIRED' | 'MODIFIED'` added to the union and three new optional fields:
- `orderId: number` — the engine-assigned ticket
- `orderType: string` — e.g. `'BUY_LIMIT'`, `'SELL_STOP_LIMIT'`
- `source?: 'http' | 'broker' | 'synthetic'`
- `limitPrice?: number` — for StopLimit orders

**Step 1: Read the current file**

```bash
cat src/shared/services/event-map.ts
```

**Step 2: Write the updated OrderEvent**

Add to the `OrderEvent` interface (or type alias — match what is already there):

```typescript
export type OrderEvent = {
  action: 'PLACED' | 'FILLED' | 'REJECTED' | 'CANCELLED' | 'EXPIRED' | 'MODIFIED';
  orderId:    number;
  orderType:  string;               // 'BUY_LIMIT', 'SELL_STOP', etc.
  source?:    'http' | 'broker' | 'synthetic';
  brokerId:   string;
  symbol:     string;
  direction:  'BUY' | 'SELL';
  lots:       number;
  price:      number;
  limitPrice?: number;              // StopLimit trigger price
  metadata?:  Record<string, unknown>;
  timestamp:  string;               // ISO 8601
};
```

**Step 3: Run typecheck to see what breaks**

```bash
npm run typecheck 2>&1 | head -60
```

Fix any TS errors where `OrderEvent` is constructed without the new required fields (especially in `BrokerService` and any route that already emits order events). Add `orderId: 0, orderType: 'UNKNOWN'` as safe defaults where needed for now (they will be properly populated in Task 4).

**Step 4: Run tests**

```bash
npm test 2>&1 | tail -20
```

**Step 5: Commit**

```bash
git add src/shared/services/event-map.ts
git commit -m "feat: extend OrderEvent with orderId, orderType, source, limitPrice, EXPIRED, MODIFIED"
```

---

## Task 2: Add order_events table to Drizzle schema

**Files:**
- Modify: `src/shared/db/schema.ts`

**Context:**
Existing tables: `bars`, `deals`, `auditEvents`, `accountSnapshots`.
We need an `orderEvents` Drizzle table using `pgTable`:

```typescript
export const orderEvents = pgTable('order_events', {
  id:        serial('id').primaryKey(),
  orderId:   integer('order_id').notNull(),
  action:    text('action').notNull(),            // PLACED | FILLED | CANCELLED | REJECTED | EXPIRED | MODIFIED
  orderType: text('order_type').notNull(),
  source:    text('source'),
  symbol:    text('symbol').notNull(),
  direction: text('direction').notNull(),
  lots:      real('lots').notNull(),
  price:     real('price').notNull(),
  limitPrice: real('limit_price'),
  metadata:  jsonb('metadata'),
  timestamp: text('timestamp').notNull(),         // ISO string from event
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
```

**Step 1: Read the current schema file**

```bash
cat src/shared/db/schema.ts
```

**Step 2: Add the orderEvents table** — append after the existing table definitions. Do NOT change any existing table.

**Step 3: Export the inferred type**

```typescript
export type OrderEventRow = typeof orderEvents.$inferInsert;
```

**Step 4: Run typecheck**

```bash
npm run typecheck 2>&1 | head -30
```

**Step 5: Commit**

```bash
git add src/shared/db/schema.ts
git commit -m "feat: add order_events Drizzle table to schema"
```

---

## Task 3: Implement OrderWriter service

**Files:**
- Create: `src/shared/db/order-writer.ts`
- Modify: `src/shared/db/index.ts`

**Context:**
Pattern to follow exactly: `src/shared/db/deal-writer.ts`.

`DealWriter` constructor:
```typescript
constructor(private readonly db: DrizzleDB, emitter: TypedEventBus<AppEventMap>, private readonly logger: Logger)
```
It subscribes: `emitter.on('order', (e) => this.onOrder(e))` and filters to `action === 'FILLED'` before inserting.

`OrderWriter` is identical but writes ALL actions to `order_events`.

**Step 1: Read deal-writer.ts for exact pattern**

```bash
cat src/shared/db/deal-writer.ts
```

**Step 2: Create order-writer.ts**

```typescript
import type { Logger } from 'pino';
import type { TypedEventBus } from '../event-bus.js';
import type { AppEventMap } from '../services/event-map.js';
import type { DrizzleDB } from './client.js';
import { orderEvents } from './schema.js';

export class OrderWriter {
  constructor(
    private readonly db: DrizzleDB,
    emitter: TypedEventBus<AppEventMap>,
    private readonly logger: Logger,
  ) {
    emitter.on('order', (event) => this.onOrder(event));
  }

  private onOrder(event: AppEventMap['order']): void {
    this.db
      .insert(orderEvents)
      .values({
        orderId:    event.orderId,
        action:     event.action,
        orderType:  event.orderType,
        source:     event.source ?? null,
        symbol:     event.symbol,
        direction:  event.direction,
        lots:       event.lots,
        price:      event.price,
        limitPrice: event.limitPrice ?? null,
        metadata:   event.metadata ?? null,
        timestamp:  event.timestamp,
      })
      .catch((err: unknown) => {
        this.logger.error({ err, action: event.action, orderId: event.orderId }, 'OrderWriter: insert failed');
      });
  }
}
```

**Step 3: Add export to src/shared/db/index.ts**

Open `src/shared/db/index.ts` and add:
```typescript
export { OrderWriter } from './order-writer.js';
```

**Step 4: Write a unit test** at `src/shared/db/order-writer.test.ts`

```typescript
import { describe, it, expect, vi } from 'vitest';
import { OrderWriter } from './order-writer.js';
import { TypedEventBus } from '../event-bus.js';
import type { AppEventMap } from '../services/event-map.js';

describe('OrderWriter', () => {
  it('inserts a row for every action type', async () => {
    const insertMock = { values: vi.fn().mockReturnValue(Promise.resolve()) };
    const db = { insert: vi.fn().mockReturnValue(insertMock) } as any;
    const emitter = new TypedEventBus<AppEventMap>();
    const logger = { error: vi.fn() } as any;

    new OrderWriter(db, emitter, logger);

    const event = {
      action: 'PLACED' as const,
      orderId: 42,
      orderType: 'BUY_LIMIT',
      source: 'http' as const,
      brokerId: 'paper',
      symbol: 'EURUSD',
      direction: 'BUY' as const,
      lots: 1,
      price: 1.1000,
      timestamp: new Date().toISOString(),
    };

    emitter.emit('order', event);
    await Promise.resolve(); // flush microtask

    expect(db.insert).toHaveBeenCalledOnce();
    expect(insertMock.values).toHaveBeenCalledWith(
      expect.objectContaining({ orderId: 42, action: 'PLACED' })
    );
  });

  it('logs error on DB failure without throwing', async () => {
    const insertMock = { values: vi.fn().mockReturnValue(Promise.reject(new Error('db down'))) };
    const db = { insert: vi.fn().mockReturnValue(insertMock) } as any;
    const emitter = new TypedEventBus<AppEventMap>();
    const logger = { error: vi.fn() } as any;

    new OrderWriter(db, emitter, logger);
    emitter.emit('order', {
      action: 'CANCELLED', orderId: 1, orderType: 'BUY_LIMIT',
      brokerId: 'paper', symbol: 'EURUSD', direction: 'BUY',
      lots: 1, price: 1.1, timestamp: new Date().toISOString(),
    });

    await new Promise(r => setTimeout(r, 0)); // flush
    expect(logger.error).toHaveBeenCalled();
  });
});
```

**Step 5: Run tests**

```bash
npx vitest run src/shared/db/order-writer.test.ts
```

Expected: 2 tests pass.

**Step 6: Commit**

```bash
git add src/shared/db/order-writer.ts src/shared/db/index.ts src/shared/db/order-writer.test.ts
git commit -m "feat: add OrderWriter — append-only order event ledger writer"
```

---

## Task 4: Instrument HTTP routes to emit PLACED / MODIFIED / CANCELLED

**Files:**
- Modify: `src/trading/routes/orders.ts`

**Context:**
Currently `orders.ts` calls engine methods but never emits order events. We need to:
- `POST /orders` → emit `PLACED` (after successful engine call, grab the returned ticket)
- `PATCH /orders/:id` → emit `MODIFIED`
- `DELETE /orders/:id` → emit `CANCELLED` (single)
- `DELETE /orders` (bulk cancel) → emit `CANCELLED` for each deleted order id

The route has access to `fastify.emitter` (the `TypedEventBus<AppEventMap>`).

**Step 1: Read orders.ts completely**

```bash
cat src/trading/routes/orders.ts
```

**Step 2: Identify the engine method return values**

The engine's `_addOrder()` returns the new `Order` object (which has `.ticket`, `.type`, `.direction`, `.size`, `.price`). Check what `addBuyLimit()` etc. return — if they return the order, capture it. If the route only calls `engine.addBuyLimit(price, size)` without capturing the return, add `const order = ...`.

**Step 3: Add emitter calls after each mutation**

For `POST /orders` (example pattern):
```typescript
const order = fastify.engine.addBuyLimit(body.price, body.size, body.sl, body.tp, body.comment);
fastify.emitter.emit('order', {
  action:    'PLACED',
  orderId:   order.ticket,
  orderType: body.type,        // from request body discriminant
  source:    'http',
  brokerId:  fastify.broker.id ?? 'paper',
  symbol:    fastify.symbol.name,
  direction: 'BUY',
  lots:      body.size,
  price:     body.price,
  timestamp: new Date().toISOString(),
});
```

For `PATCH /orders/:id`:
```typescript
fastify.emitter.emit('order', {
  action:    'MODIFIED',
  orderId:   params.id,
  orderType: 'UNKNOWN',   // engine doesn't expose type easily here; acceptable
  source:    'http',
  ...
});
```

For `DELETE /orders/:id`:
```typescript
fastify.emitter.emit('order', {
  action: 'CANCELLED', orderId: params.id, ...
});
```

**Step 4: Run typecheck + tests**

```bash
npm run typecheck 2>&1 | head -30
npm test 2>&1 | tail -20
```

Fix any type errors. All existing tests must still pass.

**Step 5: Commit**

```bash
git add src/trading/routes/orders.ts
git commit -m "feat: emit PLACED/MODIFIED/CANCELLED order events from HTTP routes"
```

---

## Task 5: Wire OrderWriter in app.ts

**Files:**
- Modify: `src/app.ts`

**Context:**
`DealWriter` is already wired in `app.ts` like this (look for it):
```typescript
if (db) {
  new DealWriter(db.db, app.emitter, app.log);
  new SnapshotWriter(db.db, app.emitter, app.log);
}
```

We simply add `OrderWriter` in the same block.

**Step 1: Read the relevant portion of app.ts**

```bash
grep -n "DealWriter\|SnapshotWriter\|createDatabase" src/app.ts
```

**Step 2: Import OrderWriter at top of app.ts**

Find the import that brings in `DealWriter` and add `OrderWriter` to the same import:
```typescript
import { createDatabase, DealWriter, OrderWriter, SnapshotWriter } from './shared/db/index.js';
```

**Step 3: Add OrderWriter instantiation**

In the `if (db)` block alongside `DealWriter`:
```typescript
if (db) {
  new DealWriter(db.db, app.emitter, app.log);
  new OrderWriter(db.db, app.emitter, app.log);   // ← add this line
  new SnapshotWriter(db.db, app.emitter, app.log);
}
```

**Step 4: Run typecheck + tests**

```bash
npm run typecheck 2>&1 | head -20
npm test 2>&1 | tail -20
```

**Step 5: Commit**

```bash
git add src/app.ts
git commit -m "feat: wire OrderWriter in buildApp — persists all order lifecycle events"
```

---

## Task 6: OpenBB schema + route for order history

**Files:**
- Modify: `src/integrations/openbb/schemas.ts`
- Modify: `src/integrations/openbb/routes.ts`

**Context:**
`GET /openbb/order-history` should return SSRM-paginated `order_events` rows for display in an OpenBB table widget. It follows the same pattern as `GET /openbb/deals`.

**Step 1: Read current schemas.ts and routes.ts**

```bash
cat src/integrations/openbb/schemas.ts
cat src/integrations/openbb/routes.ts
```

**Step 2: Add OpenBBOrderEventRowSchema to schemas.ts**

```typescript
export const OpenBBOrderEventRowSchema = Type.Object({
  id:        Type.Integer(),
  orderId:   Type.Integer(),
  action:    Type.String(),
  orderType: Type.String(),
  source:    Type.Union([Type.String(), Type.Null()]),
  symbol:    Type.String(),
  direction: Type.String(),
  lots:      Type.Number(),
  price:     Type.Number(),
  limitPrice: Type.Union([Type.Number(), Type.Null()]),
  timestamp: Type.String({ format: 'date-time' }),
});
```

**Step 3: Add route GET /openbb/order-history in routes.ts**

Follow the pattern of `GET /openbb/deals` exactly:

```typescript
fastify.get('/order-history', {
  schema: {
    tags: ['OpenBB'],
    summary: 'Order lifecycle history (SSRM)',
    querystring: SSRMQuerySchema,
    response: { 200: SSRMResponseSchema(OpenBBOrderEventRowSchema) },
  },
}, async (req, reply) => {
  const db = fastify.db;
  if (!db) return reply.status(503).send({ error: 'Database not configured' });

  const { startRow = 0, endRow = 100 } = req.query as SSRMQuery;
  const limit = endRow - startRow;

  const rows = await db.select().from(orderEvents)
    .orderBy(desc(orderEvents.createdAt))
    .offset(startRow)
    .limit(limit);

  const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(orderEvents);

  return reply.send({ rows, lastRow: Number(count) });
});
```

Also register the widget in `widgets.json` (the route that returns the widget manifest) — add an entry:
```json
{
  "id": "order_history",
  "name": "Order History",
  "description": "Full order lifecycle — PLACED, FILLED, CANCELLED, REJECTED, EXPIRED, MODIFIED",
  "endpoint": "/openbb/order-history",
  "gridData": { "w": 20, "h": 9 },
  "type": "table",
  "params": []
}
```

**Step 4: Check imports** — `orderEvents`, `desc`, `sql` must be imported from their packages.

**Step 5: Run typecheck + tests**

```bash
npm run typecheck 2>&1 | head -30
npm test 2>&1 | tail -20
```

**Step 6: Commit**

```bash
git add src/integrations/openbb/schemas.ts src/integrations/openbb/routes.ts
git commit -m "feat: add GET /openbb/order-history SSRM widget for order lifecycle"
```

---

## Task 7: Update OpenAPI spec

**Files:**
- Modify: `openapi.yaml`

**Context:**
Add `GET /openbb/order-history` endpoint to the spec. Follow the style of `GET /openbb/deals`.

**Step 1: Find the deals endpoint in openapi.yaml**

```bash
grep -n "order-history\|/openbb/deals" openapi.yaml
```

**Step 2: Add the endpoint**

Insert after the `GET /openbb/deals` block:

```yaml
  /openbb/order-history:
    get:
      tags:
        - OpenBB
      summary: Order lifecycle history (SSRM)
      description: |
        Returns an append-only log of every order state transition:
        `PLACED → FILLED | CANCELLED | REJECTED | EXPIRED | MODIFIED`.
        Supports AG Grid Server-Side Row Model pagination via `startRow`/`endRow`.
      operationId: getOpenBBOrderHistory
      parameters:
        - $ref: '#/components/parameters/SSRMStartRow'
        - $ref: '#/components/parameters/SSRMEndRow'
      responses:
        '200':
          description: Paginated order event rows
          content:
            application/json:
              schema:
                type: object
                properties:
                  rows:
                    type: array
                    items:
                      $ref: '#/components/schemas/OpenBBOrderEventRow'
                  lastRow:
                    type: integer
        '503':
          description: Database not configured
```

Also add `OpenBBOrderEventRow` to `components/schemas`.

**Step 3: Validate the spec is still valid YAML**

```bash
node -e "const fs = require('fs'); const yaml = require('js-yaml'); yaml.load(fs.readFileSync('openapi.yaml', 'utf8')); console.log('valid')"
```

**Step 4: Run tests + typecheck**

```bash
npm run typecheck 2>&1 | head -20
npm test 2>&1 | tail -20
```

**Step 5: Commit**

```bash
git add openapi.yaml
git commit -m "docs: add GET /openbb/order-history to OpenAPI spec"
```

---

## Final verification

```bash
npm test              # all tests pass
npm run typecheck     # zero errors
npm run build         # tsc → dist/ succeeds
npm run lint          # no new errors
```

API smoke test (with Postgres running):
```bash
DATABASE_URL=postgres://localhost/trading npm start &
# Place an order
curl -X POST localhost:3000/orders -H 'Content-Type: application/json' \
  -d '{"type":"BUY_LIMIT","price":1.1000,"size":1}'
# Check order history widget
curl 'localhost:3000/openbb/order-history?startRow=0&endRow=10'
# Expect: { rows: [{action:"PLACED", orderId:..., orderType:"BUY_LIMIT", ...}], lastRow: 1 }
```
