// GICS (Global Industry Classification Standard) Sector Taxonomy
// Codes are hierarchical: subIndustry ÷ 100 = industry, ÷ 100 = industryGroup, ÷ 100 = sector

// ── Sector (2-digit codes) ──────────────────────────────────────────────────
export const GicsSector = {
  Energy:                 10,
  Materials:              15,
  Industrials:            20,
  ConsumerDiscretionary:  25,
  ConsumerStaples:        30,
  HealthCare:             35,
  Financials:             40,
  InformationTechnology:  45,
  CommunicationServices:  50,
  Utilities:              55,
  RealEstate:             60,
} as const;
export type GicsSector = (typeof GicsSector)[keyof typeof GicsSector];

// ── Industry Group (4-digit codes) ─────────────────────────────────────────
export const GicsIndustryGroup = {
  // Energy
  Energy:                            1010,
  // Materials
  Materials:                         1510,
  // Industrials
  CapitalGoods:                      2010,
  CommercialAndProfessionalServices: 2020,
  Transportation:                    2030,
  // Consumer Discretionary
  AutomobilesAndComponents:          2510,
  ConsumerDurablesAndApparel:        2520,
  ConsumerServices:                  2530,
  ConsumerDiscretionaryDistribution: 2550,
  // Consumer Staples
  ConsumerStaplesDistribution:       3010,
  FoodBeverageAndTobacco:            3020,
  HouseholdAndPersonalProducts:      3030,
  // Health Care
  HealthCareEquipmentAndServices:    3510,
  PharmaceuticalsBiotechAndLifeSci:  3520,
  // Financials
  Banks:                             4010,
  FinancialServices:                 4020,
  Insurance:                         4030,
  // Information Technology
  SoftwareAndServices:               4510,
  TechnologyHardwareAndEquipment:    4520,
  SemiconductorsAndEquipment:        4530,
  // Communication Services
  TelecommunicationServices:         5010,
  MediaAndEntertainment:             5020,
  // Utilities
  Utilities:                         5510,
  // Real Estate
  EquityRealEstate:                  6010,
  RealEstateManagement:              6020,
} as const;
export type GicsIndustryGroup = (typeof GicsIndustryGroup)[keyof typeof GicsIndustryGroup];

// ── Industry (6-digit codes) — representative subset ───────────────────────
export const GicsIndustry = {
  // Energy (1010xx)
  EnergyEquipmentAndServices:           101010,
  OilGasAndConsumableFuels:             101020,
  // Materials (1510xx)
  Chemicals:                            151010,
  ConstructionMaterials:                151020,
  ContainersAndPackaging:               151030,
  MetalsAndMining:                      151040,
  PaperAndForestProducts:               151050,
  // Industrials
  AerospaceAndDefense:                  201010,
  BuildingProducts:                     201020,
  ConstructionAndEngineering:           201030,
  ElectricalEquipment:                  201040,
  IndustrialConglomerates:              201050,
  Machinery:                            201060,
  TradingCompaniesAndDistributors:      201070,
  CommercialServicesAndSupplies:        202010,
  ProfessionalServices:                 202020,
  AirFreightAndLogistics:               203010,
  GroundTransportation:                 203020,
  MarineTransportation:                 203030,
  PassengerAirlines:                    203040,
  // Consumer Discretionary
  AutoComponents:                       251010,
  Automobiles:                          251020,
  HouseholdDurables:                    252010,
  LeisureProducts:                      252020,
  TextilesApparelAndLuxuryGoods:        252030,
  HotelsRestaurantsAndLeisure:          253010,
  DiversifiedConsumerServices:          253020,
  Distributors:                         255010,
  BroadlineRetail:                      255030,
  SpecialtyRetail:                      255040,
  // Consumer Staples
  ConsumerStaplesDistributionRetail:    301010,
  Beverages:                            302010,
  FoodProducts:                         302020,
  Tobacco:                              302030,
  HouseholdProducts:                    303010,
  PersonalCareProducts:                 303020,
  // Health Care
  HealthCareEquipmentAndSupplies:       351010,
  HealthCareProvidersAndServices:       351020,
  HealthCareTechnology:                 351030,
  Biotechnology:                        352010,
  Pharmaceuticals:                      352020,
  LifeSciencesToolsAndServices:         352030,
  // Financials
  Banks:                                401010,
  FinancialServices:                    402010,
  ConsumerFinance:                      402020,
  CapitalMarkets:                       402030,
  MortgageRealEstateInvestmentTrusts:   402040,
  Insurance:                            403010,
  // Information Technology
  ITServices:                           451020,
  Software:                             451030,
  CommunicationsEquipment:              452010,
  TechnologyHardwareStoragePeripherals: 452020,
  ElectronicEquipmentInstruments:       452030,
  Semiconductors:                       453010,
  // Communication Services
  DiversifiedTelecommunicationServices: 501010,
  WirelessTelecommunicationServices:    501020,
  Entertainment:                        502010,
  InteractiveMediaAndServices:          502020,
  // Utilities
  ElectricUtilities:                    551010,
  GasUtilities:                         551020,
  MultiUtilities:                       551030,
  WaterUtilities:                       551040,
  IndependentPowerProducers:            551050,
  // Real Estate
  DiversifiedREITs:                     601010,
  IndustrialREITs:                      601025,
  HotelAndResortREITs:                  601030,
  OfficeREITs:                          601040,
  HealthCareREITs:                      601050,
  ResidentialREITs:                     601060,
  RetailREITs:                          601070,
  SpecializedREITs:                     601080,
  RealEstateManagementAndDevelopment:   602010,
} as const;
export type GicsIndustry = (typeof GicsIndustry)[keyof typeof GicsIndustry];

