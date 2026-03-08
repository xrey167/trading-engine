import { describe, expect, it } from 'vitest';
import {
  FigiIdType,
  FigiMarketSector,
  FigiSecurityType,
  figi,
  isFigi,
  type Figi,
  type FigiInstrument,
  type FigiMappingRequest,
} from './figi.js';

// Real-world FIGI examples (publicly known)
const VALID_FIGIS = [
  'BBG000BLNNH6', // Apple Inc
  'BBG000B9Y5X2', // Google
  'BBG000BVPV84', // Amazon
];

const INVALID_FIGIS = [
  '',
  'BBG000BLNNH',    // too short (11 chars)
  'BBG000BLNNH67',  // too long (13 chars)
  '123000BLNNH6',   // starts with digits not letters
  'BBX000BLNNH6',   // 3rd char must be G
  'bbg000blnnh6',   // lowercase
  'BBG000BLNNH!',   // non-alphanumeric
];

describe('isFigi()', () => {
  it.each(VALID_FIGIS)('accepts valid FIGI %s', (f) => {
    expect(isFigi(f)).toBe(true);
  });

  it.each(INVALID_FIGIS)('rejects invalid FIGI %s', (f) => {
    expect(isFigi(f)).toBe(false);
  });
});

describe('figi()', () => {
  it('returns a branded Figi for a valid string', () => {
    const result = figi('BBG000BLNNH6');
    expect(result).toBe('BBG000BLNNH6');
    // Type test: branded type should be assignable to Figi
    const typed: Figi = result;
    expect(typed).toBeDefined();
  });

  it.each(INVALID_FIGIS)('throws for invalid FIGI %s', (f) => {
    expect(() => figi(f)).toThrow();
  });

  it('includes the invalid string in the error message', () => {
    expect(() => figi('bad')).toThrow('Invalid FIGI: "bad"');
  });
});

describe('FigiMarketSector', () => {
  it('has at least 10 entries', () => {
    expect(Object.keys(FigiMarketSector).length).toBeGreaterThanOrEqual(10);
  });

  it('contains Equity', () => {
    expect(FigiMarketSector.Equity).toBe('Equity');
  });

  it('contains FixedIncome', () => {
    expect(FigiMarketSector.FixedIncome).toBe('Fixed Income');
  });
});

describe('FigiSecurityType', () => {
  it('contains CommonStock', () => {
    expect(FigiSecurityType.CommonStock).toBe('Common Stock');
  });

  it('contains ETP', () => {
    expect(FigiSecurityType.ETP).toBe('ETP');
  });
});

describe('FigiIdType', () => {
  it('contains ID_ISIN', () => {
    expect(FigiIdType.ID_ISIN).toBe('ID_ISIN');
  });

  it('contains TICKER', () => {
    expect(FigiIdType.TICKER).toBe('TICKER');
  });
});

describe('FigiMappingRequest interface', () => {
  it('can be constructed', () => {
    const req: FigiMappingRequest = {
      idType: FigiIdType.ID_ISIN,
      idValue: 'US0378331005',
      exchCode: 'US',
    };
    expect(req.idType).toBe('ID_ISIN');
  });
});

describe('FigiInstrument interface', () => {
  it('can be constructed with required fields only', () => {
    const inst: FigiInstrument = {
      figi: figi('BBG000BLNNH6'),
      name: 'APPLE INC',
    };
    expect(inst.figi).toBe('BBG000BLNNH6');
  });

  it('accepts all optional fields', () => {
    const inst: FigiInstrument = {
      figi: figi('BBG000BLNNH6'),
      name: 'APPLE INC',
      ticker: 'AAPL',
      exchCode: 'UW',
      compositeFIGI: figi('BBG000B9XRY4'),
      securityType: FigiSecurityType.CommonStock,
      marketSector: FigiMarketSector.Equity,
      shareClassFIGI: figi('BBG001S5N8V8'),
      securityDescription: 'AAPL',
      uniqueID: 'EQ0010169500001000',
    };
    expect(inst.ticker).toBe('AAPL');
  });
});
