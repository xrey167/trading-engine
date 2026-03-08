import { describe, it, expect } from 'vitest';
import {
  encodeCanonicalId, decodeCanonicalId,
  EntityType, BrokerSlot,
  type CompactPayload, type ExtendedPayload,
} from './canonical-id.js';

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
