#!/usr/bin/env npx tsx
/**
 * Backend API contract validator.
 * Usage: npx tsx scripts/validate-backend.ts [base-url]
 * Default base-url: http://localhost:3000
 */

const BASE = process.argv[2] || 'http://localhost:3000';

function assert(condition: boolean, msg: string): asserts condition {
  if (!condition) throw new Error(msg);
}

interface Check {
  name: string;
  run: () => Promise<void>;
}

const checks: Check[] = [
  {
    name: 'GET /widgets.json returns object with widget entries',
    run: async () => {
      const res = await fetch(`${BASE}/widgets.json`);
      assert(res.ok, `widgets.json returned ${res.status}`);
      const data = await res.json();
      assert(typeof data === 'object' && data !== null, 'widgets.json must be an object');
      for (const key of ['engine_positions', 'pending_orders', 'account_equity']) {
        assert(key in data, `Missing widget: ${key}`);
      }
    },
  },
  {
    name: 'GET /apps.json returns object with app entries',
    run: async () => {
      const res = await fetch(`${BASE}/apps.json`);
      assert(res.ok, `apps.json returned ${res.status}`);
      const data = await res.json();
      assert(typeof data === 'object' && data !== null, 'apps.json must be an object');
      assert('trading_dashboard' in data, 'Missing app: trading_dashboard');
    },
  },
  {
    name: 'GET /openbb/positions returns array',
    run: async () => {
      const res = await fetch(`${BASE}/openbb/positions`);
      assert(res.ok, `positions returned ${res.status}`);
      const data = await res.json();
      assert(Array.isArray(data), 'positions must be an array');
    },
  },
  {
    name: 'GET /openbb/orders returns array',
    run: async () => {
      const res = await fetch(`${BASE}/openbb/orders`);
      assert(res.ok, `orders returned ${res.status}`);
      const data = await res.json();
      assert(Array.isArray(data), 'orders must be an array');
    },
  },
  {
    name: 'GET /openbb/account/equity returns metric',
    run: async () => {
      const res = await fetch(`${BASE}/openbb/account/equity`);
      assert(res.ok, `equity returned ${res.status}`);
      const data = await res.json();
      assert('value' in data && 'label' in data, 'equity must have value and label');
    },
  },
  {
    name: 'GET /openbb/account/balance returns metric',
    run: async () => {
      const res = await fetch(`${BASE}/openbb/account/balance`);
      assert(res.ok, `balance returned ${res.status}`);
      const data = await res.json();
      assert('value' in data && 'label' in data, 'balance must have value and label');
    },
  },
  {
    name: 'GET /openbb/deals returns array',
    run: async () => {
      const res = await fetch(`${BASE}/openbb/deals`);
      assert(res.ok, `deals returned ${res.status}`);
      const data = await res.json();
      assert(Array.isArray(data), 'deals must be an array');
    },
  },
  {
    name: 'GET /openbb/engine-config returns omni content',
    run: async () => {
      const res = await fetch(`${BASE}/openbb/engine-config`);
      assert(res.ok, `engine-config returned ${res.status}`);
      const data = await res.json();
      assert(Array.isArray(data), 'engine-config must be an array');
      assert(data.length > 0, 'engine-config must have at least one block');
    },
  },
  {
    name: 'GET /openbb/positions?startRow=0&endRow=1 returns SSRM envelope',
    run: async () => {
      const res = await fetch(`${BASE}/openbb/positions?startRow=0&endRow=1`);
      assert(res.ok, `SSRM positions returned ${res.status}`);
      const data = await res.json();
      assert('rows' in data && 'lastRow' in data, 'SSRM response must have rows and lastRow');
    },
  },
  {
    name: 'GET /udf/config returns UDF capabilities',
    run: async () => {
      const res = await fetch(`${BASE}/udf/config`);
      assert(res.ok, `udf/config returned ${res.status}`);
      const data = await res.json();
      assert('supported_resolutions' in data, 'UDF config must have supported_resolutions');
    },
  },
  {
    name: 'GET /udf/time returns Unix timestamp',
    run: async () => {
      const res = await fetch(`${BASE}/udf/time`);
      assert(res.ok, `udf/time returned ${res.status}`);
      const ts = Number(await res.text());
      assert(!Number.isNaN(ts) && ts > 0, 'udf/time must return a valid Unix timestamp');
    },
  },
  {
    name: 'Cache-Control headers are set correctly',
    run: async () => {
      const widgets = await fetch(`${BASE}/widgets.json`);
      assert(
        widgets.headers.get('cache-control')?.includes('max-age=3600') === true,
        'widgets.json must have max-age=3600',
      );
      const positions = await fetch(`${BASE}/openbb/positions`);
      assert(
        positions.headers.get('cache-control') === 'no-store',
        'positions must have no-store',
      );
    },
  },
];

async function main() {
  console.log(`\nValidating backend at ${BASE}\n`);
  let passed = 0;
  let failed = 0;

  for (const check of checks) {
    try {
      await check.run();
      console.log(`  ✓ ${check.name}`);
      passed++;
    } catch (err) {
      console.log(`  ✗ ${check.name}`);
      console.log(`    ${(err as Error).message}`);
      failed++;
    }
  }

  console.log(`\n${passed} passed, ${failed} failed out of ${checks.length} checks\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main();
