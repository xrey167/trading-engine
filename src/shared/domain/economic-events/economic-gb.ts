import type { EventDefinition } from './types.js';
import {
  EventDomain, EventFrequency, EventImportance, EventMultiplier,
  EventSector, EventTimeMode, EventType, EventUnit,
} from './types.js';

const GB = {
  countryCode: 'GB' as const,
  countryId: 826,
  currency: 'GBP' as const,
  domain: EventDomain.Economic,
};

const MONEY_EVENTS: readonly EventDefinition[] = [
  { id: 'GB.MONEY.BOE_RATE', name: 'BoE Interest Rate Decision', type: EventType.Indicator, sector: EventSector.Money, importance: EventImportance.High, frequency: EventFrequency.Quarter, timeMode: EventTimeMode.DateTime, unit: EventUnit.Percent, multiplier: EventMultiplier.None, digits: 2, externalIds: { slug: 'boe-rate' }, description: 'Bank of England official bank rate decision', ...GB },
  { id: 'GB.MONEY.BOE_MPC_MINUTES', name: 'BoE MPC Minutes', type: EventType.Event, sector: EventSector.Money, importance: EventImportance.Moderate, frequency: EventFrequency.Quarter, timeMode: EventTimeMode.DateTime, unit: EventUnit.None, multiplier: EventMultiplier.None, digits: 0, description: 'Bank of England Monetary Policy Committee meeting minutes', ...GB },
  { id: 'GB.MONEY.BOE_MONETARY_POLICY_REPORT', name: 'BoE Monetary Policy Report', type: EventType.Event, sector: EventSector.Money, importance: EventImportance.High, frequency: EventFrequency.Quarter, timeMode: EventTimeMode.DateTime, unit: EventUnit.None, multiplier: EventMultiplier.None, digits: 0, description: 'Bank of England quarterly monetary policy report (formerly Inflation Report)', ...GB },
  { id: 'GB.MONEY.BOE_GOVERNOR_SPEECH', name: 'BoE Governor Speech', type: EventType.Event, sector: EventSector.Money, importance: EventImportance.Moderate, frequency: EventFrequency.Month, timeMode: EventTimeMode.DateTime, unit: EventUnit.None, multiplier: EventMultiplier.None, digits: 0, description: 'Speech by the Bank of England Governor', ...GB },
] as const;

const PRICES_EVENTS: readonly EventDefinition[] = [
  { id: 'GB.PRICES.CPI_YOY', name: 'UK CPI Y/Y', type: EventType.Indicator, sector: EventSector.Prices, importance: EventImportance.High, frequency: EventFrequency.Month, timeMode: EventTimeMode.DateTime, unit: EventUnit.Percent, multiplier: EventMultiplier.None, digits: 1, externalIds: { slug: 'uk-cpi' }, description: 'UK Consumer Price Index year-over-year change', ...GB },
  { id: 'GB.PRICES.CPI_MOM', name: 'UK CPI M/M', type: EventType.Indicator, sector: EventSector.Prices, importance: EventImportance.Moderate, frequency: EventFrequency.Month, timeMode: EventTimeMode.DateTime, unit: EventUnit.Percent, multiplier: EventMultiplier.None, digits: 1, description: 'UK Consumer Price Index month-over-month change', ...GB },
  { id: 'GB.PRICES.CORE_CPI_YOY', name: 'UK Core CPI Y/Y', type: EventType.Indicator, sector: EventSector.Prices, importance: EventImportance.High, frequency: EventFrequency.Month, timeMode: EventTimeMode.DateTime, unit: EventUnit.Percent, multiplier: EventMultiplier.None, digits: 1, description: 'UK Core Consumer Price Index (excl. energy, food, alcohol, tobacco) year-over-year change', ...GB },
  { id: 'GB.PRICES.PPI_INPUT_MOM', name: 'UK PPI Input M/M', type: EventType.Indicator, sector: EventSector.Prices, importance: EventImportance.Low, frequency: EventFrequency.Month, timeMode: EventTimeMode.DateTime, unit: EventUnit.Percent, multiplier: EventMultiplier.None, digits: 1, description: 'UK Producer Price Index input prices month-over-month change', ...GB },
  { id: 'GB.PRICES.PPI_OUTPUT_MOM', name: 'UK PPI Output M/M', type: EventType.Indicator, sector: EventSector.Prices, importance: EventImportance.Low, frequency: EventFrequency.Month, timeMode: EventTimeMode.DateTime, unit: EventUnit.Percent, multiplier: EventMultiplier.None, digits: 1, description: 'UK Producer Price Index output prices month-over-month change', ...GB },
] as const;

