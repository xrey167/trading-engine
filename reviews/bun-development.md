# Bun Development Review -- Trading Engine

**Reviewer:** reviewer-3 (bun-development skill)
**Date:** 2026-03-07
**Branch:** `review/bun-development`

---

## Executive Summary

The trading engine codebase is **well-positioned for a Bun migration** with minimal blockers. The project already uses ESM (`"type": "module"`), TypeScript with `moduleResolution: "bundler"`, and standard Node.js APIs that Bun supports natively. The primary friction point is the Fastify framework, which works on Bun but does not leverage Bun's native HTTP server performance. A phased migration is recommended: start with Bun as a drop-in runtime replacement (Phase 1), then progressively adopt Bun-native APIs (Phase 2), and optionally migrate the HTTP layer to Elysia or Bun.serve for maximum throughput (Phase 3).

**Migration difficulty:** Low-Medium
**Estimated blockers:** 0 hard blockers, 2 soft blockers (WebSocket library, test runner migration)

---

## Migration Feasibility Assessment

### Compatible Areas (No Changes Required)

| Area | Status | Notes |
|:-----|:-------|:------|
| ESM imports with `.js` extensions | Compatible | Bun resolves `.js` to `.ts` natively |
| `as const` enum pattern | Compatible | Pure TypeScript, runtime-agnostic |
| `node:fs`, `node:path`, `node:url` | Compatible | Bun implements these Node.js built-ins |
| `node:events` (EventEmitter) | Compatible | Fully supported in Bun |
| `node:crypto` (timingSafeEqual) | Compatible | Bun implements `node:crypto` |
| `process.env` access | Compatible | Bun supports `process.env` + auto-loads `.env` |
| `setInterval` / `clearInterval` | Compatible | Standard Web API, works in Bun |
| TypeBox schemas | Compatible | Pure TypeScript library |
| `@sinclair/typebox` | Compatible | No native dependencies |
| biome linter | Compatible | Standalone binary, runtime-independent |

### Soft Blockers (Require Testing/Adaptation)