// ── SubIndustry — omitted for brevity; same 8-digit pattern ────────────────
// Add sub-industries as needed; sectorOf/industryGroupOf/industryOf still work
export type GicsSubIndustry = number & { readonly _brand: 'GicsSubIndustry' };

// ── O(1) lookup maps built algorithmically ─────────────────────────────────
const _industryGroupToSector = new Map<GicsIndustryGroup, GicsSector>();
for (const ig of Object.values(GicsIndustryGroup) as GicsIndustryGroup[]) {
  _industryGroupToSector.set(ig, Math.floor(ig / 100) as GicsSector);
}

const _industryToIndustryGroup = new Map<GicsIndustry, GicsIndustryGroup>();
for (const ind of Object.values(GicsIndustry) as GicsIndustry[]) {
  _industryToIndustryGroup.set(ind, Math.floor(ind / 100) as GicsIndustryGroup);
}

// Reverse maps: sector → its industry groups / industries (O(1) by-sector lookup)
const _sectorToIndustryGroups = new Map<GicsSector, GicsIndustryGroup[]>();
for (const ig of Object.values(GicsIndustryGroup) as GicsIndustryGroup[]) {
  const sector = Math.floor(ig / 100) as GicsSector;
  const list = _sectorToIndustryGroups.get(sector) ?? [];
  list.push(ig);
  _sectorToIndustryGroups.set(sector, list);
}

const _sectorToIndustries = new Map<GicsSector, GicsIndustry[]>();
for (const ind of Object.values(GicsIndustry) as GicsIndustry[]) {
  const ig = Math.floor(ind / 100) as GicsIndustryGroup;
  const sector = _industryGroupToSector.get(ig);
  if (sector !== undefined) {
    const list = _sectorToIndustries.get(sector) ?? [];
    list.push(ind);
    _sectorToIndustries.set(sector, list);
  }
}

// Set of known industry codes for validation in industryOf()
const _knownIndustries = new Set<number>(Object.values(GicsIndustry) as number[]);

// ── Public query API ────────────────────────────────────────────────────────
export function sectorOf(industryGroup: GicsIndustryGroup): GicsSector {
  const s = _industryGroupToSector.get(industryGroup);
  if (s === undefined) throw new Error(`Unknown IndustryGroup code: ${industryGroup}`);
  return s;
}

export function industryGroupOf(industry: GicsIndustry): GicsIndustryGroup {
  const ig = _industryToIndustryGroup.get(industry);
  if (ig === undefined) throw new Error(`Unknown Industry code: ${industry}`);
  return ig;
}

export function industryOf(subIndustry: GicsSubIndustry): GicsIndustry {
  const code = Math.floor(subIndustry / 100);
  if (!_knownIndustries.has(code)) throw new Error(`Unknown Industry code derived from subIndustry: ${subIndustry}`);
  return code as GicsIndustry;
}

export function industryGroupsInSector(sector: GicsSector): GicsIndustryGroup[] {
  return _sectorToIndustryGroups.get(sector) ?? [];
}

export function industriesInSector(sector: GicsSector): GicsIndustry[] {
  return _sectorToIndustries.get(sector) ?? [];
}
