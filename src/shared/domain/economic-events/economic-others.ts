// ─── Other economies: AU, CA, NZ, CH, CN, DE, FR + worldwide summits ───
import type { EventDefinition } from './types.js';
import {
  EventDomain, EventFrequency, EventImportance, EventMultiplier,
  EventSector, EventTimeMode, EventType, EventUnit,
} from './types.js';

// ─── Australia ───────────────────────────────────────────────────────
const AU = { countryCode: 'AU' as const, countryId: 36, currency: 'AUD' as const, domain: EventDomain.Economic };

const AU_EVENTS_LIST: readonly EventDefinition[] = [
  { id: 'AU.MONEY.RBA_RATE', name: 'RBA Interest Rate Decision', type: EventType.Indicator, sector: EventSector.Money, importance: EventImportance.High, frequency: EventFrequency.Quarter, timeMode: EventTimeMode.DateTime, unit: EventUnit.Percent, multiplier: EventMultiplier.None, digits: 2, externalIds: { slug: 'rba-rate' }, description: 'Reserve Bank of Australia cash rate decision', ...AU },
  { id: 'AU.MONEY.RBA_RATE_STATEMENT', name: 'RBA Rate Statement', type: EventType.Event, sector: EventSector.Money, importance: EventImportance.High, frequency: EventFrequency.Quarter, timeMode: EventTimeMode.DateTime, unit: EventUnit.None, multiplier: EventMultiplier.None, digits: 0, description: 'Reserve Bank of Australia monetary policy statement', ...AU },
  { id: 'AU.MONEY.RBA_GOVERNOR_SPEECH', name: 'RBA Governor Speech', type: EventType.Event, sector: EventSector.Money, importance: EventImportance.Moderate, frequency: EventFrequency.Month, timeMode: EventTimeMode.DateTime, unit: EventUnit.None, multiplier: EventMultiplier.None, digits: 0, description: 'Speech by the Reserve Bank of Australia Governor', ...AU },
  { id: 'AU.JOBS.EMPLOYMENT_CHANGE', name: 'AU Employment Change', type: EventType.Indicator, sector: EventSector.Jobs, importance: EventImportance.Moderate, frequency: EventFrequency.Month, timeMode: EventTimeMode.DateTime, unit: EventUnit.Job, multiplier: EventMultiplier.Thousands, digits: 1, externalIds: { slug: 'au-employment' }, description: 'Australia change in the number of employed people', ...AU },
  { id: 'AU.JOBS.UNEMPLOYMENT_RATE', name: 'AU Unemployment Rate', type: EventType.Indicator, sector: EventSector.Jobs, importance: EventImportance.Moderate, frequency: EventFrequency.Month, timeMode: EventTimeMode.DateTime, unit: EventUnit.Percent, multiplier: EventMultiplier.None, digits: 1, description: 'Australia unemployment rate', ...AU },
  { id: 'AU.PRICES.CPI_YOY', name: 'AU CPI Y/Y', type: EventType.Indicator, sector: EventSector.Prices, importance: EventImportance.Moderate, frequency: EventFrequency.Quarter, timeMode: EventTimeMode.DateTime, unit: EventUnit.Percent, multiplier: EventMultiplier.None, digits: 1, externalIds: { slug: 'au-cpi' }, description: 'Australia Consumer Price Index year-over-year change', ...AU },
  { id: 'AU.PRICES.CPI_QOQ', name: 'AU CPI Q/Q', type: EventType.Indicator, sector: EventSector.Prices, importance: EventImportance.Moderate, frequency: EventFrequency.Quarter, timeMode: EventTimeMode.DateTime, unit: EventUnit.Percent, multiplier: EventMultiplier.None, digits: 1, description: 'Australia Consumer Price Index quarter-over-quarter change', ...AU },
  { id: 'AU.GDP.GDP_QOQ', name: 'AU GDP Q/Q', type: EventType.Indicator, sector: EventSector.GDP, importance: EventImportance.Moderate, frequency: EventFrequency.Quarter, timeMode: EventTimeMode.DateTime, unit: EventUnit.Percent, multiplier: EventMultiplier.None, digits: 1, externalIds: { slug: 'au-gdp' }, description: 'Australia Gross Domestic Product quarter-over-quarter change', ...AU },
  { id: 'AU.TRADE.TRADE_BALANCE', name: 'AU Trade Balance', type: EventType.Indicator, sector: EventSector.Trade, importance: EventImportance.Low, frequency: EventFrequency.Month, timeMode: EventTimeMode.DateTime, unit: EventUnit.Currency, multiplier: EventMultiplier.Billions, digits: 2, description: 'Australia trade balance', ...AU },
] as const;

