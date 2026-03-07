import type { EventDefinition } from './types.js';
import {
  EventDomain, EventFrequency, EventImportance, EventMultiplier,
  EventSector, EventTimeMode, EventType, EventUnit,
} from './types.js';

const EU = {
  countryCode: 'EU' as const,
  countryId: 999,
  currency: 'EUR' as const,
  domain: EventDomain.Economic,
};

const DE = {
  countryCode: 'DE' as const,
  countryId: 276,
  currency: 'EUR' as const,
  domain: EventDomain.Economic,
};

const MONEY_EVENTS: readonly EventDefinition[] = [
  { id: 'EU.MONEY.ECB_RATE', name: 'ECB Interest Rate Decision', type: EventType.Indicator, sector: EventSector.Money, importance: EventImportance.High, frequency: EventFrequency.Quarter, timeMode: EventTimeMode.DateTime, unit: EventUnit.Percent, multiplier: EventMultiplier.None, digits: 2, externalIds: { slug: 'ecb-rate' }, description: 'European Central Bank main refinancing rate decision', ...EU },
  { id: 'EU.MONEY.ECB_PRESS_CONF', name: 'ECB Press Conference', type: EventType.Event, sector: EventSector.Money, importance: EventImportance.High, frequency: EventFrequency.Quarter, timeMode: EventTimeMode.DateTime, unit: EventUnit.None, multiplier: EventMultiplier.None, digits: 0, description: 'ECB President press conference following rate decision', ...EU },
  { id: 'EU.MONEY.ECB_POLICY_STATEMENT', name: 'ECB Monetary Policy Statement', type: EventType.Event, sector: EventSector.Money, importance: EventImportance.High, frequency: EventFrequency.Quarter, timeMode: EventTimeMode.DateTime, unit: EventUnit.None, multiplier: EventMultiplier.None, digits: 0, description: 'ECB monetary policy statement and forward guidance', ...EU },
  { id: 'EU.MONEY.ECB_PRESIDENT_SPEECH', name: 'ECB President Speech', type: EventType.Event, sector: EventSector.Money, importance: EventImportance.Moderate, frequency: EventFrequency.Month, timeMode: EventTimeMode.DateTime, unit: EventUnit.None, multiplier: EventMultiplier.None, digits: 0, description: 'Speech by the ECB President', ...EU },
  { id: 'EU.MONEY.ECB_SUPERVISORY_SPEECH', name: 'ECB Supervisory Board Speech', type: EventType.Event, sector: EventSector.Money, importance: EventImportance.Low, frequency: EventFrequency.Month, timeMode: EventTimeMode.DateTime, unit: EventUnit.None, multiplier: EventMultiplier.None, digits: 0, description: 'Speech by an ECB Supervisory Board member', ...EU },
] as const;

const GDP_EVENTS: readonly EventDefinition[] = [
  { id: 'EU.GDP.GDP_QOQ', name: 'EU GDP Q/Q', type: EventType.Indicator, sector: EventSector.GDP, importance: EventImportance.Moderate, frequency: EventFrequency.Quarter, timeMode: EventTimeMode.DateTime, unit: EventUnit.Percent, multiplier: EventMultiplier.None, digits: 1, externalIds: { slug: 'eu-gdp' }, description: 'Eurozone Gross Domestic Product quarter-over-quarter change', ...EU },
  { id: 'EU.GDP.GDP_YOY', name: 'EU GDP Y/Y', type: EventType.Indicator, sector: EventSector.GDP, importance: EventImportance.Moderate, frequency: EventFrequency.Quarter, timeMode: EventTimeMode.DateTime, unit: EventUnit.Percent, multiplier: EventMultiplier.None, digits: 1, description: 'Eurozone Gross Domestic Product year-over-year change', ...EU },
] as const;

