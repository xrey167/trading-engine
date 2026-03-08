import { describe, it, expect, beforeEach } from 'vitest';
import {
  encodeCanonicalId, decodeCanonicalId,
  EntityType, BrokerSlot,
  type CompactPayload, type ExtendedPayload,
  createCanonicalId, configureNode, type CanonicalId,
} from './canonical-id.js';
import { isOk, isErr } from './result.js';
import { CanonicalIdRegistry } from './canonical-id-registry.js';

describe('canonical-id codec', () => {
  const base: CompactPayload = {
    mode: 'compact',
    timestampMs: 1741392000000,
    broker: BrokerSlot.Paper,
    type: EntityType.Order,
    symbolCode: 0xAB,
    nativeId: 0xDEAD_BEEF,
    strategyId: 0x12,
    nodeId: 7,
    seq: 42,
    version: 0,
  };

  it('round-trips compact payload', () => {
    const id = encodeCanonicalId(base);
    const decoded = decodeCanonicalId(id);
    // symbolCode and strategyId are not encoded in the UUID (sidecar only)
    expect(decoded).toMatchObject({
      mode: base.mode,
      timestampMs: base.timestampMs,
      broker: base.broker,
      type: base.type,
      nativeId: base.nativeId,
      nodeId: base.nodeId,
      seq: base.seq,
      version: base.version,
    });
  });

  it('produces a valid UUID-shaped string', () => {
    const id = encodeCanonicalId(base);
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });

  it('sets RFC 9562 v8 version nibble (byte 6 high = 0x8)', () => {
    const id = encodeCanonicalId(base);
    const hex = id.replace(/-/g, '');
    expect(parseInt(hex[12], 16)).toBe(8);
  });

  it('sets RFC variant bits (byte 8 high 2 bits = 0b10)', () => {
    const id = encodeCanonicalId(base);
    const hex = id.replace(/-/g, '');
    const byte8 = parseInt(hex.slice(16, 18), 16);
    expect((byte8 >> 6) & 0b11).toBe(0b10);
  });

  it('round-trips extended payload', () => {
    const ext: ExtendedPayload = {
      mode: 'extended',
      timestampMs: 1741392000000,
      broker: BrokerSlot.IB,
      type: EntityType.Deal,
      nativeId: 0xDEAD_BEEFn,  // non-zero low 32 bits: 0xDEAD_BEEF
      nodeId: 0,
      seq: 0,
      version: 0,
    };
    const id = encodeCanonicalId(ext);
    const decoded = decodeCanonicalId(id);
    // Extended stores only low 32 bits in the UUID; high bits go to sidecar
    const low32 = ext.nativeId & 0xFFFF_FFFFn;
    expect(decoded).toMatchObject({
      mode: ext.mode,
      timestampMs: ext.timestampMs,
      broker: ext.broker,
      type: ext.type,
      nativeId: low32,
      nodeId: ext.nodeId,
      seq: ext.seq,
      version: ext.version,
    });
  });

  it('extended mode sets mode bit (byte 7 bit 7 = 1)', () => {
    const ext: ExtendedPayload = {
      mode: 'extended', timestampMs: Date.now(), broker: BrokerSlot.IB,
      type: EntityType.Order, nativeId: 1n, nodeId: 0, seq: 0, version: 0,
    };
    const hex = encodeCanonicalId(ext).replace(/-/g, '');
    const byte7 = parseInt(hex.slice(14, 16), 16);
    expect((byte7 >> 7) & 1).toBe(1);
  });

  it('compact mode clears mode bit (byte 7 bit 7 = 0)', () => {
    const hex = encodeCanonicalId(base).replace(/-/g, '');
    const byte7 = parseInt(hex.slice(14, 16), 16);
    expect((byte7 >> 7) & 1).toBe(0);
  });

  it('two IDs with different nativeIds are different strings', () => {
    const a = encodeCanonicalId({ ...base, nativeId: 1 });
    const b = encodeCanonicalId({ ...base, nativeId: 2 });
    expect(a).not.toBe(b);
  });

  it('round-trips nodeId=255 (max 8-bit)', () => {
    const id = encodeCanonicalId({ ...base, nodeId: 255 });
    expect(decodeCanonicalId(id)).toMatchObject({ nodeId: 255 });
  });

  it('round-trips seq=16383 (max 14-bit)', () => {
    const id = encodeCanonicalId({ ...base, seq: 16383 });
    expect(decodeCanonicalId(id)).toMatchObject({ seq: 16383 });
  });
});