// ─── Canada ──────────────────────────────────────────────────────────
const CA = { countryCode: 'CA' as const, countryId: 124, currency: 'CAD' as const, domain: EventDomain.Economic };

const CA_EVENTS_LIST: readonly EventDefinition[] = [
  { id: 'CA.MONEY.BOC_RATE', name: 'BoC Interest Rate Decision', type: EventType.Indicator, sector: EventSector.Money, importance: EventImportance.High, frequency: EventFrequency.Quarter, timeMode: EventTimeMode.DateTime, unit: EventUnit.Percent, multiplier: EventMultiplier.None, digits: 2, externalIds: { slug: 'boc-rate' }, description: 'Bank of Canada overnight rate decision', ...CA },
  { id: 'CA.MONEY.BOC_RATE_STATEMENT', name: 'BoC Rate Statement', type: EventType.Event, sector: EventSector.Money, importance: EventImportance.High, frequency: EventFrequency.Quarter, timeMode: EventTimeMode.DateTime, unit: EventUnit.None, multiplier: EventMultiplier.None, digits: 0, description: 'Bank of Canada rate statement and forward guidance', ...CA },
  { id: 'CA.MONEY.BOC_MONETARY_POLICY_REPORT', name: 'BoC Monetary Policy Report', type: EventType.Event, sector: EventSector.Money, importance: EventImportance.High, frequency: EventFrequency.Quarter, timeMode: EventTimeMode.DateTime, unit: EventUnit.None, multiplier: EventMultiplier.None, digits: 0, description: 'Bank of Canada quarterly monetary policy report', ...CA },
  { id: 'CA.MONEY.BOC_GOVERNOR_SPEECH', name: 'BoC Governor Speech', type: EventType.Event, sector: EventSector.Money, importance: EventImportance.Moderate, frequency: EventFrequency.Month, timeMode: EventTimeMode.DateTime, unit: EventUnit.None, multiplier: EventMultiplier.None, digits: 0, description: 'Speech by the Bank of Canada Governor', ...CA },
  { id: 'CA.JOBS.UNEMPLOYMENT_RATE', name: 'CA Unemployment Rate', type: EventType.Indicator, sector: EventSector.Jobs, importance: EventImportance.Moderate, frequency: EventFrequency.Month, timeMode: EventTimeMode.DateTime, unit: EventUnit.Percent, multiplier: EventMultiplier.None, digits: 1, externalIds: { slug: 'ca-unemployment' }, description: 'Canada unemployment rate', ...CA },
  { id: 'CA.JOBS.EMPLOYMENT_CHANGE', name: 'CA Employment Change', type: EventType.Indicator, sector: EventSector.Jobs, importance: EventImportance.Moderate, frequency: EventFrequency.Month, timeMode: EventTimeMode.DateTime, unit: EventUnit.Job, multiplier: EventMultiplier.Thousands, digits: 1, description: 'Canada net change in employment', ...CA },
  { id: 'CA.GDP.GDP_MOM', name: 'CA GDP M/M', type: EventType.Indicator, sector: EventSector.GDP, importance: EventImportance.Moderate, frequency: EventFrequency.Month, timeMode: EventTimeMode.DateTime, unit: EventUnit.Percent, multiplier: EventMultiplier.None, digits: 1, description: 'Canada Gross Domestic Product month-over-month change', ...CA },
  { id: 'CA.PRICES.CPI_MOM', name: 'CA CPI M/M', type: EventType.Indicator, sector: EventSector.Prices, importance: EventImportance.Moderate, frequency: EventFrequency.Month, timeMode: EventTimeMode.DateTime, unit: EventUnit.Percent, multiplier: EventMultiplier.None, digits: 1, description: 'Canada Consumer Price Index month-over-month change', ...CA },
  { id: 'CA.PRICES.CPI_YOY', name: 'CA CPI Y/Y', type: EventType.Indicator, sector: EventSector.Prices, importance: EventImportance.Moderate, frequency: EventFrequency.Month, timeMode: EventTimeMode.DateTime, unit: EventUnit.Percent, multiplier: EventMultiplier.None, digits: 1, description: 'Canada Consumer Price Index year-over-year change', ...CA },
  { id: 'CA.TRADE.TRADE_BALANCE', name: 'CA Trade Balance', type: EventType.Indicator, sector: EventSector.Trade, importance: EventImportance.Low, frequency: EventFrequency.Month, timeMode: EventTimeMode.DateTime, unit: EventUnit.Currency, multiplier: EventMultiplier.Billions, digits: 2, description: 'Canada merchandise trade balance', ...CA },
] as const;

