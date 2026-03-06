declare const __brand: unique symbol;
type Brand<T, B> = T & { [__brand]: B };

export type Price = Brand<number, "Price">;
export type Lots = Brand<number, "Lots">;
export type Pips = Brand<number, "Pips">;
export type Ticket = Brand<number, "Ticket">;
export type UserId = Brand<string, "UserId">;
export type TradingSymbol = Brand<string, "TradingSymbol">;
export type Timeframe = Brand<number, "Timeframe">;

export type OrderDirection = "BUY" | "SELL";

export function Price(value: number): Price {
  return value as Price;
}

export function Lots(value: number): Lots {
  return value as Lots;
}

export function Pips(value: number): Pips {
  return value as Pips;
}

export function Ticket(value: number): Ticket {
  return value as Ticket;
}

export function UserId(value: string): UserId {
  return value as UserId;
}

export function TradingSymbol(value: string): TradingSymbol {
  return value as TradingSymbol;
}

export function Timeframe(value: number): Timeframe {
  return value as Timeframe;
}