| Area | Risk | Detail |
|:-----|:-----|:-------|
| `@fastify/websocket` (uses `ws`) | Medium | `ws` relies on optional native addons (`bufferutil`, `utf-8-validate`). Bun has native WebSocket support but `ws` compatibility layer may have edge cases. See [Finding F1](#f1-fastifywebsocket-depends-on-ws). |
| Vitest test runner | Low | Bun has its own test runner (`bun:test`). Vitest works on Bun but is slower than native. Migration of 663+ tests requires effort. See [Finding F4](#f4-vitest-to-buntest-migration). |

### No Hard Blockers Found

- No `child_process`, `worker_threads`, `cluster`, or `dgram` usage
- No native C++ addons in project dependencies (only in devDependencies via Rollup/fsevents)
- No `require()` calls -- pure ESM
- No `process.hrtime()` or `setImmediate()` usage

---

## Fastify Compatibility with Bun

Fastify v5 runs on Bun, but with caveats:

1. **Performance ceiling:** Fastify on Bun still uses Node.js HTTP compat layer internally. Bun.serve() is 4-10x faster for raw HTTP throughput. The trading engine's latency-sensitive nature (order fills, position monitoring) means this overhead matters.

2. **Plugin ecosystem:** All current plugins are compatible:
   - `@fastify/cors` -- works on Bun
   - `@fastify/rate-limit` -- works on Bun
   - `@fastify/websocket` -- works but see [F1](#f1-fastifywebsocket-depends-on-ws)
   - `fastify-plugin` -- works on Bun

3. **Recommendation:** Keep Fastify in Phase 1. Consider Elysia (Bun-native framework) only if benchmarks show HTTP layer is a bottleneck in production.

---

## Performance Opportunities

### P1: Native TypeScript Execution (High Impact)

Current flow: `tsc` compile -> `node dist/src/server.js`
Bun flow: `bun run src/server.ts` (no build step for development)

- Eliminates `npm run build` step entirely for dev
- Startup time improvement: ~100ms (Node) -> ~25ms (Bun)
- `--watch` mode is built-in: `bun --watch run src/server.ts`

### P2: Package Installation Speed (Medium Impact)

`bun install` is 10-100x faster than `npm install`. With 6 dependencies + 4 devDependencies, install time drops from seconds to milliseconds.

### P3: Bun.file() for OpenAPI Spec Loading (Low Impact)

`src/app.ts:115-116` uses `readFileSync` to load `openapi.yaml`. Bun.file() is faster for file I/O:

```typescript
// Current
const specContent = readFileSync(specPath, 'utf8');

// Bun-native (async, faster)
const specContent = await Bun.file(specPath).text();
```

### P4: Native WebSocket Server (High Impact)

Replace `@fastify/websocket` + `ws` with Bun's native WebSocket support. Bun's WebSocket server handles significantly more concurrent connections with lower memory overhead. Critical for the `/stream` endpoint that broadcasts fill/close events to all connected clients.

### P5: Built-in SQLite (Future Opportunity)

If the engine ever needs local persistence (trade history, backtest results), `bun:sqlite` is built-in and faster than any npm SQLite package.

### P6: Compile to Standalone Executable (Medium Impact)

```bash
bun build ./src/server.ts --compile --outfile trading-engine
```

Produces a single binary with no runtime dependencies -- ideal for containerized deployment of the trading engine.

---

## Node.js-Specific APIs That Would Need Attention

### <a id="f1-fastifywebsocket-depends-on-ws"></a>F1: @fastify/websocket depends on `ws`

**File:** `src/routes/stream/index.ts:2`
```typescript
import { WebSocket } from '@fastify/websocket';
```

The `ws` library uses optional native addons. Bun has its own WebSocket implementation. While `ws` generally works on Bun, the `readyState` constant comparison at line 10 (`socket.readyState === WebSocket.OPEN`) should be tested.

**Recommendation:** Test thoroughly. If issues arise, migrate `/stream` to use Bun's native WebSocket via `Bun.serve({ websocket: ... })`.

### F2: `fileURLToPath` + `import.meta.url` pattern

**File:** `src/app.ts:113`
```typescript
const __dirname = dirname(fileURLToPath(import.meta.url));
```

Bun supports `import.meta.url` and `fileURLToPath`, but also provides `import.meta.dir` as a direct replacement for `__dirname`. This is a minor optimization, not a blocker.

### F3: `timingSafeEqual` from `node:crypto`

**File:** `src/routes/openbb/index.ts:1`
```typescript
import { timingSafeEqual } from 'node:crypto';
```

Bun implements `node:crypto` including `timingSafeEqual`. No changes needed.

### <a id="f4-vitest-to-buntest-migration"></a>F4: Vitest to `bun:test` Migration

**Current:** 663+ tests using Vitest (`vitest run`)
**Bun equivalent:** `bun test` with `bun:test` imports

The test APIs are nearly identical (`describe`, `it`, `expect`, `beforeAll`, `afterAll`), but the import source changes:

```typescript
// Vitest
import { describe, it, expect } from 'vitest';

// Bun
import { describe, it, expect } from 'bun:test';
```

**Risk:** Some Vitest-specific matchers or features (e.g., `vi.fn()` -> `mock()`, `vi.spyOn()` -> `spyOn()`) require manual conversion.

**Recommendation:** Keep Vitest initially (it works on Bun). Migrate tests to `bun:test` only when Vitest becomes a bottleneck.

---

## Migration Roadmap

### Phase 1: Drop-in Runtime Replacement (1-2 days)

1. Install Bun: `curl -fsSL https://bun.sh/install | bash`
2. Replace `node_modules` and lockfile:
   ```bash
   rm -rf node_modules package-lock.json
   bun install
   ```
3. Update `package.json` scripts:
   ```json
   {
     "scripts": {
       "dev": "bun --watch run src/server.ts",
       "start": "bun run src/server.ts",
       "test": "vitest run",
       "typecheck": "bunx tsc --noEmit",
       "lint": "bunx biome lint .",
       "build": "bun build ./src/server.ts --outdir ./dist --target bun"
     }
   }
   ```
4. Add `@types/bun` as devDependency
5. Run all 663 tests with `bun run vitest run` -- expect full pass
6. Test WebSocket `/stream` endpoint manually

### Phase 2: Adopt Bun-Native APIs (3-5 days)

1. Replace `readFileSync` with `Bun.file()` in `src/app.ts`
2. Replace `import.meta.url` + `fileURLToPath` with `import.meta.dir`
3. Add `.env` file support (automatic in Bun, remove any dotenv if present)
4. Evaluate `bun build --compile` for production deployment
5. Benchmark Fastify on Bun vs Bun.serve() for the specific route patterns

### Phase 3: Optional Full Migration (1-2 weeks)

1. Migrate `/stream` WebSocket to Bun's native WebSocket server
2. Migrate test suite from Vitest to `bun:test` (663+ tests)
3. Consider replacing Fastify with Elysia if benchmarks justify it
4. Set up Bun-native CI/CD pipeline

---

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|:-----|:------------|:-------|:-----------|
| `ws` WebSocket incompatibility on Bun | Low | High | Test `/stream` endpoint thoroughly; fallback to Bun native WS |
| Fastify plugin ecosystem edge cases | Low | Medium | Phase 1 testing catches these early; Fastify team actively tests Bun compat |
| Vitest performance regression on Bun | Low | Low | Keep Vitest initially; migrate to `bun:test` later |
| Bun runtime stability for long-running processes | Low-Medium | High | The trading engine runs continuously; test with extended uptime before production |
| Team familiarity with Bun APIs | Medium | Low | Bun's Node.js compat means existing knowledge transfers; new APIs are opt-in |

---

## Specific Findings

| ID | File | Line | Finding | Severity |
|:---|:-----|:-----|:--------|:---------|
| F1 | `src/routes/stream/index.ts` | 2, 10 | `@fastify/websocket` uses `ws` library; test `readyState` constant on Bun | Medium |
| F2 | `src/app.ts` | 113 | `fileURLToPath(import.meta.url)` can be replaced with `import.meta.dir` | Low |
| F3 | `src/routes/openbb/index.ts` | 1 | `timingSafeEqual` from `node:crypto` -- works on Bun, no action needed | Info |
| F4 | `trading-engine.test.ts`, `src/**/*.test.ts` | -- | 663+ Vitest tests would need import changes for `bun:test` migration | Low |
| F5 | `package.json` | 9-16 | All npm scripts use `node`/`tsc` -- update to `bun` equivalents | Low |
| F6 | `src/server.ts` | 1-5 | Top-level `await` works natively in Bun (no flag needed) | Info |
| F7 | `src/plugins/broker.ts` | 1, 51 | `EventEmitter` from `node:events` -- fully supported in Bun | Info |
| F8 | `tsconfig.json` | 5 | `moduleResolution: "bundler"` already Bun-compatible | Info |

---

## Prioritized Recommendations

### High Priority

1. **Run existing test suite under Bun** -- Execute `bun run vitest run` to validate compatibility before any code changes. This is the fastest way to surface hidden incompatibilities.

2. **Benchmark WebSocket throughput** -- The `/stream` endpoint is latency-critical for live trading. Compare `ws` on Bun vs Bun's native WebSocket for concurrent connection handling and message latency.

3. **Test long-running stability** -- The trading engine runs as a persistent process. Run a 24-hour soak test under Bun to verify memory stability and EventEmitter performance.

### Medium Priority

4. **Replace `node` with `bun` in dev scripts** -- Eliminates the `tsc` build step for development, reducing iteration time from ~3s to instant.

5. **Evaluate `bun build --compile`** -- A single-binary deployment simplifies Docker images and reduces container startup time.

6. **Add `@types/bun`** -- Provides type definitions for Bun-specific APIs like `Bun.file()`, `Bun.serve()`, `Bun.env`.

### Low Priority

7. **Migrate Vitest to `bun:test`** -- Only worthwhile if test execution time is a concern. Vitest works fine on Bun.

8. **Replace `readFileSync` with `Bun.file()`** -- Minor performance gain for OpenAPI spec loading at startup.

9. **Consider Elysia migration** -- Only if Fastify becomes the proven bottleneck in production load testing.
