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
    name: 'GET /account returns { equity, balance }',
    run: async () => {
      const res = await fetch(`${BASE}/account`);
      assert(res.ok, `/account returned ${res.status}`);
      const data = await res.json();
      assert('equity' in data, 'Missing field: equity');
      assert('balance' in data, 'Missing field: balance');
    },
  },
  {
    name: 'GET /orders returns array',
    run: async () => {
      const res = await fetch(`${BASE}/orders`);
      assert(res.ok, `/orders returned ${res.status}`);
      const data = await res.json();
      assert(Array.isArray(data), '/orders must return an array');
    },
  },
  {
    name: 'GET /positions returns array with long/short slots',
    run: async () => {
      const res = await fetch(`${BASE}/positions`);
      assert(res.ok, `/positions returned ${res.status}`);
      const data = await res.json();
      assert(Array.isArray(data), '/positions must return an array');
      assert(data.length >= 2, '/positions must have at least 2 slots (long + short)');
    },
  },
  {
    name: 'GET /openbb/positions returns array',
    run: async () => {
      const res = await fetch(`${BASE}/openbb/positions`);
      assert(res.ok, `/openbb/positions returned ${res.status}`);
      const data = await res.json();
      assert(Array.isArray(data), '/openbb/positions must return an array');
    },
  },
  {
    name: 'GET /openbb/orders returns array',
    run: async () => {
      const res = await fetch(`${BASE}/openbb/orders`);
      assert(res.ok, `/openbb/orders returned ${res.status}`);
      const data = await res.json();
      assert(Array.isArray(data), '/openbb/orders must return an array');
    },
  },
  {
    name: 'GET /openbb/account/equity returns { value, label, delta }',
    run: async () => {
      const res = await fetch(`${BASE}/openbb/account/equity`);
      assert(res.ok, `/openbb/account/equity returned ${res.status}`);
      const data = await res.json();
      assert('value' in data, 'Missing field: value');
      assert('label' in data, 'Missing field: label');
      assert('delta' in data, 'Missing field: delta');
    },
  },
  {
    name: 'GET /openbb/account/balance returns { value, label, delta }',
    run: async () => {
      const res = await fetch(`${BASE}/openbb/account/balance`);
      assert(res.ok, `/openbb/account/balance returned ${res.status}`);
      const data = await res.json();
      assert('value' in data, 'Missing field: value');
      assert('label' in data, 'Missing field: label');
      assert('delta' in data, 'Missing field: delta');
    },
  },
  {
    name: 'GET /udf/config returns supported_resolutions',
    run: async () => {
      const res = await fetch(`${BASE}/udf/config`);
      assert(res.ok, `/udf/config returned ${res.status}`);
      const data = await res.json();
      assert(Array.isArray(data.supported_resolutions), 'Missing supported_resolutions array');
      assert(data.supported_resolutions.length > 0, 'supported_resolutions must not be empty');
    },
  },
  {
    name: 'GET /openapi.yaml returns YAML content',
    run: async () => {
      const res = await fetch(`${BASE}/openapi.yaml`);
      assert(res.ok, `/openapi.yaml returned ${res.status}`);
      const ct = res.headers.get('content-type') || '';
      assert(ct.includes('yaml') || ct.includes('text'), `Unexpected content-type: ${ct}`);
    },
  },
  {
    name: 'GET /docs returns HTML',
    run: async () => {
      const res = await fetch(`${BASE}/docs`);
      assert(res.ok, `/docs returned ${res.status}`);
      const ct = res.headers.get('content-type') || '';
      assert(ct.includes('html'), `Unexpected content-type: ${ct}`);
      const text = await res.text();
      assert(text.includes('swagger-ui'), 'Expected Swagger UI in /docs HTML');
    },
  },
];

// ─── Runner ────────────────────────────────────────────────────────────────

async function run() {
  console.log(`\nValidating backend at ${BASE}\n`);
  let passed = 0;
  let failed = 0;

  for (const check of checks) {
    try {
      await check.run();
      console.log(`  PASS  ${check.name}`);
      passed++;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.log(`  FAIL  ${check.name}`);
      console.log(`        ${msg}`);
      failed++;
    }
  }

  console.log(`\n${passed} passed, ${failed} failed out of ${checks.length} checks\n`);
  process.exit(failed > 0 ? 1 : 0);
}

run();
