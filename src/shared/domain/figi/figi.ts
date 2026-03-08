// FIGI (Financial Instrument Global Identifier) value object
// Spec: https://www.openfigi.com/about/figi

// ── Branded type ────────────────────────────────────────────────────────────
export type Figi = string & { readonly _brand: 'Figi' };

// Two uppercase letters, then 'G', then 9 alphanumeric chars
// Total: 12 characters. Last char is a check digit (Luhn-like) but we
// validate format only (check digit validation is OpenFIGI server-side).
const FIGI_RE = /^[A-Z]{2}G[A-Z0-9]{9}$/;

export function isFigi(s: string): s is Figi {
  return FIGI_RE.test(s);
}

export function figi(s: string): Figi {
  if (!isFigi(s)) throw new Error(`Invalid FIGI: "${s}"`);
  return s;
}

// ── Market Sector codes ─────────────────────────────────────────────────────
export const FigiMarketSector = {
  Equity:      'Equity',
  FixedIncome: 'Fixed Income',
  Future:      'Future',
  Option:      'Option',
  PrefEquity:  'Pref. Equity',
  Index:       'Index',
  Currency:    'Currency',
  Mortgage:    'Mortgage',
  Govt:        'Govt',
  Corp:        'Corp',
  Muni:        'Muni',
  Money:       'Money Mkt',
  Commodity:   'Commodity',
} as const;
export type FigiMarketSector = (typeof FigiMarketSector)[keyof typeof FigiMarketSector];

// ── Security Type codes (common subset) ─────────────────────────────────────
export const FigiSecurityType = {
  CommonStock:       'Common Stock',
  DepositaryReceipt: 'Depositary Receipt',
  ETP:               'ETP',
  Warrant:           'Warrant',
  Right:             'Right',
  PreferredStock:    'Preferred Stock',
  OpenEndFund:       'Open-End Fund',
  ClosedEndFund:     'Closed-End Fund',
  Bond:              'Corporate Bond',
  GovtBond:          'US GOVT AGENCY',
  Future:            'Future',
  Option:            'Option',
  Index:             'Index',
  Currency:          'Currency',
} as const;
export type FigiSecurityType = (typeof FigiSecurityType)[keyof typeof FigiSecurityType];

// ── ID Type codes used in mapping requests ──────────────────────────────────
export const FigiIdType = {
  ID_ISIN:      'ID_ISIN',
  ID_BB_GLOBAL: 'ID_BB_GLOBAL',
  ID_CUSIP:     'ID_CUSIP',
  ID_SEDOL:     'ID_SEDOL',
  TICKER:       'TICKER',
  ID_WERTPAPIER: 'ID_WERTPAPIER',
  ID_COMMON:    'ID_COMMON',
  ID_BB_UNIQUE: 'ID_BB_UNIQUE',
} as const;
export type FigiIdType = (typeof FigiIdType)[keyof typeof FigiIdType];

// ── Interfaces ──────────────────────────────────────────────────────────────
export interface FigiInstrument {
  figi: Figi;
  name: string;
  ticker?: string;
  exchCode?: string;
  compositeFIGI?: Figi;
  securityType?: FigiSecurityType | (string & {});
  marketSector?: FigiMarketSector | (string & {});
  shareClassFIGI?: Figi;
  securityDescription?: string;
  uniqueID?: string;
}

export interface FigiMappingRequest {
  idType: FigiIdType;
  idValue: string;
  exchCode?: string;
  currency?: string;
  marketSecDes?: FigiMarketSector;
}