const PRICES_EVENTS: readonly EventDefinition[] = [
  { id: 'EU.PRICES.CPI_YOY', name: 'EU CPI Y/Y', type: EventType.Indicator, sector: EventSector.Prices, importance: EventImportance.High, frequency: EventFrequency.Month, timeMode: EventTimeMode.DateTime, unit: EventUnit.Percent, multiplier: EventMultiplier.None, digits: 1, description: 'Eurozone Consumer Price Index year-over-year change', ...EU },
  { id: 'EU.PRICES.CORE_CPI_YOY', name: 'EU Core CPI Y/Y', type: EventType.Indicator, sector: EventSector.Prices, importance: EventImportance.High, frequency: EventFrequency.Month, timeMode: EventTimeMode.DateTime, unit: EventUnit.Percent, multiplier: EventMultiplier.None, digits: 1, description: 'Eurozone Core Consumer Price Index (excl. energy, food, alcohol, tobacco) year-over-year change', ...EU },
  { id: 'EU.PRICES.CPI_MOM', name: 'EU CPI M/M', type: EventType.Indicator, sector: EventSector.Prices, importance: EventImportance.Moderate, frequency: EventFrequency.Month, timeMode: EventTimeMode.DateTime, unit: EventUnit.Percent, multiplier: EventMultiplier.None, digits: 1, description: 'Eurozone Consumer Price Index month-over-month change', ...EU },
  { id: 'EU.PRICES.PPI_MOM', name: 'EU PPI M/M', type: EventType.Indicator, sector: EventSector.Prices, importance: EventImportance.Low, frequency: EventFrequency.Month, timeMode: EventTimeMode.DateTime, unit: EventUnit.Percent, multiplier: EventMultiplier.None, digits: 1, description: 'Eurozone Producer Price Index month-over-month change', ...EU },
  { id: 'EU.PRICES.PPI_YOY', name: 'EU PPI Y/Y', type: EventType.Indicator, sector: EventSector.Prices, importance: EventImportance.Low, frequency: EventFrequency.Month, timeMode: EventTimeMode.DateTime, unit: EventUnit.Percent, multiplier: EventMultiplier.None, digits: 1, description: 'Eurozone Producer Price Index year-over-year change', ...EU },
] as const;

const JOBS_EVENTS: readonly EventDefinition[] = [
  { id: 'EU.JOBS.UNEMPLOYMENT_RATE', name: 'EU Unemployment Rate', type: EventType.Indicator, sector: EventSector.Jobs, importance: EventImportance.Moderate, frequency: EventFrequency.Month, timeMode: EventTimeMode.DateTime, unit: EventUnit.Percent, multiplier: EventMultiplier.None, digits: 1, description: 'Eurozone unemployment rate', ...EU },
] as const;

const BUSINESS_EVENTS: readonly EventDefinition[] = [
  { id: 'EU.BUSINESS.MFG_PMI', name: 'EU Manufacturing PMI', type: EventType.Indicator, sector: EventSector.Business, importance: EventImportance.Low, frequency: EventFrequency.Month, timeMode: EventTimeMode.DateTime, unit: EventUnit.None, multiplier: EventMultiplier.None, digits: 1, externalIds: { slug: 'eu-pmi' }, description: 'Eurozone Manufacturing Purchasing Managers Index', ...EU },
  { id: 'EU.BUSINESS.SERVICES_PMI', name: 'EU Services PMI', type: EventType.Indicator, sector: EventSector.Business, importance: EventImportance.Low, frequency: EventFrequency.Month, timeMode: EventTimeMode.DateTime, unit: EventUnit.None, multiplier: EventMultiplier.None, digits: 1, description: 'Eurozone Services Purchasing Managers Index', ...EU },
  { id: 'EU.BUSINESS.COMPOSITE_PMI', name: 'EU Composite PMI', type: EventType.Indicator, sector: EventSector.Business, importance: EventImportance.Low, frequency: EventFrequency.Month, timeMode: EventTimeMode.DateTime, unit: EventUnit.None, multiplier: EventMultiplier.None, digits: 1, description: 'Eurozone Composite Purchasing Managers Index', ...EU },
  { id: 'EU.BUSINESS.INDUSTRIAL_PRODUCTION_MOM', name: 'EU Industrial Production M/M', type: EventType.Indicator, sector: EventSector.Business, importance: EventImportance.Low, frequency: EventFrequency.Month, timeMode: EventTimeMode.DateTime, unit: EventUnit.Percent, multiplier: EventMultiplier.None, digits: 1, description: 'Eurozone industrial production month-over-month change', ...EU },
] as const;