// ─── New Zealand ─────────────────────────────────────────────────────
const NZ = { countryCode: 'NZ' as const, countryId: 554, currency: 'NZD' as const, domain: EventDomain.Economic };

const NZ_EVENTS_LIST: readonly EventDefinition[] = [
  { id: 'NZ.MONEY.RBNZ_RATE', name: 'RBNZ Interest Rate Decision', type: EventType.Indicator, sector: EventSector.Money, importance: EventImportance.High, frequency: EventFrequency.Quarter, timeMode: EventTimeMode.DateTime, unit: EventUnit.Percent, multiplier: EventMultiplier.None, digits: 2, externalIds: { slug: 'rbnz-rate' }, description: 'Reserve Bank of New Zealand official cash rate decision', countryCode: 'NZ', countryId: 554, currency: 'NZD', domain: EventDomain.Economic },
  { id: 'NZ.PRICES.CPI_YOY', name: 'NZ CPI Y/Y', type: EventType.Indicator, sector: EventSector.Prices, importance: EventImportance.Moderate, frequency: EventFrequency.Quarter, timeMode: EventTimeMode.DateTime, unit: EventUnit.Percent, multiplier: EventMultiplier.None, digits: 1, externalIds: { slug: 'nz-cpi' }, description: 'New Zealand Consumer Price Index year-over-year change', ...NZ },
  { id: 'NZ.GDP.GDP_QOQ', name: 'NZ GDP Q/Q', type: EventType.Indicator, sector: EventSector.GDP, importance: EventImportance.Moderate, frequency: EventFrequency.Quarter, timeMode: EventTimeMode.DateTime, unit: EventUnit.Percent, multiplier: EventMultiplier.None, digits: 1, description: 'New Zealand Gross Domestic Product quarter-over-quarter change', ...NZ },
] as const;

// ─── Switzerland ─────────────────────────────────────────────────────
const CH = { countryCode: 'CH' as const, countryId: 756, currency: 'CHF' as const, domain: EventDomain.Economic };

const CH_EVENTS_LIST: readonly EventDefinition[] = [
  { id: 'CH.MONEY.SNB_RATE', name: 'SNB Interest Rate Decision', type: EventType.Indicator, sector: EventSector.Money, importance: EventImportance.High, frequency: EventFrequency.Quarter, timeMode: EventTimeMode.DateTime, unit: EventUnit.Percent, multiplier: EventMultiplier.None, digits: 2, externalIds: { slug: 'snb-rate' }, description: 'Swiss National Bank policy rate decision', ...CH },
  { id: 'CH.PRICES.CPI_YOY', name: 'CH CPI Y/Y', type: EventType.Indicator, sector: EventSector.Prices, importance: EventImportance.Low, frequency: EventFrequency.Month, timeMode: EventTimeMode.DateTime, unit: EventUnit.Percent, multiplier: EventMultiplier.None, digits: 1, description: 'Switzerland Consumer Price Index year-over-year change', ...CH },
  { id: 'CH.GDP.GDP_QOQ', name: 'CH GDP Q/Q', type: EventType.Indicator, sector: EventSector.GDP, importance: EventImportance.Low, frequency: EventFrequency.Quarter, timeMode: EventTimeMode.DateTime, unit: EventUnit.Percent, multiplier: EventMultiplier.None, digits: 1, description: 'Switzerland Gross Domestic Product quarter-over-quarter change', ...CH },
] as const;

