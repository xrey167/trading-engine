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