const GDP_EVENTS: readonly EventDefinition[] = [
  { id: 'GB.GDP.GDP_MOM', name: 'UK GDP M/M', type: EventType.Indicator, sector: EventSector.GDP, importance: EventImportance.Moderate, frequency: EventFrequency.Month, timeMode: EventTimeMode.DateTime, unit: EventUnit.Percent, multiplier: EventMultiplier.None, digits: 1, externalIds: { slug: 'uk-gdp' }, description: 'UK Gross Domestic Product month-over-month change', ...GB },
  { id: 'GB.GDP.GDP_QOQ', name: 'UK GDP Q/Q', type: EventType.Indicator, sector: EventSector.GDP, importance: EventImportance.Moderate, frequency: EventFrequency.Quarter, timeMode: EventTimeMode.DateTime, unit: EventUnit.Percent, multiplier: EventMultiplier.None, digits: 1, description: 'UK Gross Domestic Product quarter-over-quarter change', ...GB },
  { id: 'GB.GDP.GDP_YOY', name: 'UK GDP Y/Y', type: EventType.Indicator, sector: EventSector.GDP, importance: EventImportance.Moderate, frequency: EventFrequency.Quarter, timeMode: EventTimeMode.DateTime, unit: EventUnit.Percent, multiplier: EventMultiplier.None, digits: 1, description: 'UK Gross Domestic Product year-over-year change', ...GB },
] as const;

const JOBS_EVENTS: readonly EventDefinition[] = [
  { id: 'GB.JOBS.UNEMPLOYMENT_RATE', name: 'UK Unemployment Rate', type: EventType.Indicator, sector: EventSector.Jobs, importance: EventImportance.Moderate, frequency: EventFrequency.Month, timeMode: EventTimeMode.DateTime, unit: EventUnit.Percent, multiplier: EventMultiplier.None, digits: 1, description: 'UK ILO unemployment rate', ...GB },
  { id: 'GB.JOBS.CLAIMANT_COUNT', name: 'UK Claimant Count Change', type: EventType.Indicator, sector: EventSector.Jobs, importance: EventImportance.Moderate, frequency: EventFrequency.Month, timeMode: EventTimeMode.DateTime, unit: EventUnit.People, multiplier: EventMultiplier.Thousands, digits: 1, description: 'UK change in the number of people claiming unemployment benefits', ...GB },
  { id: 'GB.JOBS.AVG_EARNINGS', name: 'UK Average Earnings Index', type: EventType.Indicator, sector: EventSector.Jobs, importance: EventImportance.Moderate, frequency: EventFrequency.Month, timeMode: EventTimeMode.DateTime, unit: EventUnit.Percent, multiplier: EventMultiplier.None, digits: 1, description: 'UK average earnings including bonuses 3-month year-over-year change', ...GB },
] as const;

const BUSINESS_EVENTS: readonly EventDefinition[] = [
  { id: 'GB.BUSINESS.MFG_PMI', name: 'UK Manufacturing PMI', type: EventType.Indicator, sector: EventSector.Business, importance: EventImportance.Low, frequency: EventFrequency.Month, timeMode: EventTimeMode.DateTime, unit: EventUnit.None, multiplier: EventMultiplier.None, digits: 1, externalIds: { slug: 'uk-pmi' }, description: 'UK S&P Global Manufacturing Purchasing Managers Index', ...GB },
  { id: 'GB.BUSINESS.SERVICES_PMI', name: 'UK Services PMI', type: EventType.Indicator, sector: EventSector.Business, importance: EventImportance.Low, frequency: EventFrequency.Month, timeMode: EventTimeMode.DateTime, unit: EventUnit.None, multiplier: EventMultiplier.None, digits: 1, description: 'UK S&P Global Services Purchasing Managers Index', ...GB },
  { id: 'GB.BUSINESS.COMPOSITE_PMI', name: 'UK Composite PMI', type: EventType.Indicator, sector: EventSector.Business, importance: EventImportance.Low, frequency: EventFrequency.Month, timeMode: EventTimeMode.DateTime, unit: EventUnit.None, multiplier: EventMultiplier.None, digits: 1, description: 'UK S&P Global Composite Purchasing Managers Index', ...GB },
  { id: 'GB.BUSINESS.INDUSTRIAL_PRODUCTION_MOM', name: 'UK Industrial Production M/M', type: EventType.Indicator, sector: EventSector.Business, importance: EventImportance.Low, frequency: EventFrequency.Month, timeMode: EventTimeMode.DateTime, unit: EventUnit.Percent, multiplier: EventMultiplier.None, digits: 1, description: 'UK industrial production month-over-month change', ...GB },
  { id: 'GB.BUSINESS.MFG_PRODUCTION_MOM', name: 'UK Manufacturing Production M/M', type: EventType.Indicator, sector: EventSector.Business, importance: EventImportance.Low, frequency: EventFrequency.Month, timeMode: EventTimeMode.DateTime, unit: EventUnit.Percent, multiplier: EventMultiplier.None, digits: 1, description: 'UK manufacturing production month-over-month change', ...GB },
] as const;