// ─── China ────────────────────────────────────────────────────────────
const CN = { countryCode: 'CN' as const, countryId: 156, currency: 'CNY' as const, domain: EventDomain.Economic };

const CN_EVENTS_LIST: readonly EventDefinition[] = [
  { id: 'CN.MONEY.PBOC_RATE', name: 'PBoC Loan Prime Rate', type: EventType.Indicator, sector: EventSector.Money, importance: EventImportance.High, frequency: EventFrequency.Month, timeMode: EventTimeMode.DateTime, unit: EventUnit.Percent, multiplier: EventMultiplier.None, digits: 2, description: 'People\'s Bank of China Loan Prime Rate decision', ...CN },
  { id: 'CN.PRICES.CPI_YOY', name: 'CN CPI Y/Y', type: EventType.Indicator, sector: EventSector.Prices, importance: EventImportance.Moderate, frequency: EventFrequency.Month, timeMode: EventTimeMode.DateTime, unit: EventUnit.Percent, multiplier: EventMultiplier.None, digits: 1, externalIds: { slug: 'cn-cpi' }, description: 'China Consumer Price Index year-over-year change', ...CN },
  { id: 'CN.PRICES.PPI_YOY', name: 'CN PPI Y/Y', type: EventType.Indicator, sector: EventSector.Prices, importance: EventImportance.Moderate, frequency: EventFrequency.Month, timeMode: EventTimeMode.DateTime, unit: EventUnit.Percent, multiplier: EventMultiplier.None, digits: 1, description: 'China Producer Price Index year-over-year change', ...CN },
  { id: 'CN.GDP.GDP_YOY', name: 'CN GDP Y/Y', type: EventType.Indicator, sector: EventSector.GDP, importance: EventImportance.High, frequency: EventFrequency.Quarter, timeMode: EventTimeMode.DateTime, unit: EventUnit.Percent, multiplier: EventMultiplier.None, digits: 1, externalIds: { slug: 'cn-gdp' }, description: 'China Gross Domestic Product year-over-year change', ...CN },
  { id: 'CN.BUSINESS.MFG_PMI', name: 'CN Manufacturing PMI (Official)', type: EventType.Indicator, sector: EventSector.Business, importance: EventImportance.High, frequency: EventFrequency.Month, timeMode: EventTimeMode.DateTime, unit: EventUnit.None, multiplier: EventMultiplier.None, digits: 1, description: 'China NBS Manufacturing Purchasing Managers Index', ...CN },
  { id: 'CN.BUSINESS.CAIXIN_MFG_PMI', name: 'CN Caixin Manufacturing PMI', type: EventType.Indicator, sector: EventSector.Business, importance: EventImportance.Moderate, frequency: EventFrequency.Month, timeMode: EventTimeMode.DateTime, unit: EventUnit.None, multiplier: EventMultiplier.None, digits: 1, description: 'China Caixin Manufacturing Purchasing Managers Index', ...CN },
] as const;

// ─── Germany ─────────────────────────────────────────────────────────
const DE = { countryCode: 'DE' as const, countryId: 276, currency: 'EUR' as const, domain: EventDomain.Economic };