const CONSUMER_EVENTS: readonly EventDefinition[] = [
  { id: 'EU.CONSUMER.RETAIL_SALES_MOM', name: 'EU Retail Sales M/M', type: EventType.Indicator, sector: EventSector.Consumer, importance: EventImportance.Low, frequency: EventFrequency.Month, timeMode: EventTimeMode.DateTime, unit: EventUnit.Percent, multiplier: EventMultiplier.None, digits: 1, description: 'Eurozone retail sales month-over-month change', ...EU },
  { id: 'EU.CONSUMER.RETAIL_SALES_YOY', name: 'EU Retail Sales Y/Y', type: EventType.Indicator, sector: EventSector.Consumer, importance: EventImportance.Low, frequency: EventFrequency.Month, timeMode: EventTimeMode.DateTime, unit: EventUnit.Percent, multiplier: EventMultiplier.None, digits: 1, description: 'Eurozone retail sales year-over-year change', ...EU },
  { id: 'EU.CONSUMER.CONSUMER_CONFIDENCE', name: 'EU Consumer Confidence', type: EventType.Indicator, sector: EventSector.Consumer, importance: EventImportance.Low, frequency: EventFrequency.Month, timeMode: EventTimeMode.DateTime, unit: EventUnit.None, multiplier: EventMultiplier.None, digits: 1, description: 'Eurozone consumer confidence indicator', ...EU },
] as const;

const TRADE_EVENTS: readonly EventDefinition[] = [
  { id: 'EU.TRADE.TRADE_BALANCE', name: 'EU Trade Balance', type: EventType.Indicator, sector: EventSector.Trade, importance: EventImportance.Low, frequency: EventFrequency.Month, timeMode: EventTimeMode.DateTime, unit: EventUnit.Currency, multiplier: EventMultiplier.Billions, digits: 1, description: 'Eurozone trade balance (exports minus imports)', ...EU },
] as const;

const SENTIMENT_EVENTS: readonly EventDefinition[] = [
  { id: 'EU.SENTIMENT.SENTIX', name: 'EU Sentix Investor Confidence', type: EventType.Indicator, sector: EventSector.Sentiment, importance: EventImportance.Low, frequency: EventFrequency.Month, timeMode: EventTimeMode.DateTime, unit: EventUnit.None, multiplier: EventMultiplier.None, digits: 1, description: 'Sentix Investor Confidence Index for the Eurozone', ...EU },
  { id: 'EU.SENTIMENT.ZEW', name: 'EU ZEW Economic Sentiment', type: EventType.Indicator, sector: EventSector.Sentiment, importance: EventImportance.Low, frequency: EventFrequency.Month, timeMode: EventTimeMode.DateTime, unit: EventUnit.None, multiplier: EventMultiplier.None, digits: 1, description: 'ZEW Economic Sentiment Index for the Eurozone', ...EU },
] as const;

const GEOPOLITICAL_EVENTS: readonly EventDefinition[] = [
  { id: 'EU.GEOPOLITICAL.EU_LEADERS_SUMMIT', name: 'EU Leaders Summit', type: EventType.Event, sector: EventSector.Geopolitical, importance: EventImportance.Moderate, frequency: EventFrequency.Quarter, timeMode: EventTimeMode.Date, unit: EventUnit.None, multiplier: EventMultiplier.None, digits: 0, description: 'European Council leaders summit', ...EU },
  { id: 'EU.GEOPOLITICAL.EUROGROUP', name: 'Eurogroup Meeting', type: EventType.Event, sector: EventSector.Geopolitical, importance: EventImportance.Low, frequency: EventFrequency.Month, timeMode: EventTimeMode.Date, unit: EventUnit.None, multiplier: EventMultiplier.None, digits: 0, description: 'Eurogroup finance ministers meeting', ...EU },
  { id: 'EU.GOVERNMENT.EU_FISCAL_COMPACT', name: 'EU Fiscal Compact Event', type: EventType.Event, sector: EventSector.Government, importance: EventImportance.Moderate, frequency: EventFrequency.None, timeMode: EventTimeMode.Date, unit: EventUnit.None, multiplier: EventMultiplier.None, digits: 0, description: 'EU fiscal compact or stability pact negotiation/violation event', ...EU },
  { id: 'DE.FUTURES.HEXENSABBAT', name: 'Hexensabbat', type: EventType.Event, sector: EventSector.Futures, importance: EventImportance.Moderate, frequency: EventFrequency.Quarter, timeMode: EventTimeMode.Date, unit: EventUnit.None, multiplier: EventMultiplier.None, digits: 0, description: 'German triple witching (Großer Verfallstag)', ...DE },
] as const;

export const EU_EVENTS: readonly EventDefinition[] = [
  ...MONEY_EVENTS,
  ...GDP_EVENTS,
  ...PRICES_EVENTS,
  ...JOBS_EVENTS,
  ...BUSINESS_EVENTS,
  ...CONSUMER_EVENTS,
  ...TRADE_EVENTS,
  ...SENTIMENT_EVENTS,
  ...GEOPOLITICAL_EVENTS,
] as const;