const CONSUMER_EVENTS: readonly EventDefinition[] = [
  { id: 'GB.CONSUMER.RETAIL_SALES_MOM', name: 'UK Retail Sales M/M', type: EventType.Indicator, sector: EventSector.Consumer, importance: EventImportance.Moderate, frequency: EventFrequency.Month, timeMode: EventTimeMode.DateTime, unit: EventUnit.Percent, multiplier: EventMultiplier.None, digits: 1, description: 'UK retail sales month-over-month change', ...GB },
  { id: 'GB.CONSUMER.RETAIL_SALES_YOY', name: 'UK Retail Sales Y/Y', type: EventType.Indicator, sector: EventSector.Consumer, importance: EventImportance.Low, frequency: EventFrequency.Month, timeMode: EventTimeMode.DateTime, unit: EventUnit.Percent, multiplier: EventMultiplier.None, digits: 1, description: 'UK retail sales year-over-year change', ...GB },
  { id: 'GB.CONSUMER.GFK_CONFIDENCE', name: 'UK GfK Consumer Confidence', type: EventType.Indicator, sector: EventSector.Consumer, importance: EventImportance.Low, frequency: EventFrequency.Month, timeMode: EventTimeMode.DateTime, unit: EventUnit.None, multiplier: EventMultiplier.None, digits: 0, description: 'GfK UK Consumer Confidence Index', ...GB },
] as const;

const TRADE_EVENTS: readonly EventDefinition[] = [
  { id: 'GB.TRADE.TRADE_BALANCE', name: 'UK Trade Balance', type: EventType.Indicator, sector: EventSector.Trade, importance: EventImportance.Low, frequency: EventFrequency.Month, timeMode: EventTimeMode.DateTime, unit: EventUnit.Currency, multiplier: EventMultiplier.Billions, digits: 1, description: 'UK trade balance (exports minus imports)', ...GB },
] as const;

const HOUSING_EVENTS: readonly EventDefinition[] = [
  { id: 'GB.HOUSING.HPI_YOY', name: 'UK Housing Price Index Y/Y', type: EventType.Indicator, sector: EventSector.Housing, importance: EventImportance.Low, frequency: EventFrequency.Month, timeMode: EventTimeMode.DateTime, unit: EventUnit.Percent, multiplier: EventMultiplier.None, digits: 1, description: 'UK Nationwide Housing Price Index year-over-year change', ...GB },
] as const;

const HOLIDAYS_EVENTS: readonly EventDefinition[] = [
  { id: 'GB.HOLIDAYS.MAY_BANK', name: 'May Bank Holiday', type: EventType.Holiday, sector: EventSector.Holidays, importance: EventImportance.None, frequency: EventFrequency.Year, timeMode: EventTimeMode.Date, unit: EventUnit.None, multiplier: EventMultiplier.None, digits: 0, description: 'Early May Bank Holiday — UK markets closed', ...GB },
  { id: 'GB.HOLIDAYS.SPRING_BANK', name: 'Spring Bank Holiday', type: EventType.Holiday, sector: EventSector.Holidays, importance: EventImportance.None, frequency: EventFrequency.Year, timeMode: EventTimeMode.Date, unit: EventUnit.None, multiplier: EventMultiplier.None, digits: 0, description: 'Spring Bank Holiday — UK markets closed', ...GB },
  { id: 'GB.HOLIDAYS.SUMMER_BANK', name: 'Summer Bank Holiday', type: EventType.Holiday, sector: EventSector.Holidays, importance: EventImportance.None, frequency: EventFrequency.Year, timeMode: EventTimeMode.Date, unit: EventUnit.None, multiplier: EventMultiplier.None, digits: 0, description: 'Summer Bank Holiday — UK markets closed', ...GB },
] as const;

export const GB_EVENTS: readonly EventDefinition[] = [
  ...MONEY_EVENTS,
  ...PRICES_EVENTS,
  ...GDP_EVENTS,
  ...JOBS_EVENTS,
  ...BUSINESS_EVENTS,
  ...CONSUMER_EVENTS,
  ...TRADE_EVENTS,
  ...HOUSING_EVENTS,
  ...HOLIDAYS_EVENTS,
] as const;
