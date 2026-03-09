export const NO_STRATEGY = 0x00;

// Local branded alias — mirrors CanonicalId from codec.ts without creating a circular import.
type CanonicalId = string & { readonly __brand: 'CanonicalId' };

export class CanonicalIdRegistry {
  private readonly symbols  = new Map<string, number>();
  private readonly symCodes = new Map<number, string>();
  private symNext = 1; // 0 reserved for "unknown"

  private readonly strategies  = new Map<string, number>();
  private readonly stratCodes  = new Map<number, string>();
  private stratNext = 1; // 0 = NO_STRATEGY

  private readonly nativeIds    = new Map<string, number | bigint>();
  private readonly canonicalIds = new Map<number | bigint, CanonicalId>();

  registerSymbol(pair: string): number {
    if (!pair) throw new Error('Symbol name must not be empty');
    const existing = this.symbols.get(pair);
    if (existing !== undefined) return existing;
    if (this.symNext > 255) throw new Error(`Symbol registry full (255 limit): ${pair}`);
    const code = this.symNext++;
    this.symbols.set(pair, code);
    this.symCodes.set(code, pair);
    return code;
  }

  lookupSymbol(code: number): string {
    const sym = this.symCodes.get(code);
    if (sym === undefined) throw new Error(`Unknown symbol code: ${code}`);
    return sym;
  }

  registerStrategy(id: string): number {
    if (!id) throw new Error('Strategy id must not be empty');
    const existing = this.strategies.get(id);
    if (existing !== undefined) return existing;
    if (this.stratNext > 255) throw new Error(`Strategy registry full (255 limit): ${id}`);
    const code = this.stratNext++;
    this.strategies.set(id, code);
    this.stratCodes.set(code, id);
    return code;
  }

  /**
   * Returns the strategy name for the given code, or `undefined` for code 0 (NO_STRATEGY)
   * or any unregistered code. Does NOT throw — unlike `lookupSymbol`.
   */
  lookupStrategy(code: number): string | undefined {
    return this.stratCodes.get(code);
  }

  setNativeId(canonicalId: string, nativeId: number | bigint): void {
    this.nativeIds.set(canonicalId, nativeId);
    this.canonicalIds.set(nativeId, canonicalId as CanonicalId);
  }

  getNativeId(canonicalId: string): number | bigint | undefined {
    return this.nativeIds.get(canonicalId);
  }

  /**
   * Returns the canonical ID for a given native broker ticket, or `undefined` if
   * this ticket was never registered (e.g. historical entities pre-dating this system).
   */
  getCanonicalId(nativeId: number | bigint): CanonicalId | undefined {
    return this.canonicalIds.get(nativeId);
  }
}
