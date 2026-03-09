import { invalidInput, businessRule, gatewayError, type DomainError } from './errors.js';

// ─────────────────────────────────────────────────────────────
// MT5 trade server return codes  (TRADE_RETCODE_*)
// Source: MQL5 documentation, codes 10004–10044
// Note: 10005 and 10037 are intentional gaps in the MT5 spec.
// ─────────────────────────────────────────────────────────────

export const TradeRetcode = {
  Requote:            10004, // Price requoted — new price available, retry immediately
  Reject:             10006, // Request rejected by dealer
  Cancel:             10007, // Request canceled by trader
  Placed:             10008, // Order placed (async acknowledgement)
  Done:               10009, // Request completed successfully
  DonePartial:        10010, // Only part of the request was completed
  Error:              10011, // Request processing error
  Timeout:            10012, // Request canceled by timeout
  InvalidRequest:     10013, // Invalid request (general)
  InvalidVolume:      10014, // Invalid volume
  InvalidPrice:       10015, // Invalid price
  InvalidStops:       10016, // Invalid stops (SL/TP)
  TradeDisabled:      10017, // Trading disabled for the symbol
  MarketClosed:       10018, // Market is closed
  NoMoney:            10019, // Insufficient funds
  PriceChanged:       10020, // Prices changed — retry immediately
  PriceOff:           10021, // No quotes available (broker backend/liquidity issue)
  InvalidExpiration:  10022, // Invalid order expiration date
  OrderChanged:       10023, // Order state changed
  TooManyRequests:    10024, // Too many requests — back off and retry
  NoChanges:          10025, // No changes in request
  ServerDisablesAT:   10026, // Autotrading disabled by server
  ClientDisablesAT:   10027, // Autotrading disabled by client terminal
  Locked:             10028, // Request locked for processing — retry after delay
  Frozen:             10029, // Order or position frozen
  InvalidFill:        10030, // Invalid order filling type
  Connection:         10031, // No connection with the trade server
  OnlyReal:           10032, // Operation is allowed only for live accounts
  LimitOrders:        10033, // Pending order count limit reached
  LimitVolume:        10034, // Symbol volume limit reached
  InvalidOrder:       10035, // Incorrect or prohibited order type
  PositionClosed:     10036, // Position already closed
  InvalidCloseVolume: 10038, // Close volume exceeds current position volume
  CloseOrderExists:   10039, // Close order already exists for this position
  LimitPositions:     10040, // Open position count limit reached
  RejectCancel:       10041, // Pending order activation rejected — order canceled
  LongOnly:           10042, // Only long positions allowed for this symbol
  ShortOnly:          10043, // Only short positions allowed for this symbol
  CloseOnly:          10044, // Only position closing allowed for this symbol
} as const;
export type TradeRetcode = (typeof TradeRetcode)[keyof typeof TradeRetcode];

// ─────────────────────────────────────────────────────────────
// RetcodeCategory — action group for retry / error routing
// ─────────────────────────────────────────────────────────────

export const RetcodeCategory = {
  /** Order accepted or fully/partially executed. No error. */
  Success:            'success',
  /** Transient condition — retry after a short delay (requote, price drift, congestion). */
  Transient:          'transient',
  /** Request parameters are wrong — fix before retrying. */
  InvalidInput:       'invalidInput',
  /** Market or symbol state prevents execution — may clear on its own. */
  MarketCondition:    'marketCondition',
  /** Account or position limits — operator action required. */
  AccountConstraint:  'accountConstraint',
  /** Connectivity issue — reconnect then retry. */
  Connection:         'connection',
  /** Broker internal / unexpected error. */
  InternalError:      'internalError',
} as const;
export type RetcodeCategory = (typeof RetcodeCategory)[keyof typeof RetcodeCategory];

// ─────────────────────────────────────────────────────────────
// Static lookup table  code → { description, category }
// ─────────────────────────────────────────────────────────────

interface RetcodeEntry {
  readonly description: string;
  readonly category:    RetcodeCategory;
}

