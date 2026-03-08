import type { EventDefinition } from './types.js';
import {
  EventDomain, EventFrequency, EventImportance, EventMultiplier,
  EventSector, EventTimeMode, EventType, EventUnit,
} from './types.js';

const FI_BASE = {
  sector: EventSector.FixedIncome,
  domain: EventDomain.FixedIncome,
  currency: 'ALL',
  unit: EventUnit.None,
  multiplier: EventMultiplier.None,
  digits: 0,
} as const;

const FI_IND = { type: EventType.Indicator, timeMode: EventTimeMode.Date, ...FI_BASE } as const;
const FI_EVT = { type: EventType.Event, timeMode: EventTimeMode.Date, ...FI_BASE } as const;

export const FIXED_INCOME_EVENTS: readonly EventDefinition[] = [
  // Yield curve & rates
  { id: 'FIXED_INCOME.FIXED_INCOME.YIELD_CURVE_INVERSION', name: 'Yield Curve Inversion', importance: EventImportance.High, frequency: EventFrequency.None, description: 'Yield curve inversion (e.g., 2s10s, 3m10y) — recession signal', ...FI_IND },
  { id: 'FIXED_INCOME.FIXED_INCOME.YIELD_CURVE_STEEPENING', name: 'Yield Curve Steepening', importance: EventImportance.Moderate, frequency: EventFrequency.None, description: 'Significant yield curve steepening (bear or bull steepener)', ...FI_IND },
  { id: 'FIXED_INCOME.FIXED_INCOME.CREDIT_SPREAD_BLOWOUT', name: 'Credit Spread Blowout', importance: EventImportance.High, frequency: EventFrequency.None, description: 'Investment-grade or high-yield credit spread blowout', ...FI_IND },
  { id: 'FIXED_INCOME.FIXED_INCOME.TED_SPREAD_SPIKE', name: 'TED Spread Spike', importance: EventImportance.High, frequency: EventFrequency.None, description: 'TED spread (T-bill vs. LIBOR/SOFR) spike indicating banking stress', ...FI_IND },
  { id: 'FIXED_INCOME.FIXED_INCOME.SWAP_SPREAD_DISLOCATION', name: 'Swap Spread Dislocation', importance: EventImportance.Moderate, frequency: EventFrequency.None, description: 'Interest rate swap spread dislocation signaling market stress', ...FI_IND },
  { id: 'FIXED_INCOME.FIXED_INCOME.REAL_YIELD_MILESTONE', name: 'Real Yield Milestone', importance: EventImportance.Moderate, frequency: EventFrequency.None, description: 'TIPS real yield crossing key psychological level (0%, 2%, etc.)', ...FI_IND },
  // Treasury auctions
  { id: 'FIXED_INCOME.FIXED_INCOME.TREASURY_AUCTION_WEAK', name: 'Weak Treasury Auction', importance: EventImportance.High, frequency: EventFrequency.None, description: 'US Treasury auction with poor demand (high tail, low bid-to-cover)', ...FI_EVT },
  { id: 'FIXED_INCOME.FIXED_INCOME.TREASURY_REFUNDING', name: 'Quarterly Refunding Announcement', importance: EventImportance.High, frequency: EventFrequency.Quarter, description: 'US Treasury quarterly refunding announcement (size and composition of upcoming auctions)', ...FI_EVT },
  // Credit events
  { id: 'FIXED_INCOME.FIXED_INCOME.SOVEREIGN_DOWNGRADE', name: 'Sovereign Credit Downgrade', importance: EventImportance.High, frequency: EventFrequency.None, description: "Sovereign credit rating downgrade by Moody's, S&P, or Fitch", ...FI_EVT },
  { id: 'FIXED_INCOME.FIXED_INCOME.CORPORATE_DOWNGRADE_HY', name: 'Corporate Downgrade to High Yield', importance: EventImportance.High, frequency: EventFrequency.None, description: 'Investment-grade corporate bond downgraded to high-yield (fallen angel)', ...FI_EVT },
  { id: 'FIXED_INCOME.FIXED_INCOME.CDS_SPIKE', name: 'Credit Default Swap Spike', importance: EventImportance.High, frequency: EventFrequency.None, description: 'Significant CDS spread widening indicating elevated default risk', ...FI_IND },
  // Market structure
  { id: 'FIXED_INCOME.FIXED_INCOME.SOFR_TRANSITION', name: 'SOFR/Benchmark Rate Transition', importance: EventImportance.High, frequency: EventFrequency.None, description: 'Key milestone in LIBOR-to-SOFR (or equivalent) benchmark transition', ...FI_EVT },
  { id: 'FIXED_INCOME.FIXED_INCOME.REPO_MARKET_STRESS', name: 'Repo Market Stress', importance: EventImportance.High, frequency: EventFrequency.None, description: 'Significant repo market rate spike or collateral shortage event', ...FI_IND },
  { id: 'FIXED_INCOME.FIXED_INCOME.BOND_MARKET_ILLIQUIDITY', name: 'Bond Market Illiquidity', importance: EventImportance.High, frequency: EventFrequency.None, description: 'Severe illiquidity or bid-ask spread widening in sovereign bond markets', ...FI_IND },
  // Issuance
  { id: 'FIXED_INCOME.FIXED_INCOME.SOVEREIGN_BOND_ISSUANCE', name: 'Major Sovereign Bond Issuance', importance: EventImportance.Moderate, frequency: EventFrequency.None, description: 'Significant new sovereign bond issuance affecting global rate markets', ...FI_EVT },
  { id: 'FIXED_INCOME.FIXED_INCOME.EM_DEBT_CRISIS', name: 'Emerging Market Debt Crisis', importance: EventImportance.High, frequency: EventFrequency.None, description: 'Sovereign default or IMF bailout request from systemically important EM country', ...FI_EVT },
  { id: 'FIXED_INCOME.FIXED_INCOME.QE_ANNOUNCEMENT', name: 'QE/QT Policy Announcement', importance: EventImportance.High, frequency: EventFrequency.None, description: 'Major central bank quantitative easing or tightening program announcement', ...FI_EVT },
] as const;
