import { Type, type Static } from '@sinclair/typebox';
import { AssetType } from './symbol-info.js';

// Re-export so all existing `symbol/symbol.js` importers keep working.
export { AssetType } from './symbol-info.js';
export {
  SymbolInfoBase, SymbolInfoForex, SymbolInfoStock,
  SymbolInfoFuture, SymbolInfoCrypto, SymbolInfoIndex,
} from './symbol-info.js';

// ─────────────────────────────────────────────────────────────
// SymbolInfoVO — serialization / API boundary
// ─────────────────────────────────────────────────────────────

const AssetTypeSchema = Type.Union(Object.values(AssetType).map(v => Type.Literal(v)));

export const SymbolInfoVOSchema = Type.Object({
  name:             Type.String(),
  description:      Type.String(),
  assetType:        AssetTypeSchema,
  digits:           Type.Integer(),
  point:            Type.Number(),
  tickSize:         Type.Number(),
  tickValue:        Type.Number(),
  spread:           Type.Integer(),
  spreadFloat:      Type.Boolean(),
  lotsMin:          Type.Number(),
  lotsMax:          Type.Number(),
  lotsStep:         Type.Number(),
  contractSize:     Type.Number(),
  bid:              Type.Number(),
  ask:              Type.Number(),
  currencyBase:     Type.String(),
  currencyProfit:   Type.String(),
  currencyMargin:   Type.String(),
});
export type SymbolInfoVO = Static<typeof SymbolInfoVOSchema>;

export const SymbolInfoVOFactory = {
  make(overrides: Partial<SymbolInfoVO> & Pick<SymbolInfoVO, 'name'>): SymbolInfoVO {
    const defaults: SymbolInfoVO = {
      name:           overrides.name,
      description:    '',
      assetType:      AssetType.Forex,
      digits:         5,
      point:          0.00001,
      tickSize:       0.00001,
      tickValue:      1,
      spread:         0,
      spreadFloat:    true,
      lotsMin:        0.01,
      lotsMax:        100,
      lotsStep:       0.01,
      contractSize:   100_000,
      bid:            0,
      ask:            0,
      currencyBase:   '',
      currencyProfit: '',
      currencyMargin: '',
    };
    return { ...defaults, ...overrides };
  },
};

// ─────────────────────────────────────────────────────────────
// Tick
// ─────────────────────────────────────────────────────────────

export const TickSchema = Type.Object({
  time:   Type.String({ format: 'date-time' }),
  bid:    Type.Number(),
  ask:    Type.Number(),
  last:   Type.Optional(Type.Number()),
  volume: Type.Optional(Type.Number()),
});
export type Tick = Static<typeof TickSchema>;

// ─────────────────────────────────────────────────────────────
// TradingSymbol — domain class with computed behaviour
// ─────────────────────────────────────────────────────────────

export class TradingSymbol {
  constructor(
    public readonly name:           string,
    public readonly description:    string,
    public readonly assetType:      AssetType,
    public readonly digits:         number,
    public readonly point:          number,
    public readonly tickSize:       number,
    public readonly tickValue:      number,
    public readonly spread:         number,
    public readonly spreadFloat:    boolean,
    public readonly lotsMin:        number,
    public readonly lotsMax:        number,
    public readonly lotsStep:       number,
    public readonly contractSize:   number,
    public readonly bid:            number,
    public readonly ask:            number,
    public readonly currencyBase:   string,
    public readonly currencyProfit: string,
    public readonly currencyMargin: string,
  ) {}

  // ── Asset type predicates ─────────────────────────────────

  isForex():  boolean { return this.assetType === AssetType.Forex;  }
  isStock():  boolean { return this.assetType === AssetType.Stock;  }
  isFuture(): boolean { return this.assetType === AssetType.Future; }
  isCrypto(): boolean { return this.assetType === AssetType.Crypto; }
  isIndex():  boolean { return this.assetType === AssetType.Index;  }

  // ── Market data ───────────────────────────────────────────

  /** Midpoint of bid/ask. */
  mid(): number { return (this.bid + this.ask) / 2; }

  /** Current bid/ask spread expressed in points (integer). */
  spreadPts(): number { return Math.round((this.ask - this.bid) / this.point); }

  // ── Conversion ───────────────────────────────────────────

  static fromVO(vo: SymbolInfoVO): TradingSymbol {
    return new TradingSymbol(
      vo.name, vo.description, vo.assetType,
      vo.digits, vo.point,
      vo.tickSize, vo.tickValue,
      vo.spread, vo.spreadFloat,
      vo.lotsMin, vo.lotsMax, vo.lotsStep,
      vo.contractSize,
      vo.bid, vo.ask,
      vo.currencyBase, vo.currencyProfit, vo.currencyMargin,
    );
  }

  toVO(): SymbolInfoVO {
    return { ...this };
  }
}
