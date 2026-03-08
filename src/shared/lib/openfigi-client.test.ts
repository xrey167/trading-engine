import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FigiIdType } from '../domain/figi.js';
import type { FigiMappingRequest } from '../domain/figi.js';
import { createOpenFigiClient } from './openfigi-client.js';

const mockFetch = vi.fn<typeof fetch>();

beforeEach(() => {
  vi.stubGlobal('fetch', mockFetch);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

function makeResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

const req: FigiMappingRequest = { idType: FigiIdType.ID_ISIN, idValue: 'US0378331005' };

const figiData = [
  {
    figi: 'BBG000BLNNH6',
    name: 'APPLE INC',
    ticker: 'AAPL',
    exchCode: 'UW',
    securityType: 'Common Stock',
    marketSector: 'Equity',
  },
];

describe('createOpenFigiClient', () => {
  it('returns a client object with map and mapOne', () => {
    const client = createOpenFigiClient();
    expect(typeof client.map).toBe('function');
    expect(typeof client.mapOne).toBe('function');
  });
});

describe('map()', () => {
  it('returns instruments on successful response', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse([{ data: figiData }]));
    const client = createOpenFigiClient({ baseUrl: 'http://test' });
    const result = await client.map([req]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toHaveLength(1);
    expect(result.value[0]).toHaveLength(1);
    expect(result.value[0]?.[0]?.name).toBe('APPLE INC');
  });

  it('returns null for per-item error', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse([{ error: 'No identifier found' }]));
    const client = createOpenFigiClient({ baseUrl: 'http://test' });
    const result = await client.map([req]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value[0]).toBeNull();
  });

  it('splits requests into chunks of 100', async () => {
    // 101 requests → 2 fetches; first returns 100 items, second returns 1
    mockFetch
      .mockResolvedValueOnce(makeResponse(Array(100).fill({ data: figiData })))
      .mockResolvedValueOnce(makeResponse(Array(1).fill({ data: figiData })));
    const requests = Array(101).fill(req) as FigiMappingRequest[];
    const client = createOpenFigiClient({ baseUrl: 'http://test' });
    const result = await client.map(requests);
    expect(result.ok).toBe(true);
    expect(mockFetch).toHaveBeenCalledTimes(2);
    if (!result.ok) return;
    // 100 from first chunk + 1 from second = 101 total
    expect(result.value).toHaveLength(101);
  });

  it('returns err on network failure', async () => {
    mockFetch.mockRejectedValueOnce(new Error('network down'));
    const client = createOpenFigiClient({ baseUrl: 'http://test' });
    const result = await client.map([req]);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe('GATEWAY_ERROR');
  });

  it('returns err on non-OK HTTP status', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse({ message: 'Unauthorized' }, 401));
    const client = createOpenFigiClient({ baseUrl: 'http://test' });
    const result = await client.map([req]);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe('GATEWAY_ERROR');
    expect(result.error.message).toContain('401');
  });

  it('retries on 429 with exponential backoff', async () => {
    vi.useFakeTimers();
    const retryRes = makeResponse('', 429);
    mockFetch
      .mockResolvedValueOnce(retryRes)
      .mockResolvedValueOnce(retryRes)
      .mockResolvedValueOnce(makeResponse([{ data: figiData }]));

    const client = createOpenFigiClient({ baseUrl: 'http://test' });
    const promise = client.map([req]);
    // Advance timers for retry delays: 100ms, 200ms
    await vi.runAllTimersAsync();
    const result = await promise;
    vi.useRealTimers();

    expect(result.ok).toBe(true);
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it('sets API key header when provided', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse([{ data: figiData }]));
    const client = createOpenFigiClient({ apiKey: 'test-key', baseUrl: 'http://test' });
    await client.map([req]);
    const [, init] = mockFetch.mock.calls[0]!;
    expect((init?.headers as Record<string, string>)['X-OPENFIGI-APIKEY']).toBe('test-key');
  });

  it('does not set API key header when not provided', async () => {
    delete process.env['OPENFIGI_API_KEY'];
    mockFetch.mockResolvedValueOnce(makeResponse([{ data: figiData }]));
    const client = createOpenFigiClient({ baseUrl: 'http://test' });
    await client.map([req]);
    const [, init] = mockFetch.mock.calls[0]!;
    expect((init?.headers as Record<string, string>)['X-OPENFIGI-APIKEY']).toBeUndefined();
  });
});

describe('mapOne()', () => {
  it('returns first instrument on match', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse([{ data: figiData }]));
    const client = createOpenFigiClient({ baseUrl: 'http://test' });
    const result = await client.mapOne(req);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value?.name).toBe('APPLE INC');
  });

  it('returns null when no match (per-item error)', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse([{ error: 'No identifier found' }]));
    const client = createOpenFigiClient({ baseUrl: 'http://test' });
    const result = await client.mapOne(req);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toBeNull();
  });

  it('returns err on network failure', async () => {
    mockFetch.mockRejectedValueOnce(new Error('network down'));
    const client = createOpenFigiClient({ baseUrl: 'http://test' });
    const result = await client.mapOne(req);
    expect(result.ok).toBe(false);
  });
});
