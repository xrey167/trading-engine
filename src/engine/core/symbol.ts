import { AssetType } from '../../shared/domain/symbol/symbol.js';

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
