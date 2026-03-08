import type { EventDefinition } from './types.js';
import {
  EventDomain, EventFrequency, EventImportance, EventMultiplier,
  EventSector, EventTimeMode, EventType, EventUnit,
} from './types.js';

const JP = {
  countryCode: 'JP' as const,
  countryId: 392,
  currency: 'JPY' as const,
  domain: EventDomain.Economic,
};

const MONEY_EVENTS: readonly EventDefinition[] = [
  { id: 'JP.MONEY.BOJ_RATE', name: 'BoJ Interest Rate Decision', type: EventType.Indicator, sector: EventSector.Money, importance: EventImportance.High, frequency: EventFrequency.Quarter, timeMode: EventTimeMode.DateTime, unit: EventUnit.Percent, multiplier: EventMultiplier.None, digits: 2, externalIds: { slug: 'boj-rate' }, description: 'Bank of Japan policy rate decision', ...JP },
  { id: 'JP.MONEY.BOJ_POLICY_STATEMENT', name: 'BoJ Monetary Policy Statement', type: EventType.Event, sector: EventSector.Money, importance: EventImportance.High, frequency: EventFrequency.Quarter, timeMode: EventTimeMode.DateTime, unit: EventUnit.None, multiplier: EventMultiplier.None, digits: 0, description: 'Bank of Japan monetary policy statement and outlook', ...JP },
  { id: 'JP.MONEY.BOJ_PRESS_CONF', name: 'BoJ Press Conference', type: EventType.Event, sector: EventSector.Money, importance: EventImportance.High, frequency: EventFrequency.Quarter, timeMode: EventTimeMode.DateTime, unit: EventUnit.None, multiplier: EventMultiplier.None, digits: 0, description: 'Bank of Japan Governor press conference following rate decision', ...JP },
  { id: 'JP.MONEY.BOJ_GOVERNOR_SPEECH', name: 'BoJ Governor Speech', type: EventType.Event, sector: EventSector.Money, importance: EventImportance.Moderate, frequency: EventFrequency.Month, timeMode: EventTimeMode.DateTime, unit: EventUnit.None, multiplier: EventMultiplier.None, digits: 0, description: 'Speech by the Bank of Japan Governor', ...JP },
] as const;

const GDP_EVENTS: readonly EventDefinition[] = [
  { id: 'JP.GDP.GDP_QOQ', name: 'JP GDP Q/Q', type: EventType.Indicator, sector: EventSector.GDP, importance: EventImportance.Moderate, frequency: EventFrequency.Quarter, timeMode: EventTimeMode.DateTime, unit: EventUnit.Percent, multiplier: EventMultiplier.None, digits: 1, externalIds: { slug: 'jp-gdp' }, description: 'Japan Gross Domestic Product quarter-over-quarter change', ...JP },
  { id: 'JP.GDP.GDP_YOY', name: 'JP GDP Y/Y', type: EventType.Indicator, sector: EventSector.GDP, importance: EventImportance.Moderate, frequency: EventFrequency.Quarter, timeMode: EventTimeMode.DateTime, unit: EventUnit.Percent, multiplier: EventMultiplier.None, digits: 1, description: 'Japan Gross Domestic Product year-over-year change', ...JP },
  { id: 'JP.GDP.GDP_ANNUALIZED_QOQ', name: 'JP GDP Annualized Q/Q', type: EventType.Indicator, sector: EventSector.GDP, importance: EventImportance.Moderate, frequency: EventFrequency.Quarter, timeMode: EventTimeMode.DateTime, unit: EventUnit.Percent, multiplier: EventMultiplier.None, digits: 1, description: 'Japan Gross Domestic Product annualized quarter-over-quarter change', ...JP },
] as const;

const PRICES_EVENTS: readonly EventDefinition[] = [
  { id: 'JP.PRICES.CPI_YOY', name: 'JP CPI Y/Y', type: EventType.Indicator, sector: EventSector.Prices, importance: EventImportance.Moderate, frequency: EventFrequency.Month, timeMode: EventTimeMode.DateTime, unit: EventUnit.Percent, multiplier: EventMultiplier.None, digits: 1, description: 'Japan Consumer Price Index year-over-year change', ...JP },
  { id: 'JP.PRICES.CORE_CPI_YOY', name: 'JP Core CPI Y/Y', type: EventType.Indicator, sector: EventSector.Prices, importance: EventImportance.High, frequency: EventFrequency.Month, timeMode: EventTimeMode.DateTime, unit: EventUnit.Percent, multiplier: EventMultiplier.None, digits: 1, description: 'Japan Core Consumer Price Index (excl. fresh food) year-over-year change', ...JP },
  { id: 'JP.PRICES.TOKYO_CPI_YOY', name: 'JP Tokyo CPI Y/Y', type: EventType.Indicator, sector: EventSector.Prices, importance: EventImportance.Moderate, frequency: EventFrequency.Month, timeMode: EventTimeMode.DateTime, unit: EventUnit.Percent, multiplier: EventMultiplier.None, digits: 1, description: 'Tokyo area Consumer Price Index year-over-year change (leading indicator for national CPI)', ...JP },
] as const;

const JOBS_EVENTS: readonly EventDefinition[] = [
  { id: 'JP.JOBS.UNEMPLOYMENT_RATE', name: 'JP Unemployment Rate', type: EventType.Indicator, sector: EventSector.Jobs, importance: EventImportance.Low, frequency: EventFrequency.Month, timeMode: EventTimeMode.DateTime, unit: EventUnit.Percent, multiplier: EventMultiplier.None, digits: 1, description: 'Japan unemployment rate', ...JP },
] as const;

