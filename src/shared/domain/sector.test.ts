import { describe, expect, it } from 'vitest';
import {
  GicsIndustry,
  GicsIndustryGroup,
  GicsSector,
  industriesInSector,
  industryGroupOf,
  industryGroupsInSector,
  industryOf,
  sectorOf,
  type GicsSubIndustry,
} from './sector.js';

describe('GicsSector', () => {
  it('has 11 sectors', () => {
    expect(Object.keys(GicsSector)).toHaveLength(11);
  });

  it('all codes are 2-digit integers', () => {
    for (const code of Object.values(GicsSector)) {
      expect(code).toBeGreaterThanOrEqual(10);
      expect(code).toBeLessThanOrEqual(99);
    }
  });
});

describe('GicsIndustryGroup', () => {
  it('has 25 industry groups', () => {
    expect(Object.keys(GicsIndustryGroup)).toHaveLength(25);
  });

  it('all codes are 4-digit integers divisible by 100 in the correct range', () => {
    for (const code of Object.values(GicsIndustryGroup)) {
      expect(code).toBeGreaterThanOrEqual(1000);
      expect(code).toBeLessThan(10000);
    }
  });
});

describe('GicsIndustry', () => {
  it('has at least 50 industries', () => {
    expect(Object.keys(GicsIndustry).length).toBeGreaterThanOrEqual(50);
  });

  it('all codes are 6-digit integers', () => {
    for (const code of Object.values(GicsIndustry)) {
      expect(code).toBeGreaterThanOrEqual(100000);
      expect(code).toBeLessThan(1000000);
    }
  });
});

describe('sectorOf()', () => {
  it('returns Energy for Energy industry group', () => {
    expect(sectorOf(GicsIndustryGroup.Energy)).toBe(GicsSector.Energy);
  });

  it('returns InformationTechnology for SoftwareAndServices', () => {
    expect(sectorOf(GicsIndustryGroup.SoftwareAndServices)).toBe(GicsSector.InformationTechnology);
  });

  it('returns Financials for Banks', () => {
    expect(sectorOf(GicsIndustryGroup.Banks)).toBe(GicsSector.Financials);
  });

  it('returns HealthCare for PharmaceuticalsBiotechAndLifeSci', () => {
    expect(sectorOf(GicsIndustryGroup.PharmaceuticalsBiotechAndLifeSci)).toBe(GicsSector.HealthCare);
  });

  it('all industry groups map to a known sector', () => {
    for (const ig of Object.values(GicsIndustryGroup) as GicsIndustryGroup[]) {
      expect(Object.values(GicsSector)).toContain(sectorOf(ig));
    }
  });
});

describe('industryGroupOf()', () => {
  it('returns SoftwareAndServices for Software', () => {
    expect(industryGroupOf(GicsIndustry.Software)).toBe(GicsIndustryGroup.SoftwareAndServices);
  });

  it('returns Banks for Banks industry', () => {
    expect(industryGroupOf(GicsIndustry.Banks)).toBe(GicsIndustryGroup.Banks);
  });

  it('all industries map to a known industry group', () => {
    for (const ind of Object.values(GicsIndustry) as GicsIndustry[]) {
      expect(Object.values(GicsIndustryGroup)).toContain(industryGroupOf(ind));
    }
  });
});

describe('industryOf()', () => {
  it('derives industry from a sub-industry code', () => {
    // SubIndustry 10101010 → Industry 101010 (EnergyEquipmentAndServices)
    const sub = 10101010 as GicsSubIndustry;
    expect(industryOf(sub)).toBe(GicsIndustry.EnergyEquipmentAndServices);
  });
});

describe('industryGroupsInSector()', () => {
  it('returns 1 group for Energy sector', () => {
    const groups = industryGroupsInSector(GicsSector.Energy);
    expect(groups).toHaveLength(1);
    expect(groups).toContain(GicsIndustryGroup.Energy);
  });

  it('returns 3 groups for Industrials sector', () => {
    const groups = industryGroupsInSector(GicsSector.Industrials);
    expect(groups).toHaveLength(3);
  });

  it('all returned groups belong to the sector', () => {
    for (const sector of Object.values(GicsSector) as GicsSector[]) {
      const groups = industryGroupsInSector(sector);
      for (const ig of groups) {
        expect(sectorOf(ig)).toBe(sector);
      }
    }
  });
});

describe('industriesInSector()', () => {
  it('returns industries for InformationTechnology sector', () => {
    const industries = industriesInSector(GicsSector.InformationTechnology);
    expect(industries).toContain(GicsIndustry.Software);
    expect(industries).toContain(GicsIndustry.Semiconductors);
  });

  it('all returned industries belong to the correct sector', () => {
    for (const sector of Object.values(GicsSector) as GicsSector[]) {
      const industries = industriesInSector(sector);
      for (const ind of industries) {
        const ig = industryGroupOf(ind);
        expect(sectorOf(ig)).toBe(sector);
      }
    }
  });

  it('returns non-empty list for every sector', () => {
    for (const sector of Object.values(GicsSector) as GicsSector[]) {
      expect(industriesInSector(sector).length).toBeGreaterThan(0);
    }
  });
});
