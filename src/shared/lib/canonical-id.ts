/**
 * Canonical ID codec — RFC 9562 v8, two-mode layout (compact / extended)
 *
 * 128-bit UUID layout:
 *
 *  Byte  0- 5 : 48-bit Unix timestamp (ms)
 *  Byte  6    : [1000][vvvv]  RFC v8 version nibble | 4-bit internal version
 *  Byte  7    : [m][bbbbbbb]  mode bit | 7-bit broker slot
 *  Byte  8    : [10][nnnnnn]  RFC variant (0b10) | nodeId high 6 bits
 *  Byte  9    : [nn][ssssss]  nodeId low 2 bits | seq high 6 bits
 *  Byte 10    : [ssssssss]    seq low 8 bits  (14-bit seq total)
 *  Byte 11    : [tttttttt]    8-bit entity type
 *  Bytes 12-15: nativeId low 32 bits (both modes)
 *               (symbolCode / strategyId are NOT encoded — sidecar only)
 */

import { ok, err, type Result } from './result.js';
import { invalidInput } from './errors.js';
import type { CanonicalIdRegistry } from './canonical-id-registry.js';

// Branded opaque type — raw string is not assignable to CanonicalId
export type CanonicalId = string & { readonly __brand: 'CanonicalId' };

// Module-level Snowflake counter (hardened in Task 4)
let _nodeId = (parseInt(process.env['INSTANCE_ID'] ?? '0', 10) || 0) & 0xff;
let _seq    = 0;
let _lastMs = 0;

export function configureNode(nodeId: number): void {
  _nodeId = nodeId & 0xff;
}

function nextSeq(nowMs: number): { seq: number; ts: number } {
  if (nowMs > _lastMs) { _seq = 0; _lastMs = nowMs; }
  else { nowMs = _lastMs; } // clock regression: hold
  const seq = (_seq++) & 0x3fff; // 14-bit max
  return { seq, ts: nowMs };
}

export function createCanonicalId(
  opts: {
    broker:       BrokerSlot;
    type:         EntityType;
    nativeId:     number | bigint;
    symbol:       string;
    strategyId?:  number;
    timestampMs?: number;
  },
  registry: CanonicalIdRegistry,
  adapter:  { idWidth: 32 | 64 },
): Result<CanonicalId, ReturnType<typeof invalidInput>> {
  // Guard: nativeId=0 is MT5's error sentinel
  if (opts.nativeId === 0 || opts.nativeId === 0n) {
    return err(invalidInput('nativeId must not be zero (broker error sentinel)', 'nativeId'));
  }

  // Guard: symbol must be registerable (throws if registry is full)
  let symCode: number;
  try {
    symCode = registry.registerSymbol(opts.symbol);
  } catch (e) {
    return err(invalidInput(`Cannot register symbol "${opts.symbol}": ${(e as Error).message}`, 'symbol'));
  }

  const { seq, ts } = nextSeq(opts.timestampMs ?? Date.now());
  const isExtended  = adapter.idWidth === 64;

  const payload: CanonicalIdPayload = isExtended
    ? {
        mode: 'extended', timestampMs: ts, broker: opts.broker, type: opts.type,
        nativeId: BigInt(opts.nativeId), nodeId: _nodeId, seq, version: 0,
      }
    : {
        mode: 'compact', timestampMs: ts, broker: opts.broker, type: opts.type,
        symbolCode: symCode, nativeId: Number(opts.nativeId),
        strategyId: opts.strategyId ?? 0, nodeId: _nodeId, seq, version: 0,
      };

  const id = encodeCanonicalId(payload) as CanonicalId;
  registry.setNativeId(id, opts.nativeId);
  return ok(id);
}

export const EntityType = {
  Order:    0x01,
  Deal:     0x02,
  Position: 0x03,
  Ticket:   0x04,
} as const;
export type EntityType = (typeof EntityType)[keyof typeof EntityType];

export const BrokerSlot = {
  Paper: 0x00,
  MT5:   0x01,
  IB:    0x02,
} as const;
export type BrokerSlot = (typeof BrokerSlot)[keyof typeof BrokerSlot];

interface BasePayload {
  timestampMs: number;
  broker:      BrokerSlot;
  type:        EntityType;
  nodeId:      number;  // 0-255 (8 bits)
  seq:         number;  // 0-16383 (14 bits)
  version:     number;  // 0-15 (4 bits)
}

export interface CompactPayload extends BasePayload {
  mode:        'compact';
  symbolCode?: number;  // 8-bit — API convenience; NOT encoded in UUID
  nativeId:    number;  // 32-bit — encoded in bytes 12-15
  strategyId?: number;  // 8-bit — API convenience; NOT encoded in UUID
}

export interface ExtendedPayload extends BasePayload {
  mode:     'extended';
  nativeId: bigint;  // low 32 bits stored in bytes 12-15; high bits in sidecar
}

export type CanonicalIdPayload = CompactPayload | ExtendedPayload;