const BUSINESS_EVENTS: readonly EventDefinition[] = [
  { id: 'JP.BUSINESS.MFG_PMI', name: 'JP Manufacturing PMI', type: EventType.Indicator, sector: EventSector.Business, importance: EventImportance.Low, frequency: EventFrequency.Month, timeMode: EventTimeMode.DateTime, unit: EventUnit.None, multiplier: EventMultiplier.None, digits: 1, externalIds: { slug: 'jp-pmi' }, description: 'Japan au Jibun Bank Manufacturing Purchasing Managers Index', ...JP },
  { id: 'JP.BUSINESS.SERVICES_PMI', name: 'JP Services PMI', type: EventType.Indicator, sector: EventSector.Business, importance: EventImportance.Low, frequency: EventFrequency.Month, timeMode: EventTimeMode.DateTime, unit: EventUnit.None, multiplier: EventMultiplier.None, digits: 1, description: 'Japan au Jibun Bank Services Purchasing Managers Index', ...JP },
  { id: 'JP.BUSINESS.TANKAN_MFG', name: 'JP Tankan Manufacturing Index', type: EventType.Indicator, sector: EventSector.Business, importance: EventImportance.Moderate, frequency: EventFrequency.Quarter, timeMode: EventTimeMode.DateTime, unit: EventUnit.None, multiplier: EventMultiplier.None, digits: 0, description: 'Bank of Japan Tankan Large Manufacturers Index', ...JP },
  { id: 'JP.BUSINESS.TANKAN_NONMFG', name: 'JP Tankan Non-Manufacturing Index', type: EventType.Indicator, sector: EventSector.Business, importance: EventImportance.Moderate, frequency: EventFrequency.Quarter, timeMode: EventTimeMode.DateTime, unit: EventUnit.None, multiplier: EventMultiplier.None, digits: 0, description: 'Bank of Japan Tankan Large Non-Manufacturers Index', ...JP },
  { id: 'JP.BUSINESS.INDUSTRIAL_PRODUCTION_MOM', name: 'JP Industrial Production M/M', type: EventType.Indicator, sector: EventSector.Business, importance: EventImportance.Low, frequency: EventFrequency.Month, timeMode: EventTimeMode.DateTime, unit: EventUnit.Percent, multiplier: EventMultiplier.None, digits: 1, description: 'Japan industrial production month-over-month change', ...JP },
  { id: 'JP.BUSINESS.MACHINE_ORDERS_MOM', name: 'JP Machine Orders M/M', type: EventType.Indicator, sector: EventSector.Business, importance: EventImportance.Low, frequency: EventFrequency.Month, timeMode: EventTimeMode.DateTime, unit: EventUnit.Percent, multiplier: EventMultiplier.None, digits: 1, description: 'Japan core machinery orders month-over-month change', ...JP },
] as const;

const CONSUMER_EVENTS: readonly EventDefinition[] = [
  { id: 'JP.CONSUMER.RETAIL_SALES_YOY', name: 'JP Retail Sales Y/Y', type: EventType.Indicator, sector: EventSector.Consumer, importance: EventImportance.Low, frequency: EventFrequency.Month, timeMode: EventTimeMode.DateTime, unit: EventUnit.Percent, multiplier: EventMultiplier.None, digits: 1, description: 'Japan retail sales year-over-year change', ...JP },
  { id: 'JP.CONSUMER.HOUSEHOLD_SPENDING_YOY', name: 'JP Household Spending Y/Y', type: EventType.Indicator, sector: EventSector.Consumer, importance: EventImportance.Low, frequency: EventFrequency.Month, timeMode: EventTimeMode.DateTime, unit: EventUnit.Percent, multiplier: EventMultiplier.None, digits: 1, description: 'Japan household spending year-over-year change', ...JP },
] as const;

const TRADE_EVENTS: readonly EventDefinition[] = [
  { id: 'JP.TRADE.TRADE_BALANCE', name: 'JP Trade Balance', type: EventType.Indicator, sector: EventSector.Trade, importance: EventImportance.Low, frequency: EventFrequency.Month, timeMode: EventTimeMode.DateTime, unit: EventUnit.Currency, multiplier: EventMultiplier.Billions, digits: 2, description: 'Japan merchandise trade balance', ...JP },
] as const;

const HOLIDAYS_EVENTS: readonly EventDefinition[] = [
  { id: 'JP.HOLIDAYS.GOLDEN_WEEK', name: 'Golden Week', type: EventType.Holiday, sector: EventSector.Holidays, importance: EventImportance.Low, frequency: EventFrequency.Year, timeMode: EventTimeMode.Date, unit: EventUnit.None, multiplier: EventMultiplier.None, digits: 0, description: 'Golden Week — Japanese markets closed', ...JP },
] as const;

export const JP_EVENTS: readonly EventDefinition[] = [
  ...MONEY_EVENTS,
  ...GDP_EVENTS,
  ...PRICES_EVENTS,
  ...JOBS_EVENTS,
  ...BUSINESS_EVENTS,
  ...CONSUMER_EVENTS,
  ...TRADE_EVENTS,
  ...HOLIDAYS_EVENTS,
] as const;
