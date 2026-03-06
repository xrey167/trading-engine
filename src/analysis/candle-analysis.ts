import { Candle } from '../../trading-engine.js';

export function isBullish(c: Candle): boolean { return c.isBullish(); }
export function isBearish(c: Candle): boolean { return c.isBearish(); }
export function range(c: Candle): number { return c.range(); }
export function wickPart(c: Candle): number { return c.wickPart(); }
export function tailPart(c: Candle): number { return c.tailPart(); }
export function bodyRange(c: Candle): number { return c.bodyRange(); }