// ---------------------------------------------------------------------------
// Encode
// ---------------------------------------------------------------------------

export function encodeCanonicalId(payload: CanonicalIdPayload): string {
  const buf = new Uint8Array(16);

  // Bytes 0-5: 48-bit timestamp
  const ts = BigInt(payload.timestampMs);
  buf[0] = Number((ts >> 40n) & 0xFFn);
  buf[1] = Number((ts >> 32n) & 0xFFn);
  buf[2] = Number((ts >> 24n) & 0xFFn);
  buf[3] = Number((ts >> 16n) & 0xFFn);
  buf[4] = Number((ts >>  8n) & 0xFFn);
  buf[5] = Number( ts         & 0xFFn);

  // Byte 6: [1000][vvvv] — RFC v8 version nibble | internal version (0-15)
  buf[6] = 0x80 | (payload.version & 0x0F);

  // Byte 7: [m][bbbbbbb] — mode bit | broker slot (7 bits)
  const modeBit = payload.mode === 'extended' ? 0x80 : 0x00;
  buf[7] = modeBit | (payload.broker & 0x7F);

  // Byte 8: [10][nnnnnn] — RFC variant | nodeId high 6 bits
  const nodeId = payload.nodeId & 0xFF;
  buf[8] = 0x80 | ((nodeId >> 2) & 0x3F);

  // Byte 9: [nn][ssssss] — nodeId low 2 bits | seq high 6 bits
  const seq = payload.seq & 0x3FFF; // 14 bits
  buf[9] = ((nodeId & 0x03) << 6) | ((seq >> 8) & 0x3F);

  // Byte 10: seq low 8 bits
  buf[10] = seq & 0xFF;

  // Byte 11: entity type
  buf[11] = payload.type & 0xFF;

  // Bytes 12-15: nativeId low 32 bits
  const nativeLow32 =
    payload.mode === 'compact'
      ? BigInt(payload.nativeId) & 0xFFFF_FFFFn
      : payload.nativeId & 0xFFFF_FFFFn;

  buf[12] = Number((nativeLow32 >> 24n) & 0xFFn);
  buf[13] = Number((nativeLow32 >> 16n) & 0xFFn);
  buf[14] = Number((nativeLow32 >>  8n) & 0xFFn);
  buf[15] = Number( nativeLow32         & 0xFFn);

  return toUuidString(buf);
}

// ---------------------------------------------------------------------------
// Decode
// ---------------------------------------------------------------------------

export function decodeCanonicalId(id: string): CanonicalIdPayload {
  const hex = id.replace(/-/g, '');
  if (hex.length !== 32) throw new Error(`Invalid canonical ID: ${id}`);

  const buf = new Uint8Array(16);
  for (let i = 0; i < 16; i++) {
    buf[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }

  // Bytes 0-5: 48-bit timestamp
  const timestampMs = Number(
    (BigInt(buf[0]) << 40n) |
    (BigInt(buf[1]) << 32n) |
    (BigInt(buf[2]) << 24n) |
    (BigInt(buf[3]) << 16n) |
    (BigInt(buf[4]) <<  8n) |
     BigInt(buf[5])
  );

  // Byte 6: [1000][vvvv]
  const version = buf[6] & 0x0F;

  // Byte 7: [m][bbbbbbb]
  const modeBit = (buf[7] >> 7) & 1;
  const broker  = (buf[7] & 0x7F) as BrokerSlot;

  // Byte 8: [10][nnnnnn] — variant | nodeId high 6
  const byte8 = buf[8];
  if ((byte8 >> 6) !== 0b10) {
    throw new Error(`Not a canonical ID — invalid RFC variant bits in byte 8: ${byte8.toString(16)}`);
  }
  const nodeIdHigh6 = byte8 & 0x3F;

  // Byte 9: [nn][ssssss] — nodeId low 2 | seq high 6
  const nodeIdLow2  = (buf[9] >> 6) & 0x03;
  const seqHigh6    = buf[9] & 0x3F;

  // Byte 10: seq low 8
  const seqLow8 = buf[10];

  const nodeId = (nodeIdHigh6 << 2) | nodeIdLow2;
  const seq    = (seqHigh6 << 8) | seqLow8;

  // Byte 11: entity type
  const type = buf[11] as EntityType;

  // Bytes 12-15: nativeId low 32 bits
  const nativeLow32 =
    (BigInt(buf[12]) << 24n) |
    (BigInt(buf[13]) << 16n) |
    (BigInt(buf[14]) <<  8n) |
     BigInt(buf[15]);

  if (modeBit === 0) {
    return {
      mode: 'compact',
      timestampMs,
      broker,
      type,
      nodeId,
      seq,
      version,
      nativeId: Number(nativeLow32),
    };
  }

  return {
    mode: 'extended',
    timestampMs,
    broker,
    type,
    nodeId,
    seq,
    version,
    nativeId: nativeLow32,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toUuidString(buf: Uint8Array): string {
  const h = Array.from(buf, b => b.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
