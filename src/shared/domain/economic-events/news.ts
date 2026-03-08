import type { EventDefinition } from './types.js';
import {
  EventDomain, EventFrequency, EventImportance, EventMultiplier,
  EventSector, EventTimeMode, EventType, EventUnit,
} from './types.js';

const NEWS_BASE = {
  type: EventType.Event,
  countryCode: 'WW' as const,
  countryId: 0,
  currency: 'ALL' as const,
  domain: EventDomain.News,
  frequency: EventFrequency.None,
  timeMode: EventTimeMode.Tentative,
  unit: EventUnit.None,
  multiplier: EventMultiplier.None,
  digits: 0,
} as const;

export const NEWS_EVENTS: readonly EventDefinition[] = [
  { id: 'WW.GEOPOLITICAL.TRADE_WAR', name: 'Trade War Escalation/De-escalation', sector: EventSector.Geopolitical, importance: EventImportance.High, description: 'Trade war escalation or de-escalation between major economies', ...NEWS_BASE },
  { id: 'WW.GEOPOLITICAL.SANCTIONS', name: 'Economic Sanctions', sector: EventSector.Geopolitical, importance: EventImportance.High, description: 'Economic sanctions imposed or lifted against a country or entity', ...NEWS_BASE },
  { id: 'WW.GEOPOLITICAL.MILITARY_CONFLICT', name: 'Military Conflict Escalation', sector: EventSector.Geopolitical, importance: EventImportance.High, description: 'Armed conflict escalation with potential market impact', ...NEWS_BASE },
  { id: 'WW.GEOPOLITICAL.ELECTION', name: 'Major National Election', sector: EventSector.Geopolitical, importance: EventImportance.High, description: 'Major national election in a G20 or systemically important country', ...NEWS_BASE },
  { id: 'WW.GEOPOLITICAL.REGIME_CHANGE', name: 'Government/Regime Change', sector: EventSector.Geopolitical, importance: EventImportance.Moderate, description: 'Unexpected government or regime change', ...NEWS_BASE },
  { id: 'WW.GEOPOLITICAL.DIPLOMATIC_SUMMIT', name: 'Major Diplomatic Summit', sector: EventSector.Geopolitical, importance: EventImportance.Moderate, description: 'Major diplomatic summit with potential trade or security implications', ...NEWS_BASE },
  { id: 'WW.ENERGY.OIL_SUPPLY_SHOCK', name: 'Oil Supply Disruption', sector: EventSector.Energy, importance: EventImportance.High, description: 'Significant oil supply disruption from conflict, disaster, or embargo', ...NEWS_BASE },
  { id: 'WW.ENERGY.OPEC_SURPRISE', name: 'Unexpected OPEC Decision', sector: EventSector.Energy, importance: EventImportance.High, description: 'Unexpected OPEC+ production decision deviating from consensus', ...NEWS_BASE },
  { id: 'WW.MONEY.CENTRAL_BANK_SURPRISE', name: 'Unexpected Central Bank Action', sector: EventSector.Money, importance: EventImportance.High, description: 'Unexpected central bank rate decision or emergency action', ...NEWS_BASE },
  { id: 'WW.MONEY.CURRENCY_INTERVENTION', name: 'Currency Intervention', sector: EventSector.Money, importance: EventImportance.High, description: 'Central bank or government direct intervention in currency markets', ...NEWS_BASE },
  { id: 'WW.GEOPOLITICAL.PANDEMIC', name: 'Pandemic / Health Crisis', sector: EventSector.Geopolitical, importance: EventImportance.High, description: 'WHO pandemic declaration or major health crisis with economic impact', ...NEWS_BASE },
  { id: 'WW.GEOPOLITICAL.NATURAL_DISASTER', name: 'Major Natural Disaster', sector: EventSector.Geopolitical, importance: EventImportance.Moderate, description: 'Large-scale natural disaster with economic consequences', ...NEWS_BASE },
  { id: 'WW.GEOPOLITICAL.TERRORIST_ATTACK', name: 'Major Terrorist Attack', sector: EventSector.Geopolitical, importance: EventImportance.High, description: 'High-impact terrorist attack affecting financial markets', ...NEWS_BASE },
  { id: 'WW.GEOPOLITICAL.CYBER_ATTACK', name: 'Major Cyber Attack', sector: EventSector.Geopolitical, importance: EventImportance.Moderate, description: 'State-sponsored or large-scale cyber attack on financial or critical infrastructure', ...NEWS_BASE },
  { id: 'WW.MONEY.FINANCIAL_CRISIS', name: 'Financial Crisis / Bank Run', sector: EventSector.Money, importance: EventImportance.High, description: 'Systemic financial crisis, bank run, or major institution failure', ...NEWS_BASE },
  { id: 'WW.MARKET.FLASH_CRASH', name: 'Flash Crash', sector: EventSector.Market, importance: EventImportance.High, description: 'Extreme rapid market selloff and recovery event', ...NEWS_BASE },
  { id: 'WW.GEOPOLITICAL.TARIFF_ANNOUNCEMENT', name: 'Major Tariff Announcement', sector: EventSector.Geopolitical, importance: EventImportance.High, description: 'Significant tariff announcement or trade restriction by a major economy', ...NEWS_BASE },
  { id: 'WW.GEOPOLITICAL.DEBT_RESTRUCTURING', name: 'Sovereign Debt Restructuring', sector: EventSector.Government, importance: EventImportance.High, description: 'Sovereign debt restructuring, default, or IMF program announcement', ...NEWS_BASE },
] as const;
