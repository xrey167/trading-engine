export abstract class BaseCalculator {
  protected constructor(protected readonly direction: 'BUY' | 'SELL') {}
  protected isLong(): boolean { return this.direction === 'BUY'; }
}