const RETCODE_TABLE: ReadonlyMap<number, RetcodeEntry> = new Map<number, RetcodeEntry>([
  [10004, { description: 'Requote',                                                                 category: RetcodeCategory.Transient         }],
  [10006, { description: 'Request rejected',                                                        category: RetcodeCategory.Transient         }],
  [10007, { description: 'Request canceled by trader',                                              category: RetcodeCategory.MarketCondition   }],
  [10008, { description: 'Order placed',                                                            category: RetcodeCategory.Success           }],
  [10009, { description: 'Request completed',                                                       category: RetcodeCategory.Success           }],
  [10010, { description: 'Only part of the request was completed',                                  category: RetcodeCategory.Success           }],
  [10011, { description: 'Request processing error',                                                category: RetcodeCategory.InternalError     }],
  [10012, { description: 'Request canceled by timeout',                                             category: RetcodeCategory.Connection        }],
  [10013, { description: 'Invalid request',                                                         category: RetcodeCategory.InvalidInput      }],
  [10014, { description: 'Invalid volume in the request',                                           category: RetcodeCategory.InvalidInput      }],
  [10015, { description: 'Invalid price in the request',                                            category: RetcodeCategory.InvalidInput      }],
  [10016, { description: 'Invalid stops in the request',                                            category: RetcodeCategory.InvalidInput      }],
  [10017, { description: 'Trade is disabled',                                                       category: RetcodeCategory.MarketCondition   }],
  [10018, { description: 'Market is closed',                                                        category: RetcodeCategory.MarketCondition   }],
  [10019, { description: 'There is not enough money to complete the request',                       category: RetcodeCategory.AccountConstraint }],
  [10020, { description: 'Prices changed',                                                          category: RetcodeCategory.Transient         }],
  [10021, { description: 'There are no quotes to process the request',                              category: RetcodeCategory.Transient         }],
  [10022, { description: 'Invalid order expiration date in the request',                            category: RetcodeCategory.InvalidInput      }],
  [10023, { description: 'Order state changed',                                                     category: RetcodeCategory.MarketCondition   }],
  [10024, { description: 'Too frequent requests',                                                   category: RetcodeCategory.Transient         }],
  [10025, { description: 'No changes in request',                                                   category: RetcodeCategory.InvalidInput      }],
  [10026, { description: 'Autotrading disabled by server',                                          category: RetcodeCategory.MarketCondition   }],
  [10027, { description: 'Autotrading disabled by client terminal',                                 category: RetcodeCategory.MarketCondition   }],
  [10028, { description: 'Request locked for processing',                                           category: RetcodeCategory.Transient         }],
  [10029, { description: 'Order or position frozen',                                                category: RetcodeCategory.MarketCondition   }],
  [10030, { description: 'Invalid order filling type',                                              category: RetcodeCategory.InvalidInput      }],
  [10031, { description: 'No connection with the trade server',                                     category: RetcodeCategory.Connection        }],
  [10032, { description: 'Operation is allowed only for live accounts',                             category: RetcodeCategory.AccountConstraint }],
  [10033, { description: 'The number of pending orders has reached the limit',                      category: RetcodeCategory.AccountConstraint }],
  [10034, { description: 'The volume of orders and positions for the symbol has reached the limit', category: RetcodeCategory.AccountConstraint }],
  [10035, { description: 'Incorrect or prohibited order type',                                      category: RetcodeCategory.InvalidInput      }],
  [10036, { description: 'Position with the specified POSITION_IDENTIFIER has already been closed', category: RetcodeCategory.MarketCondition   }],
  [10038, { description: 'A close volume exceeds the current position volume',                      category: RetcodeCategory.InvalidInput      }],
  [10039, { description: 'A close order already exists for a specified position',                   category: RetcodeCategory.MarketCondition   }],
  [10040, { description: 'The number of open positions has reached the server limit',               category: RetcodeCategory.AccountConstraint }],
  [10041, { description: 'Pending order activation request rejected — order canceled',              category: RetcodeCategory.MarketCondition   }],
  [10042, { description: 'Only long positions are allowed for this symbol',                         category: RetcodeCategory.MarketCondition   }],
  [10043, { description: 'Only short positions are allowed for this symbol',                        category: RetcodeCategory.MarketCondition   }],
  [10044, { description: 'Only position closing is allowed for this symbol',                        category: RetcodeCategory.MarketCondition   }],
]);

// ─────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────

/** Human-readable description for an MT5 trade retcode. */
export function retcodeDescription(code: number): string {
  return RETCODE_TABLE.get(code)?.description ?? `Unknown retcode (${code})`;
}

/** Classification category for an MT5 trade retcode. */
export function retcodeCategory(code: number): RetcodeCategory {
  return RETCODE_TABLE.get(code)?.category ?? RetcodeCategory.InternalError;
}

/** True when the retcode represents a successful or partially-successful execution. */
export function isRetcodeSuccess(code: number): boolean {
  return retcodeCategory(code) === RetcodeCategory.Success;
}

/** True when the retcode represents a transient condition that may resolve on retry. */
export function isRetcodeTransient(code: number): boolean {
  return retcodeCategory(code) === RetcodeCategory.Transient;
}

/**
 * Convert an MT5 trade retcode into the project's `DomainError` type.
 *
 * - InvalidInput   → `invalidInput()`
 * - MarketCondition / AccountConstraint → `businessRule()`
 * - Connection / Timeout / InternalError → `gatewayError()`
 * - Success / Transient → should not be called; returns `gatewayError` as a guard.
 *
 * @param code     MT5 TRADE_RETCODE_* numeric code
 * @param context  Optional extra context prepended to the message (e.g. operation name)
 */
export function retcodeToError(code: number, context?: string): DomainError {
  const entry = RETCODE_TABLE.get(code);
  const description = entry?.description ?? `Unknown retcode (${code})`;
  const message = context !== undefined ? `${context}: ${description}` : description;
  const cat = entry?.category ?? RetcodeCategory.InternalError;

  switch (cat) {
    case RetcodeCategory.InvalidInput:
      return invalidInput(message);

    case RetcodeCategory.MarketCondition:
    case RetcodeCategory.AccountConstraint:
      return businessRule(message, `RETCODE_${code}`);

    case RetcodeCategory.Connection:
    case RetcodeCategory.InternalError:
      return gatewayError(message);

    // Transient errors can legitimately reach here after retry exhaustion.
    case RetcodeCategory.Transient:
      return gatewayError(message);

    // Success codes reaching this function are a caller bug; guard defensively.
    default:
      return gatewayError(`Unexpected success retcode in error path: ${description}`);
  }
}
