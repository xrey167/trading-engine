import { describe, it, expect } from 'vitest';
import { base62Encode, base62Decode } from './base62.js';

describe('base62', () => {
  it('encodes a 16-byte buffer to a 22-char string', () => {
    const buf = Buffer.alloc(16, 0xab);
    expect(base62Encode(buf)).toHaveLength(22);
  });

  it('round-trips a known buffer', () => {
    const buf = Buffer.from('deadbeefcafebabe0102030405060708', 'hex');
    expect(base62Decode(base62Encode(buf)).toString('hex')).toBe(buf.toString('hex'));
  });

  it('uses only [0-9A-Za-z] characters', () => {
    const buf = Buffer.from('ffffffffffffffffffffffffffffffff', 'hex');
    expect(base62Encode(buf)).toMatch(/^[0-9A-Za-z]+$/);
  });

  it('throws on invalid base62 character', () => {
    expect(() => base62Decode('!')).toThrow(/invalid/i);
  });

  it('all-zero buffer encodes to all-zero string', () => {
    const buf = Buffer.alloc(16, 0);
    expect(base62Encode(buf)).toBe('0000000000000000000000');
  });
});
