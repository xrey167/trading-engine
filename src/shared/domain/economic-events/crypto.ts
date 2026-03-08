import type { EventDefinition } from './types.js';
import {
  EventDomain, EventFrequency, EventImportance, EventMultiplier,
  EventSector, EventTimeMode, EventType, EventUnit,
} from './types.js';

const CRYPTO_BASE = {
  type: EventType.Event,
  domain: EventDomain.Crypto,
  timeMode: EventTimeMode.Tentative,
  unit: EventUnit.None,
  multiplier: EventMultiplier.None,
  digits: 0,
} as const;

export const CRYPTO_EVENTS: readonly EventDefinition[] = [
  { id: 'CRYPTO.CRYPTO.BTC_HALVING', name: 'Bitcoin Halving', sector: EventSector.Crypto, importance: EventImportance.High, frequency: EventFrequency.Year, currency: 'BTC', description: 'Bitcoin block reward halving (~every 4 years)', ...CRYPTO_BASE },
  { id: 'CRYPTO.CRYPTO.ETH_UPGRADE', name: 'Ethereum Network Upgrade', sector: EventSector.Crypto, importance: EventImportance.High, frequency: EventFrequency.None, currency: 'ETH', description: 'Major Ethereum network upgrade or hard fork', ...CRYPTO_BASE },
  { id: 'CRYPTO.CRYPTO.TOKEN_UNLOCK', name: 'Major Token Unlock', sector: EventSector.Crypto, importance: EventImportance.Moderate, frequency: EventFrequency.None, currency: 'ALL', description: 'Large token unlock or vesting cliff release', ...CRYPTO_BASE },
  { id: 'CRYPTO.CRYPTO.EXCHANGE_LISTING', name: 'Major Exchange Listing', sector: EventSector.Crypto, importance: EventImportance.Moderate, frequency: EventFrequency.None, currency: 'ALL', description: 'Token listing on a major centralized exchange', ...CRYPTO_BASE },
  { id: 'CRYPTO.CRYPTO.EXCHANGE_DELISTING', name: 'Major Exchange Delisting', sector: EventSector.Crypto, importance: EventImportance.Moderate, frequency: EventFrequency.None, currency: 'ALL', description: 'Token delisting from a major centralized exchange', ...CRYPTO_BASE },
  { id: 'CRYPTO.CRYPTO.PROTOCOL_FORK', name: 'Protocol Fork', sector: EventSector.Crypto, importance: EventImportance.High, frequency: EventFrequency.None, currency: 'ALL', description: 'Protocol hard fork or contentious soft fork', ...CRYPTO_BASE },
  { id: 'CRYPTO.CRYPTO.STABLECOIN_DEPEG', name: 'Stablecoin Depegging', sector: EventSector.Crypto, importance: EventImportance.High, frequency: EventFrequency.None, currency: 'ALL', description: 'Major stablecoin losing its peg to the underlying asset', ...CRYPTO_BASE },
  { id: 'CRYPTO.CRYPTO.HACK_EXPLOIT', name: 'Major Hack or Exploit', sector: EventSector.Crypto, importance: EventImportance.High, frequency: EventFrequency.None, currency: 'ALL', description: 'Major protocol hack, bridge exploit, or exchange breach', ...CRYPTO_BASE },
  { id: 'CRYPTO.CRYPTO.REGULATORY_ACTION', name: 'Crypto Regulatory Action', sector: EventSector.Crypto, importance: EventImportance.High, frequency: EventFrequency.None, currency: 'ALL', description: 'Significant regulatory action (SEC, CFTC, EU MiCA, etc.)', ...CRYPTO_BASE },
  { id: 'CRYPTO.CRYPTO.ETF_DECISION', name: 'Crypto ETF Decision', sector: EventSector.Crypto, importance: EventImportance.High, frequency: EventFrequency.None, currency: 'ALL', description: 'Crypto ETF approval, rejection, or amendment decision', ...CRYPTO_BASE },
  { id: 'CRYPTO.CRYPTO.WHALE_MOVEMENT', name: 'Major Whale Movement', sector: EventSector.Crypto, importance: EventImportance.Moderate, frequency: EventFrequency.None, currency: 'ALL', description: 'Large whale wallet movement or exchange deposit/withdrawal', ...CRYPTO_BASE },
  { id: 'CRYPTO.CRYPTO.MINING_DIFFICULTY', name: 'Mining Difficulty Adjustment', sector: EventSector.Crypto, importance: EventImportance.Low, frequency: EventFrequency.None, currency: 'BTC', description: 'Bitcoin mining difficulty adjustment', ...CRYPTO_BASE },
  { id: 'CRYPTO.CRYPTO.NETWORK_CONGESTION', name: 'Network Congestion', sector: EventSector.Crypto, importance: EventImportance.Moderate, frequency: EventFrequency.None, currency: 'ALL', description: 'Significant network congestion and fee spike event', ...CRYPTO_BASE },
  { id: 'CRYPTO.CRYPTO.GOVERNANCE_VOTE', name: 'Protocol Governance Vote', sector: EventSector.Crypto, importance: EventImportance.Moderate, frequency: EventFrequency.None, currency: 'ALL', description: 'Major DeFi protocol governance vote (fee switch, treasury allocation)', ...CRYPTO_BASE },
  { id: 'CRYPTO.CRYPTO.DEFI_TVL_MILESTONE', name: 'DeFi TVL Milestone', sector: EventSector.Crypto, importance: EventImportance.Low, frequency: EventFrequency.None, currency: 'ALL', description: 'DeFi total value locked (TVL) crossing major milestone', ...CRYPTO_BASE },
  { id: 'CRYPTO.CRYPTO.CBDC_PILOT', name: 'CBDC Pilot Launch', sector: EventSector.Crypto, importance: EventImportance.Moderate, frequency: EventFrequency.None, currency: 'ALL', description: 'Central bank digital currency pilot launch or expansion', ...CRYPTO_BASE },
  { id: 'CRYPTO.CRYPTO.CBDC_LEGISLATION', name: 'CBDC Legislation', sector: EventSector.Crypto, importance: EventImportance.Moderate, frequency: EventFrequency.None, currency: 'ALL', description: 'CBDC-related legislation passage or executive order', ...CRYPTO_BASE },
  { id: 'CRYPTO.CRYPTO.AIRDROP', name: 'Major Token Airdrop', sector: EventSector.Crypto, importance: EventImportance.Moderate, frequency: EventFrequency.None, currency: 'ALL', description: 'Major protocol token airdrop event', ...CRYPTO_BASE },
] as const;
