import type { DomainError } from './errors.js';
import { err, ok, type Result } from './result.js';
import { gatewayError } from './errors.js';
import type { FigiInstrument, FigiMappingRequest } from '../domain/figi.js';
import { isFigi } from '../domain/figi.js';

const OPENFIGI_BASE = 'https://api.openfigi.com/v3';
const BATCH_SIZE = 100;
const MAX_RETRIES = 3;

/** OpenFIGI v3 raw response item */
type RawFigiItem = {
  error?: string;
  data?: Array<{
    figi: string;
    name: string;
    ticker?: string;
    exchCode?: string;
    compositeFIGI?: string;
    securityType?: string;
    marketSector?: string;
    shareClassFIGI?: string;
    securityDescription?: string;
    uniqueID?: string;
  }>;
};

export interface OpenFigiClient {
  /** Batch map — up to 100 requests per call (automatically chunked) */
  map(requests: FigiMappingRequest[]): Promise<Result<Array<FigiInstrument[] | null>, DomainError>>;
  /** Convenience single-item map; returns null when no result */
  mapOne(request: FigiMappingRequest): Promise<Result<FigiInstrument | null, DomainError>>;
}

async function fetchWithRetry(
  url: string,
  init: RequestInit,
  retries = MAX_RETRIES,
): Promise<Response> {
  for (let attempt = 0; attempt < retries; attempt++) {
    const res = await fetch(url, init);
    if (res.status !== 429) return res;
    await new Promise<void>((r) => setTimeout(r, 100 * 2 ** attempt));
  }
  throw new Error('OpenFIGI rate limit exceeded after retries');
}

function parseRawItem(item: RawFigiItem): FigiInstrument[] | null {
  if (item.error !== undefined || item.data === undefined) return null;
  return item.data.map((d) => {
    const instrument: FigiInstrument = {
      figi: isFigi(d.figi) ? d.figi : (d.figi as FigiInstrument['figi']),
      name: d.name,
    };
    if (d.ticker !== undefined) instrument.ticker = d.ticker;
    if (d.exchCode !== undefined) instrument.exchCode = d.exchCode;
    if (d.securityType !== undefined) instrument.securityType = d.securityType;
    if (d.marketSector !== undefined) instrument.marketSector = d.marketSector;
    if (d.securityDescription !== undefined) instrument.securityDescription = d.securityDescription;
    if (d.uniqueID !== undefined) instrument.uniqueID = d.uniqueID;
    if (d.compositeFIGI !== undefined && isFigi(d.compositeFIGI)) {
      instrument.compositeFIGI = d.compositeFIGI;
    }
    if (d.shareClassFIGI !== undefined && isFigi(d.shareClassFIGI)) {
      instrument.shareClassFIGI = d.shareClassFIGI;
    }
    return instrument;
  });
}

async function fetchChunk(
  chunk: FigiMappingRequest[],
  headers: Record<string, string>,
  baseUrl: string,
): Promise<Result<Array<FigiInstrument[] | null>, DomainError>> {
  let res: Response;
  try {
    res = await fetchWithRetry(`${baseUrl}/mapping`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(chunk),
    });
  } catch (e) {
    return err(gatewayError('OpenFIGI request failed', e));
  }

  if (!res.ok) {
    return err(gatewayError(`OpenFIGI returned HTTP ${res.status}`));
  }

  let raw: RawFigiItem[];
  try {
    raw = (await res.json()) as RawFigiItem[];
  } catch (e) {
    return err(gatewayError('Failed to parse OpenFIGI response', e));
  }

  return ok(raw.map(parseRawItem));
}

export function createOpenFigiClient(options?: {
  apiKey?: string;
  baseUrl?: string;
}): OpenFigiClient {
  const apiKey = options?.apiKey ?? process.env['OPENFIGI_API_KEY'];
  const baseUrl = options?.baseUrl ?? OPENFIGI_BASE;
  const headers: Record<string, string> = {};
  if (apiKey) headers['X-OPENFIGI-APIKEY'] = apiKey;

  return {
    async map(
      requests: FigiMappingRequest[],
    ): Promise<Result<Array<FigiInstrument[] | null>, DomainError>> {
      const results: Array<FigiInstrument[] | null> = [];

      for (let i = 0; i < requests.length; i += BATCH_SIZE) {
        const chunk = requests.slice(i, i + BATCH_SIZE);
        const chunkResult = await fetchChunk(chunk, headers, baseUrl);
        if (!chunkResult.ok) return chunkResult;
        results.push(...chunkResult.value);
      }

      return ok(results);
    },

    async mapOne(
      request: FigiMappingRequest,
    ): Promise<Result<FigiInstrument | null, DomainError>> {
      const result = await this.map([request]);
      if (!result.ok) return result;
      const items = result.value[0];
      if (items === null || items.length === 0) return ok(null);
      return ok(items[0]);
    },
  };
}
