# trading-engine

Live trading engine ported from MQL/StereoTrader — pure TypeScript with a Fastify HTTP/WebSocket API.

## Features

- Limit, stop, and MIT order types with OCO, bracket SL/TP, pullback, and trail-entry attributes
- Per-position SL/TP, trailing stops (7 modes), and break-even logic
- Hedging and netting account modes
- Paper broker for simulation (fills, closes, account equity)
- Fastify REST API + WebSocket stream
- Full TypeBox schema validation and serialization
- **Event catalog** — 250+ `EventDefinition` records across 11 domains (economic, equity, pharma, commodity, fixed-income, crypto, news + 4 country groups); plain query functions + `ScheduledEventCalendar` with strategy-trigger predicates
- 682 tests (Vitest)

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
npm test           # 682 tests
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
  app.ts              — buildApp() factory (registers 8 module plugins)
  server.ts           — entry point (:3000)
  shared/
    domain/
      events/         — event catalog + scheduled calendar
        types.ts        — EventDefinition interface + as-const enum maps (8 domains)
        definitions.ts  — ALL_EVENTS barrel (250+ records across 11 domain files)
        catalog.ts      — getEventById, queryEvents, highImpactEvents, eventsByDomain…
        scheduled.ts    — ScheduledEvent + ScheduledEventCalendar (strategy predicates)
        economic-us.ts  — US: NFP, CPI, FOMC, GDP, ISM, retail sales…
        economic-eu.ts  — ECB rate, Eurozone CPI/GDP/PMI
        economic-gb.ts  — BoE, UK CPI/GDP/retail
        economic-jp.ts  — BoJ, Tankan, Tokyo CPI
        economic-others.ts — AU/CA/NZ/CH/CN/DE/FR + G7/G20/WW
        equity.ts       — earnings, IPO, split, index add/remove, M&A
        pharma.ts       — PDUFA, AdCom, clinical trials, FDA approval
        commodity.ts    — EIA petroleum/natgas, Baker Hughes, USDA, OPEC
        fixed-income.ts — yield curve, credit spread, treasury auction
        crypto.ts       — BTC halving, ETH upgrade, token unlock, ETF
        news.ts         — trade war, sanctions, geopolitical, flash crash
      trading-calendar.ts — TradingCalendar (trading-day arithmetic, Luxon)
      countries.ts    — exchange definitions (NYSE, LSE, etc.)
  broker/             — gateway interfaces + PaperBroker + MT5 stubs
  engine/             — Fastify plugin wrapping the core engine
  trading/            — positions, orders, scaled-orders
  market-data/        — bars ingestion, WebSocket stream, data providers
  analysis/           — ATR, strategies, backtest, screener
  managers/           — signal→risk→order execution saga
  money-management/   — SL/TP calculators, lot sizing
  integrations/       — OpenBB widgets, Agent SDK skills
  services/           — ServiceRegistry, health/start/stop routes
```

## Event Catalog

Static catalog of 250+ economic, equity, pharma, commodity, fixed-income, crypto, and news event definitions. Designed for strategy-layer filtering and scheduled-event management.

```typescript
import { queryEvents, highImpactEvents, EventDomain, EventImportance } from './src/shared/domain/events/index.js';
import { ScheduledEventCalendar } from './src/shared/domain/events/scheduled.js';
import { TradingCalendar } from './src/shared/domain/trading-calendar.js';
import { NYSE } from './src/shared/domain/countries.js';

// Static queries — no instantiation needed
const highImpact = highImpactEvents();
const usEcon = queryEvents({ domain: EventDomain.Economic, countryCode: 'US', importance: EventImportance.High });

// Scheduled calendar — compose with TradingCalendar for trading-day arithmetic
const cal = new ScheduledEventCalendar(new TradingCalendar(NYSE));
cal.add({ id: 'nfp-2025-08-01', definitionId: 'US.JOBS.NFP', date: '2025-08-01', ticker: 'EURUSD', currency: 'USD' });

cal.isEventToday(new Date('2025-08-01T14:00:00Z'), 'US.JOBS.NFP');                      // true
cal.isTradingDaysBeforeEvent(new Date('2025-07-30T14:00:00Z'), 'US.JOBS.NFP', 2);       // true (Wed→Thu→Fri)
cal.hasHighImpactEventToday(new Date('2025-08-01T14:00:00Z'), { currency: 'USD' });     // true
cal.isEventWeek(new Date('2025-07-28T14:00:00Z'), 'US.JOBS.NFP');                       // true (≤5 trading days)
```

### `ScheduledEventCalendar` predicates

| Method | Description |
|--------|-------------|
| `isEventToday(date, defId)` | `true` when the next instance falls on `date` |
| `isEventTomorrow(date, defId)` | `true` when 1 trading day away |
| `isTradingDaysBeforeEvent(date, defId, n)` | `true` when exactly `n` trading days away |
| `isEventWeek(date, defId)` | `true` when ≤5 trading days away |
| `hasHighImpactEventToday(date, opts?)` | `true` when any HIGH importance event is today (optional ticker/currency filter) |
| `tradingDaysBeforeEvent(date, defId)` | Trading days to next instance; `Infinity` if none |

## Rate limits

- `POST /orders` — 10 requests/second
- `POST /bars` — 120 requests/second
