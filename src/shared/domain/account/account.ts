import { Type, type Static } from '@sinclair/typebox';
import { enumSchema } from '../../schemas/common.js';

export const AccountType = { Demo: 0, Contest: 1, Real: 2 } as const;
export type AccountType = (typeof AccountType)[keyof typeof AccountType];

export const AccountTradeMode = {
  SingleHedge:   'SINGLE_HEDGE',   // single position per symbol, hedging allowed
  SingleNoHedge: 'SINGLE_NOHEDGE', // single position per symbol, no hedging (netting)
  Future:        'FUTURE',         // futures-style: both sides allowed, margined separately
  Hedge:         'HEDGE',          // full hedge: independent long & short tickets per symbol
} as const;
export type AccountTradeMode = (typeof AccountTradeMode)[keyof typeof AccountTradeMode];

export const AccountMarginMode = { Retail: 0, Exchange: 2 } as const;
export type AccountMarginMode = (typeof AccountMarginMode)[keyof typeof AccountMarginMode];

export const AccountStopoutMode = {
  Percent: 0,  // ACCOUNT_STOPOUT_MODE_PERCENT — stop-out level as a percentage
  Money:   1,  // ACCOUNT_STOPOUT_MODE_MONEY   — stop-out level as absolute money
} as const;
export type AccountStopoutMode = (typeof AccountStopoutMode)[keyof typeof AccountStopoutMode];

export const AccountInfoVOSchema = Type.Object({
  login:                 Type.Number(),
  accountType:           enumSchema(AccountType),
  tradeMode:             enumSchema(AccountTradeMode),
  leverage:              Type.Number(),
  marginMode:            enumSchema(AccountMarginMode),
  stopOutMode:           enumSchema(AccountStopoutMode),
  marginSoMode:          Type.Number(),
  tradeAllowed:          Type.Boolean(),
  tradeExpertAllowed:    Type.Boolean(),
  limitOrders:           Type.Number(),
  balance:               Type.Number(),
  credit:                Type.Number(),
  profit:                Type.Number(),
  equity:                Type.Number(),
  margin:                Type.Number(),
  freeMargin:            Type.Number(),
  marginLevel:           Type.Number(),
  marginInitial:         Type.Number(),
  marginMaintenance:     Type.Number(),
  assets:                Type.Number(),
  liabilities:           Type.Number(),
  commission:            Type.Number(),
  currency:              Type.String(),
  name:                  Type.String(),
  server:                Type.String(),
  company:               Type.String(),
});
export type AccountInfoVO = Static<typeof AccountInfoVOSchema>;

// ─────────────────────────────────────────────────────────────
// AccountVOFactory — test / default VO builder
// ─────────────────────────────────────────────────────────────

export const AccountVOFactory = {
  make(overrides: Partial<AccountInfoVO> = {}): AccountInfoVO {
    return {
      login:              0,
      accountType:        AccountType.Real,
      tradeMode:          AccountTradeMode.Hedge,
      leverage:           100,
      marginMode:         AccountMarginMode.Retail,
      stopOutMode:        AccountStopoutMode.Percent,
      marginSoMode:       0,
      tradeAllowed:       true,
      tradeExpertAllowed: true,
      limitOrders:        200,
      balance:            10_000,
      credit:             0,
      profit:             0,
      equity:             10_000,
      margin:             0,
      freeMargin:         10_000,
      marginLevel:        0,
      marginInitial:      0,
      marginMaintenance:  0,
      assets:             0,
      liabilities:        0,
      commission:         0,
      currency:           'USD',
      name:               'Test Account',
      server:             'Test-Server',
      company:            'Test Broker',
      ...overrides,
    };
  },
};

// ─────────────────────────────────────────────────────────────
// Account — domain class with computed behaviour
// ─────────────────────────────────────────────────────────────

