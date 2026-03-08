import type { EventDefinition } from './types.js';
import {
  EventDomain, EventFrequency, EventImportance, EventMultiplier,
  EventSector, EventTimeMode, EventType, EventUnit,
} from './types.js';

const COMMODITY_BASE = {
  sector: EventSector.Commodity,
  domain: EventDomain.Commodity,
  timeMode: EventTimeMode.Tentative,
  unit: EventUnit.None,
  multiplier: EventMultiplier.None,
  digits: 0,
  currency: 'ALL',
} as const;

const IND = { type: EventType.Indicator, ...COMMODITY_BASE } as const;
const EVT = { type: EventType.Event, ...COMMODITY_BASE } as const;
const US_IND = { ...IND, countryCode: 'US' as const, countryId: 840 };
const GB_IND = { ...IND, countryCode: 'GB' as const, countryId: 826 };

export const COMMODITY_EVENTS: readonly EventDefinition[] = [
  // Energy
  { id: 'COMMODITY.COMMODITY.EIA_PETROLEUM', name: 'EIA Weekly Petroleum Report', importance: EventImportance.High, frequency: EventFrequency.Week, description: 'EIA weekly petroleum status report (crude inventories, production, refinery utilization)', ...US_IND },
  { id: 'COMMODITY.COMMODITY.EIA_NATGAS', name: 'EIA Natural Gas Storage Report', importance: EventImportance.High, frequency: EventFrequency.Week, description: 'EIA weekly natural gas storage report (underground storage levels)', ...US_IND },
  { id: 'COMMODITY.COMMODITY.API_PETROLEUM', name: 'API Weekly Petroleum Report', importance: EventImportance.Moderate, frequency: EventFrequency.Week, description: 'API weekly petroleum inventory report (precedes official EIA data)', ...IND },
  { id: 'COMMODITY.COMMODITY.BAKER_HUGHES_RIG', name: 'Baker Hughes Rig Count', importance: EventImportance.Moderate, frequency: EventFrequency.Week, description: 'Baker Hughes North American active drilling rig count', ...IND },
  { id: 'COMMODITY.COMMODITY.SPR_RELEASE', name: 'Strategic Petroleum Reserve Release', importance: EventImportance.High, frequency: EventFrequency.None, description: 'U.S. Strategic Petroleum Reserve emergency release announcement', ...{ ...EVT, countryCode: 'US' as const, countryId: 840 } },
  { id: 'COMMODITY.COMMODITY.SPR_PURCHASE', name: 'Strategic Petroleum Reserve Purchase', importance: EventImportance.Moderate, frequency: EventFrequency.None, description: 'U.S. Strategic Petroleum Reserve replenishment purchase announcement', ...{ ...EVT, countryCode: 'US' as const, countryId: 840 } },
  { id: 'COMMODITY.COMMODITY.REFINERY_OUTAGE', name: 'Major Refinery Outage', importance: EventImportance.High, frequency: EventFrequency.None, description: 'Significant refinery outage or unplanned shutdown affecting product supply', ...EVT },
  { id: 'COMMODITY.COMMODITY.PIPELINE_DISRUPTION', name: 'Pipeline Disruption', importance: EventImportance.High, frequency: EventFrequency.None, description: 'Major oil or gas pipeline disruption (leak, explosion, closure)', ...EVT },
  // Agriculture
  { id: 'COMMODITY.COMMODITY.USDA_WASDE', name: 'USDA WASDE Report', importance: EventImportance.High, frequency: EventFrequency.Month, description: 'USDA World Agricultural Supply and Demand Estimates report', ...US_IND },
  { id: 'COMMODITY.COMMODITY.USDA_CROP_PROGRESS', name: 'USDA Crop Progress Report', importance: EventImportance.Moderate, frequency: EventFrequency.Week, description: 'USDA weekly crop progress and condition report (April-November)', ...US_IND },
  { id: 'COMMODITY.COMMODITY.USDA_GRAIN_STOCKS', name: 'USDA Grain Stocks Report', importance: EventImportance.Moderate, frequency: EventFrequency.Quarter, description: 'USDA quarterly grain stocks report (wheat, corn, soybeans, sorghum)', ...US_IND },
  { id: 'COMMODITY.COMMODITY.USDA_ACREAGE', name: 'USDA Acreage Report', importance: EventImportance.High, frequency: EventFrequency.Year, description: 'USDA planted and harvested acreage report for major crops', ...US_IND },
  { id: 'COMMODITY.COMMODITY.USDA_EXPORT_SALES', name: 'USDA Export Sales Report', importance: EventImportance.Moderate, frequency: EventFrequency.Week, description: 'USDA weekly export sales report for major agricultural commodities', ...US_IND },
  { id: 'COMMODITY.COMMODITY.USDA_COLD_STORAGE', name: 'USDA Cold Storage Report', importance: EventImportance.Low, frequency: EventFrequency.Month, description: 'USDA monthly cold storage report (frozen food inventory levels)', ...US_IND },
  { id: 'COMMODITY.COMMODITY.USDA_LIVESTOCK', name: 'USDA Livestock Report', importance: EventImportance.Moderate, frequency: EventFrequency.Quarter, description: 'USDA quarterly cattle, hog, and poultry inventory report', ...US_IND },
  { id: 'COMMODITY.COMMODITY.CROP_CONDITION', name: 'Crop Condition Alert', importance: EventImportance.High, frequency: EventFrequency.None, description: 'Significant crop condition deterioration or improvement alert', ...EVT },
  // Metals
  { id: 'COMMODITY.COMMODITY.LBMA_GOLD_FIX', name: 'LBMA Gold Price Fix', importance: EventImportance.Moderate, frequency: EventFrequency.Day, description: 'London Bullion Market Association gold price fixing (AM/PM)', ...GB_IND },
  { id: 'COMMODITY.COMMODITY.LBMA_SILVER_FIX', name: 'LBMA Silver Price Fix', importance: EventImportance.Moderate, frequency: EventFrequency.Day, description: 'London Bullion Market Association silver price fixing', ...GB_IND },
  { id: 'COMMODITY.COMMODITY.COMEX_DELIVERY', name: 'COMEX Metals Delivery Period', importance: EventImportance.Moderate, frequency: EventFrequency.Month, description: 'COMEX precious metals futures delivery period (first notice to last trading day)', ...IND },
  { id: 'COMMODITY.COMMODITY.CENTRAL_BANK_GOLD', name: 'Central Bank Gold Purchase/Sale', importance: EventImportance.High, frequency: EventFrequency.None, description: 'Major central bank gold reserve purchase or sale announcement', ...EVT },
  { id: 'COMMODITY.COMMODITY.LME_INVENTORY', name: 'LME Metals Inventory Report', importance: EventImportance.Moderate, frequency: EventFrequency.Day, description: 'London Metal Exchange warehouse inventory report (copper, aluminum, zinc, nickel)', ...IND },
  { id: 'COMMODITY.COMMODITY.MINING_DISRUPTION', name: 'Major Mining Disruption', importance: EventImportance.High, frequency: EventFrequency.None, description: 'Significant mining operation disruption (strike, accident, environmental closure)', ...EVT },
  { id: 'COMMODITY.COMMODITY.PRECIOUS_METALS_ETF', name: 'Precious Metals ETF Flow', importance: EventImportance.Moderate, frequency: EventFrequency.None, description: 'Significant inflow or outflow from precious metals ETFs (GLD, SLV)', ...IND },
  { id: 'COMMODITY.COMMODITY.CFTC_COT', name: 'CFTC Commitments of Traders', importance: EventImportance.Moderate, frequency: EventFrequency.Week, description: 'CFTC weekly Commitments of Traders report (speculative and commercial positioning)', ...IND },
  // Weather/seasonal
  { id: 'COMMODITY.COMMODITY.HURRICANE_SEASON', name: 'Hurricane Season Outlook', importance: EventImportance.Moderate, frequency: EventFrequency.Year, description: 'NOAA Atlantic hurricane season outlook release (June)', ...EVT },
  { id: 'COMMODITY.COMMODITY.HURRICANE_LANDFALL', name: 'Hurricane Landfall (Gulf)', importance: EventImportance.High, frequency: EventFrequency.None, description: 'Hurricane landfall in Gulf of Mexico region (affects oil production and refining)', ...EVT },
  { id: 'COMMODITY.COMMODITY.DROUGHT_OUTLOOK', name: 'Drought Outlook Release', importance: EventImportance.Moderate, frequency: EventFrequency.Month, description: 'NOAA seasonal drought outlook for major agricultural regions', ...IND },
  { id: 'COMMODITY.COMMODITY.FROST_FREEZE', name: 'Frost/Freeze Event', importance: EventImportance.High, frequency: EventFrequency.None, description: 'Frost or freeze event affecting vulnerable crops (coffee, oranges, corn, soybeans)', ...EVT },
  { id: 'COMMODITY.COMMODITY.FLOOD_EVENT', name: 'Major Flood Event', importance: EventImportance.High, frequency: EventFrequency.None, description: 'Major flooding affecting agricultural regions or commodity infrastructure', ...EVT },
  { id: 'COMMODITY.COMMODITY.EL_NINO_UPDATE', name: 'El Nino/La Nina Update', importance: EventImportance.Moderate, frequency: EventFrequency.Month, description: 'NOAA El Nino/La Nina advisory update affecting global weather patterns', ...IND },
  { id: 'COMMODITY.COMMODITY.PLANTING_SEASON', name: 'Planting Season Start', importance: EventImportance.Low, frequency: EventFrequency.Year, description: 'Start of major crop planting season (affects supply forecasts)', ...EVT },
  { id: 'COMMODITY.COMMODITY.HARVEST_SEASON', name: 'Harvest Season Start', importance: EventImportance.Low, frequency: EventFrequency.Year, description: 'Start of major crop harvest season (affects near-term supply)', ...EVT },
  // Supply chain / trade
  { id: 'COMMODITY.COMMODITY.SHIPPING_DISRUPTION', name: 'Major Shipping Route Disruption', importance: EventImportance.High, frequency: EventFrequency.None, description: 'Disruption to major shipping routes (Suez, Panama, Strait of Hormuz)', ...EVT },
  { id: 'COMMODITY.COMMODITY.PORT_CONGESTION', name: 'Port Congestion Event', importance: EventImportance.Moderate, frequency: EventFrequency.None, description: 'Significant port congestion affecting commodity logistics and delivery', ...EVT },
  { id: 'COMMODITY.COMMODITY.TRADE_EMBARGO', name: 'Commodity Trade Embargo/Sanction', importance: EventImportance.High, frequency: EventFrequency.None, description: 'Government-imposed commodity trade embargo or sanction', ...EVT },
  { id: 'COMMODITY.COMMODITY.EXPORT_BAN', name: 'Agricultural Export Ban', importance: EventImportance.High, frequency: EventFrequency.None, description: 'Country restricts or bans agricultural commodity exports', ...EVT },
  // Production / inventory
  { id: 'COMMODITY.COMMODITY.OPEC_PRODUCTION', name: 'OPEC Monthly Production Data', importance: EventImportance.Moderate, frequency: EventFrequency.Month, description: 'OPEC monthly oil market report with production data by member country', ...IND },
  { id: 'COMMODITY.COMMODITY.IEA_OIL_REPORT', name: 'IEA Monthly Oil Market Report', importance: EventImportance.High, frequency: EventFrequency.Month, description: 'International Energy Agency monthly oil market report (supply, demand, forecasts)', ...IND },
  { id: 'COMMODITY.COMMODITY.CHINA_COMMODITY_IMPORT', name: 'China Commodity Import Data', importance: EventImportance.High, frequency: EventFrequency.Month, description: 'China monthly commodity import data (oil, iron ore, copper, soybeans)', ...IND },
  { id: 'COMMODITY.COMMODITY.INDIA_GOLD_IMPORT', name: 'India Gold Import Data', importance: EventImportance.Moderate, frequency: EventFrequency.Month, description: 'India monthly gold import data (major demand driver for gold markets)', ...IND },
  // Carbon / new energy
  { id: 'COMMODITY.COMMODITY.CARBON_CREDIT_AUCTION', name: 'Carbon Credit Auction (EU ETS)', importance: EventImportance.Moderate, frequency: EventFrequency.Month, description: 'EU Emissions Trading System carbon credit auction', ...IND },
  { id: 'COMMODITY.COMMODITY.RENEWABLE_CAPACITY', name: 'Renewable Energy Capacity Update', importance: EventImportance.Low, frequency: EventFrequency.Quarter, description: 'IEA/IRENA renewable energy capacity and deployment update', ...IND },
  { id: 'COMMODITY.COMMODITY.LITHIUM_SUPPLY', name: 'Lithium/Battery Metal Supply Update', importance: EventImportance.Moderate, frequency: EventFrequency.None, description: 'Significant lithium or battery metals supply update (mine output, processing capacity)', ...EVT },
  { id: 'COMMODITY.COMMODITY.RARE_EARTH_SUPPLY', name: 'Rare Earth Supply Update', importance: EventImportance.Moderate, frequency: EventFrequency.None, description: 'Rare earth elements supply update (China export controls, new mine developments)', ...EVT },
  // Soft commodities
  { id: 'COMMODITY.COMMODITY.ICO_COFFEE_REPORT', name: 'ICO Coffee Market Report', importance: EventImportance.Moderate, frequency: EventFrequency.Month, description: 'International Coffee Organization monthly market report', ...IND },
  { id: 'COMMODITY.COMMODITY.ISO_SUGAR_REPORT', name: 'ISO Sugar Market Report', importance: EventImportance.Moderate, frequency: EventFrequency.Month, description: 'International Sugar Organization market report and balance update', ...IND },
  { id: 'COMMODITY.COMMODITY.ICCO_COCOA_REPORT', name: 'ICCO Cocoa Market Report', importance: EventImportance.Moderate, frequency: EventFrequency.Month, description: 'International Cocoa Organization quarterly market report', ...IND },
  { id: 'COMMODITY.COMMODITY.COTTON_STOCKS', name: 'USDA Cotton On-Call Report', importance: EventImportance.Low, frequency: EventFrequency.Month, description: 'USDA cotton on-call and stocks report', ...{ ...IND, countryCode: 'US' as const, countryId: 840 } },
] as const;
