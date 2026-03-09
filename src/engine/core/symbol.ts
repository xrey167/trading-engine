// Re-exports — definitions now live in shared/domain/symbol/symbol.ts.
// All existing import paths (from engine, trading, broker layers) remain valid.
export {
  SymbolInfoBase,
  SymbolInfoForex,
  SymbolInfoStock,
  SymbolInfoFuture,
  SymbolInfoCrypto,
  SymbolInfoIndex,
} from '../../shared/domain/symbol/symbol.js';