describe('createCanonicalId guard', () => {
  let registry: CanonicalIdRegistry;

  beforeEach(() => {
    registry = new CanonicalIdRegistry();
    registry.registerSymbol('EURUSD');
  });

  it('returns Ok for valid compact input', () => {
    const result = createCanonicalId(
      { broker: BrokerSlot.Paper, type: EntityType.Order, nativeId: 100, symbol: 'EURUSD', strategyId: 0 },
      registry,
      { idWidth: 32 },
    );
    expect(isOk(result)).toBe(true);
  });

  it('returns Err when nativeId is 0 (number)', () => {
    const result = createCanonicalId(
      { broker: BrokerSlot.Paper, type: EntityType.Order, nativeId: 0, symbol: 'EURUSD', strategyId: 0 },
      registry,
      { idWidth: 32 },
    );
    expect(isErr(result)).toBe(true);
  });

  it('returns Err when nativeId is 0n (bigint)', () => {
    const result = createCanonicalId(
      { broker: BrokerSlot.IB, type: EntityType.Order, nativeId: 0n, symbol: 'EURUSD', strategyId: 0 },
      registry,
      { idWidth: 64 },
    );
    expect(isErr(result)).toBe(true);
  });

  it('returns Err when symbol registry is full', () => {
    // Fill the registry (EURUSD already registered as code 1, so fill codes 2-255)
    for (let i = 2; i <= 255; i++) registry.registerSymbol(`SYM${i}`);
    const result = createCanonicalId(
      { broker: BrokerSlot.Paper, type: EntityType.Order, nativeId: 1, symbol: 'OVERFLOW' },
      registry,
      { idWidth: 32 },
    );
    expect(isErr(result)).toBe(true);
  });

  it('stores nativeId in registry on success', () => {
    const result = createCanonicalId(
      { broker: BrokerSlot.Paper, type: EntityType.Order, nativeId: 42, symbol: 'EURUSD', strategyId: 0 },
      registry,
      { idWidth: 32 },
    );
    if (!isOk(result)) throw new Error('expected ok');
    expect(registry.getNativeId(result.value)).toBe(42);
  });

  it('returned value is a valid UUID string (branded CanonicalId)', () => {
    const result = createCanonicalId(
      { broker: BrokerSlot.Paper, type: EntityType.Order, nativeId: 1, symbol: 'EURUSD' },
      registry,
      { idWidth: 32 },
    );
    if (!isOk(result)) throw new Error('expected ok');
    expect(result.value).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });
});

describe('monotonicity', () => {
  it('two IDs created at same ms have different seq values', () => {
    const reg = new CanonicalIdRegistry();
    reg.registerSymbol('EURUSD');
    const ts = 1741392002000;
    const a = createCanonicalId({ broker: BrokerSlot.Paper, type: EntityType.Order, nativeId: 1, symbol: 'EURUSD', timestampMs: ts }, reg, { idWidth: 32 });
    const b = createCanonicalId({ broker: BrokerSlot.Paper, type: EntityType.Order, nativeId: 2, symbol: 'EURUSD', timestampMs: ts }, reg, { idWidth: 32 });
    if (!isOk(a) || !isOk(b)) throw new Error('expected ok');
    const da = decodeCanonicalId(a.value);
    const db = decodeCanonicalId(b.value);
    expect(db.seq).toBe(da.seq + 1);
  });

  it('IDs created at same ms sort lexicographically by seq', () => {
    const reg = new CanonicalIdRegistry();
    reg.registerSymbol('EURUSD');
    const ts = 1741392003000;
    const ids: string[] = [];
    for (let i = 1; i <= 5; i++) {
      const r = createCanonicalId({ broker: BrokerSlot.Paper, type: EntityType.Order, nativeId: i, symbol: 'EURUSD', timestampMs: ts }, reg, { idWidth: 32 });
      if (isOk(r)) ids.push(r.value);
    }
    expect(ids).toHaveLength(5);
    const sorted = [...ids].sort();
    expect(sorted).toEqual(ids);
  });

  it('does not go backward on clock regression', () => {
    const reg = new CanonicalIdRegistry();
    reg.registerSymbol('EURUSD');
    const ts = 1741392004000;
    createCanonicalId({ broker: BrokerSlot.Paper, type: EntityType.Order, nativeId: 1, symbol: 'EURUSD', timestampMs: ts }, reg, { idWidth: 32 });
    const r = createCanonicalId({ broker: BrokerSlot.Paper, type: EntityType.Order, nativeId: 2, symbol: 'EURUSD', timestampMs: ts - 5000 }, reg, { idWidth: 32 });
    if (!isOk(r)) throw new Error('expected ok');
    expect(decodeCanonicalId(r.value).timestampMs).toBeGreaterThanOrEqual(ts);
  });
});
