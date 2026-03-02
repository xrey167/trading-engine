# trading-engine

Live trading engine ported from MQL/StereoTrader — pure TypeScript with a Fastify HTTP/WebSocket API.

## Features

- Limit, stop, and MIT order types with OCO, bracket SL/TP, pullback, and trail-entry attributes
- Per-position SL/TP, trailing stops (7 modes), and break-even logic
- Hedging and netting account modes
- Paper broker for simulation (fills, closes, account equity)
- Fastify REST API + WebSocket stream
- Full TypeBox schema validation and serialization
- 187 tests (Vitest)

## API

### Orders

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/orders` | List all pending orders |
| `POST` | `/orders` | Place a new order |
| `PATCH` | `/orders/:id` | Move an order to a new price |
| `DELETE` | `/orders/:id` | Cancel an order |

**POST /orders body**
```json
{
  "type": "BUY_LIMIT",
  "price": 1.09500,
  "size": 1,
  "attributes": {
    "oco": true,
    "bracketSL": 0.0050,
    "bracketTP": 0.0100,
    "limitConfirm": 1
  }
}
```
Order types: `BUY_LIMIT`, `BUY_STOP`, `SELL_LIMIT`, `SELL_STOP`, `BUY_MIT`, `SELL_MIT`

### Positions

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/positions` | Get long and short position slots |
| `DELETE` | `/positions/:side` | Close a position (`long`, `short`, `all`) |
| `PUT` | `/positions/:side/sl-tp` | Update SL/TP/trail/BE on a live position |

**PUT /positions/:side/sl-tp body** (all fields optional)
```json
{
  "sl": 20,
  "tp": 40,
  "slActive": true,
  "tpActive": false,
  "trailBeginPts": 50,
  "beActive": true,
  "beAddPts": 5
}
```

### Bars

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/bars` | Feed a bar to the engine (drives fills, trailing stops, etc.) |

**POST /bars body**
```json
{
  "bar":  { "open": 1.1, "high": 1.11, "low": 1.095, "close": 1.105, "time": "2024-01-01T00:00:00Z" },
  "bars": [ ... ]
}
```
`bar` is the current (newest) candle. `bars` is the full lookback array with `bars[0]` being the most recent.

### Account

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/account` | Get equity and balance |

### WebSocket stream

```
GET /stream  (ws://)
```

Streams JSON events to connected clients:

```json
{ "type": "bar",  "bar": { ... } }
{ "type": "fill", "side": 1, "size": 1, "price": 1.0950, "time": "...", "id": "fill-1" }
{ "type": "close","side": 1, "size": 1, "price": 1.1000, "time": "..." }
```

## Getting started

```bash
npm install
npm run build
npm start          # listens on :3000
```

```bash
npm test           # 187 tests
npm run typecheck  # tsc --noEmit
npm run lint       # biome lint
```

## Using as a library

`buildApp` accepts optional config:

```typescript
import { buildApp } from './src/app.js';

const app = await buildApp(
  { logger: true },
  { symbol: { pair: 'GBPUSD', digits: 5 }, hedging: false },
);
await app.listen({ port: 3000 });
```

## Architecture

```
trading-engine.ts     — core engine (order book, position management, trailing stops)
src/
  app.ts              — buildApp() factory
  server.ts           — entry point (:3000)
  schemas/index.ts    — TypeBox schemas for all types
  plugins/
    engine.ts         — fastify-plugin: decorates app.engine / app.symbol / app.broker
    broker.ts         — PaperBroker (simulates fills, emits events)
    rate-limit.ts     — @fastify/rate-limit (opt-in per route)
  routes/
    orders/           — GET POST PATCH DELETE /orders
    positions/        — GET DELETE PUT /positions
    bars/             — POST /bars
    account/          — GET /account
    stream/           — WebSocket GET /stream
  types/index.ts      — FastifyInstance augmentation
```

## Rate limits

- `POST /orders` — 10 requests/second
- `POST /bars` — 120 requests/second