const DE_EVENTS_LIST: readonly EventDefinition[] = [
  { id: 'DE.BUSINESS.IFO_INDEX', name: 'DE IFO Business Climate', type: EventType.Indicator, sector: EventSector.Business, importance: EventImportance.Moderate, frequency: EventFrequency.Month, timeMode: EventTimeMode.DateTime, unit: EventUnit.None, multiplier: EventMultiplier.None, digits: 1, description: 'Germany IFO Business Climate Index', ...DE },
  { id: 'DE.SENTIMENT.ZEW', name: 'DE ZEW Economic Sentiment', type: EventType.Indicator, sector: EventSector.Sentiment, importance: EventImportance.Moderate, frequency: EventFrequency.Month, timeMode: EventTimeMode.DateTime, unit: EventUnit.None, multiplier: EventMultiplier.None, digits: 1, description: 'ZEW Indicator of Economic Sentiment for Germany', ...DE },
  { id: 'DE.PRICES.CPI_YOY', name: 'DE CPI Y/Y', type: EventType.Indicator, sector: EventSector.Prices, importance: EventImportance.Moderate, frequency: EventFrequency.Month, timeMode: EventTimeMode.DateTime, unit: EventUnit.Percent, multiplier: EventMultiplier.None, digits: 1, description: 'Germany Consumer Price Index year-over-year change', ...DE },
  { id: 'DE.GDP.GDP_QOQ', name: 'DE GDP Q/Q', type: EventType.Indicator, sector: EventSector.GDP, importance: EventImportance.Moderate, frequency: EventFrequency.Quarter, timeMode: EventTimeMode.DateTime, unit: EventUnit.Percent, multiplier: EventMultiplier.None, digits: 1, description: 'Germany Gross Domestic Product quarter-over-quarter change', ...DE },
] as const;

// ─── France ──────────────────────────────────────────────────────────
const FR = { countryCode: 'FR' as const, countryId: 250, currency: 'EUR' as const, domain: EventDomain.Economic };

const FR_EVENTS_LIST: readonly EventDefinition[] = [
  { id: 'FR.PRICES.CPI_YOY', name: 'FR CPI Y/Y', type: EventType.Indicator, sector: EventSector.Prices, importance: EventImportance.Low, frequency: EventFrequency.Month, timeMode: EventTimeMode.DateTime, unit: EventUnit.Percent, multiplier: EventMultiplier.None, digits: 1, description: 'France Consumer Price Index year-over-year change', ...FR },
  { id: 'FR.GDP.GDP_QOQ', name: 'FR GDP Q/Q', type: EventType.Indicator, sector: EventSector.GDP, importance: EventImportance.Low, frequency: EventFrequency.Quarter, timeMode: EventTimeMode.DateTime, unit: EventUnit.Percent, multiplier: EventMultiplier.None, digits: 1, description: 'France Gross Domestic Product quarter-over-quarter change', ...FR },
  { id: 'FR.BUSINESS.MFG_PMI', name: 'FR Manufacturing PMI', type: EventType.Indicator, sector: EventSector.Business, importance: EventImportance.Low, frequency: EventFrequency.Month, timeMode: EventTimeMode.DateTime, unit: EventUnit.None, multiplier: EventMultiplier.None, digits: 1, description: 'France S&P Global Manufacturing Purchasing Managers Index', ...FR },
] as const;

// ─── Worldwide ────────────────────────────────────────────────────────
const WW = { countryCode: 'WW' as const, countryId: 0, currency: 'ALL' as const, domain: EventDomain.Economic };