export class Account {
  constructor(
    public readonly login:              number,
    public readonly accountType:        AccountType,
    public readonly tradeMode:          AccountTradeMode,
    public readonly leverage:           number,
    public readonly marginMode:         AccountMarginMode,
    public readonly stopOutMode:        AccountStopoutMode,
    public readonly marginSoMode:       number,
    public readonly tradeAllowed:       boolean,
    public readonly tradeExpertAllowed: boolean,
    public readonly limitOrders:        number,
    public readonly balance:            number,
    public readonly credit:             number,
    public readonly profit:             number,
    public readonly equity:             number,
    public readonly margin:             number,
    public readonly freeMargin:         number,
    public readonly marginLevel:        number,
    public readonly marginInitial:      number,
    public readonly marginMaintenance:  number,
    public readonly assets:             number,
    public readonly liabilities:        number,
    public readonly commission:         number,
    public readonly currency:           string,
    public readonly name:               string,
    public readonly server:             string,
    public readonly company:            string,
  ) {}

  // ── Account type predicates ───────────────────────────────

  isReal():    boolean { return this.accountType === AccountType.Real; }
  isDemo():    boolean { return this.accountType === AccountType.Demo; }
  isContest(): boolean { return this.accountType === AccountType.Contest; }
  isHedging(): boolean {
    return this.tradeMode === AccountTradeMode.Hedge
        || this.tradeMode === AccountTradeMode.SingleHedge;
  }

  // ── Trading permissions ───────────────────────────────────

  allowsTrade():       boolean { return this.tradeAllowed; }
  allowsExpertTrade(): boolean { return this.tradeExpertAllowed; }

  // ── Stop-out mode predicates ──────────────────────────────

  isPercentStopout():  boolean { return this.stopOutMode === AccountStopoutMode.Percent; }
  isCurrencyStopout(): boolean { return this.stopOutMode === AccountStopoutMode.Money; }

  // ── Margin health ─────────────────────────────────────────

  /** Unrealised P&L: equity minus balance. Positive = open profit. */
  floatingProfit(): number { return this.equity - this.balance; }

  /** True when margin level is at or below the margin call threshold. */
  isUnderMarginCall(callLevel: number): boolean {
    return this.margin > 0 && this.marginLevel <= callLevel;
  }

  // ── Conversion ────────────────────────────────────────────

  static fromVO(vo: AccountInfoVO): Account {
    return new Account(
      vo.login,
      vo.accountType,
      vo.tradeMode,
      vo.leverage,
      vo.marginMode,
      vo.stopOutMode,
      vo.marginSoMode,
      vo.tradeAllowed,
      vo.tradeExpertAllowed,
      vo.limitOrders,
      vo.balance,
      vo.credit,
      vo.profit,
      vo.equity,
      vo.margin,
      vo.freeMargin,
      vo.marginLevel,
      vo.marginInitial,
      vo.marginMaintenance,
      vo.assets,
      vo.liabilities,
      vo.commission,
      vo.currency,
      vo.name,
      vo.server,
      vo.company,
    );
  }

  toVO(): AccountInfoVO {
    return {
      login:              this.login,
      accountType:        this.accountType,
      tradeMode:          this.tradeMode,
      leverage:           this.leverage,
      marginMode:         this.marginMode,
      stopOutMode:        this.stopOutMode,
      marginSoMode:       this.marginSoMode,
      tradeAllowed:       this.tradeAllowed,
      tradeExpertAllowed: this.tradeExpertAllowed,
      limitOrders:        this.limitOrders,
      balance:            this.balance,
      credit:             this.credit,
      profit:             this.profit,
      equity:             this.equity,
      margin:             this.margin,
      freeMargin:         this.freeMargin,
      marginLevel:        this.marginLevel,
      marginInitial:      this.marginInitial,
      marginMaintenance:  this.marginMaintenance,
      assets:             this.assets,
      liabilities:        this.liabilities,
      commission:         this.commission,
      currency:           this.currency,
      name:               this.name,
      server:             this.server,
      company:            this.company,
    };
  }
}
