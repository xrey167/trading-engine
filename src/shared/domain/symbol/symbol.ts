import { Type, type Static } from '@sinclair/typebox';

export const AssetType = {
  Forex:  'FOREX',
  Stock:  'STOCK',
  Future: 'FUTURE',
  Crypto: 'CRYPTO',
  Index:  'INDEX',
} as const;
export type AssetType = (typeof AssetType)[keyof typeof AssetType];

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

export const TickSchema = Type.Object({
  time:   Type.String({ format: 'date-time' }),
  bid:    Type.Number(),
  ask:    Type.Number(),
  last:   Type.Optional(Type.Number()),
  volume: Type.Optional(Type.Number()),
});
export type Tick = Static<typeof TickSchema>;

// ─────────────────────────────────────────────────────────────
// SymbolInfoBase — engine-level symbol configuration
// ─────────────────────────────────────────────────────────────

export abstract class SymbolInfoBase {
  readonly pointSize: number;
  abstract readonly assetType: AssetType;

  constructor(
    public readonly name: string,
    public readonly digits: number,
  ) {
    this.pointSize = 10 ** -digits;
  }

  priceToPoints(price: number): number  { return price / this.pointSize; }
  pointsToPrice(points: number): number { return points * this.pointSize; }
  normalize(price: number): number { return parseFloat(price.toFixed(this.digits)); }
}

export class SymbolInfoForex extends SymbolInfoBase {
  readonly assetType = AssetType.Forex;
  readonly baseCurrency: string;
  readonly quoteCurrency: string;

  constructor(name: string, digits: number) {
    super(name, digits);
    this.baseCurrency  = name.slice(0, 3).toUpperCase();
    this.quoteCurrency = name.slice(3, 6).toUpperCase();
  }
}

export class SymbolInfoStock extends SymbolInfoBase {
  readonly assetType = AssetType.Stock;

  constructor(
    name: string,
    digits: number,
    readonly exchange?: string,
  ) {
    super(name, digits);
  }
}

export class SymbolInfoFuture extends SymbolInfoBase {
  readonly assetType = AssetType.Future;

  constructor(
    name: string,
    digits: number,
    readonly contractSize: number = 1,
  ) {
    super(name, digits);
  }
}

export class SymbolInfoCrypto extends SymbolInfoBase {
  readonly assetType = AssetType.Crypto;
}

export class SymbolInfoIndex extends SymbolInfoBase {
  readonly assetType = AssetType.Index;
}

// ─────────────────────────────────────────────────────────────
// Symbol — domain class with computed behaviour
// ─────────────────────────────────────────────────────────────

export class Symbol {
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

  static fromVO(vo: SymbolInfoVO): Symbol {
    return new Symbol(
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
    return {
      name:           this.name,
      description:    this.description,
      assetType:      this.assetType,
      digits:         this.digits,
      point:          this.point,
      tickSize:       this.tickSize,
      tickValue:      this.tickValue,
      spread:         this.spread,
      spreadFloat:    this.spreadFloat,
      lotsMin:        this.lotsMin,
      lotsMax:        this.lotsMax,
      lotsStep:       this.lotsStep,
      contractSize:   this.contractSize,
      bid:            this.bid,
      ask:            this.ask,
      currencyBase:   this.currencyBase,
      currencyProfit: this.currencyProfit,
      currencyMargin: this.currencyMargin,
    };
  }
}
