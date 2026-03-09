const CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const BASE  = BigInt(62);
const CHARS_MAP = new Map<string, number>(
  Array.from(CHARS, (c, i) => [c, i] as [string, number])
);

/**
 * Encodes a 16-byte Buffer to a 22-character base62 string using alphabet [0-9A-Za-z].
 * Pads with '0' to always produce exactly 22 characters.
 */
export function base62Encode(buf: Buffer): string {
  let n = BigInt('0x' + buf.toString('hex'));
  let out = '';
  while (n > 0n) {
    out = CHARS[Number(n % BASE)] + out;
    n = n / BASE;
  }
  return out.padStart(22, '0');
}

/**
 * Decodes a 22-character base62 string back to a 16-byte Buffer.
 */
export function base62Decode(str: string): Buffer {
  let n = 0n;
  for (const c of str) {
    const idx = CHARS_MAP.get(c) ?? -1;
    if (idx < 0) throw new Error(`Invalid base62 character: "${c}"`);
    n = n * BASE + BigInt(idx);
  }
  const hex = n.toString(16).padStart(32, '0');
  return Buffer.from(hex, 'hex');
}