const WW_EVENTS_LIST: readonly EventDefinition[] = [
  { id: 'WW.GEOPOLITICAL.G7_SUMMIT', name: 'G7 Summit', type: EventType.Event, sector: EventSector.Geopolitical, importance: EventImportance.Moderate, frequency: EventFrequency.Year, timeMode: EventTimeMode.Date, unit: EventUnit.None, multiplier: EventMultiplier.None, digits: 0, description: 'Group of Seven leaders summit', ...WW },
  { id: 'WW.GEOPOLITICAL.G20_SUMMIT', name: 'G20 Summit', type: EventType.Event, sector: EventSector.Geopolitical, importance: EventImportance.Moderate, frequency: EventFrequency.Year, timeMode: EventTimeMode.Date, unit: EventUnit.None, multiplier: EventMultiplier.None, digits: 0, description: 'Group of Twenty leaders summit', ...WW },
  { id: 'WW.ENERGY.OPEC_MEETING', name: 'OPEC Meeting', type: EventType.Event, sector: EventSector.Energy, importance: EventImportance.Moderate, frequency: EventFrequency.Quarter, timeMode: EventTimeMode.Date, unit: EventUnit.None, multiplier: EventMultiplier.None, digits: 0, description: 'OPEC+ ministerial meeting on oil production policy', ...WW },
  { id: 'WW.GEOPOLITICAL.IMF_WB_MEETING', name: 'IMF/World Bank Meeting', type: EventType.Event, sector: EventSector.Geopolitical, importance: EventImportance.Low, frequency: EventFrequency.Quarter, timeMode: EventTimeMode.Date, unit: EventUnit.None, multiplier: EventMultiplier.None, digits: 0, description: 'International Monetary Fund and World Bank Group meetings', ...WW },
  { id: 'WW.GEOPOLITICAL.WTO_MEETING', name: 'WTO Meeting', type: EventType.Event, sector: EventSector.Geopolitical, importance: EventImportance.Low, frequency: EventFrequency.Year, timeMode: EventTimeMode.Date, unit: EventUnit.None, multiplier: EventMultiplier.None, digits: 0, description: 'World Trade Organization ministerial conference', ...WW },
  { id: 'WW.GEOPOLITICAL.UN_SECURITY_COUNCIL', name: 'UN Security Council Vote', type: EventType.Event, sector: EventSector.Geopolitical, importance: EventImportance.Moderate, frequency: EventFrequency.None, timeMode: EventTimeMode.DateTime, unit: EventUnit.None, multiplier: EventMultiplier.None, digits: 0, description: 'UN Security Council vote on sanctions, peacekeeping, or resolutions', ...WW },
  { id: 'WW.GEOPOLITICAL.NUCLEAR_TEST', name: 'Nuclear Test/Missile Launch', type: EventType.Event, sector: EventSector.Geopolitical, importance: EventImportance.High, frequency: EventFrequency.None, timeMode: EventTimeMode.DateTime, unit: EventUnit.None, multiplier: EventMultiplier.None, digits: 0, description: 'Nuclear weapons test or ICBM launch by any nation', ...WW },
  { id: 'WW.GEOPOLITICAL.ANTITRUST_RULING', name: 'Major Antitrust Ruling', type: EventType.Event, sector: EventSector.Geopolitical, importance: EventImportance.Moderate, frequency: EventFrequency.None, timeMode: EventTimeMode.Date, unit: EventUnit.None, multiplier: EventMultiplier.None, digits: 0, description: 'Major antitrust ruling or breakup order (US DOJ, EU DG COMP)', ...WW },
  { id: 'WW.GEOPOLITICAL.AI_REGULATION', name: 'AI Regulation Event', type: EventType.Event, sector: EventSector.Geopolitical, importance: EventImportance.Moderate, frequency: EventFrequency.None, timeMode: EventTimeMode.Date, unit: EventUnit.None, multiplier: EventMultiplier.None, digits: 0, description: 'Major AI regulation or executive order affecting tech sector', ...WW },
  { id: 'WW.GEOPOLITICAL.DAVOS', name: 'World Economic Forum (Davos)', type: EventType.Event, sector: EventSector.Geopolitical, importance: EventImportance.Low, frequency: EventFrequency.Year, timeMode: EventTimeMode.Date, unit: EventUnit.None, multiplier: EventMultiplier.None, digits: 0, description: 'World Economic Forum annual meeting in Davos', ...WW },
  { id: 'WW.GEOPOLITICAL.COP_SUMMIT', name: 'UN Climate Summit (COP)', type: EventType.Event, sector: EventSector.Geopolitical, importance: EventImportance.Low, frequency: EventFrequency.Year, timeMode: EventTimeMode.Date, unit: EventUnit.None, multiplier: EventMultiplier.None, digits: 0, description: 'UN Framework Convention on Climate Change Conference of Parties', ...WW },
] as const;

export const OTHERS_EVENTS: readonly EventDefinition[] = [
  ...AU_EVENTS_LIST,
  ...CA_EVENTS_LIST,
  ...NZ_EVENTS_LIST,
  ...CH_EVENTS_LIST,
  ...CN_EVENTS_LIST,
  ...DE_EVENTS_LIST,
  ...FR_EVENTS_LIST,
  ...WW_EVENTS_LIST,
] as const;
