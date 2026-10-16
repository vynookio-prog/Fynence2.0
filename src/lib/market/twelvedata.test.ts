import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createTwelveDataProvider } from './twelvedata'

/**
 * These tests pin the provider's observed error semantics. The critical case is
 * that a plan gate and an unknown symbol both answer HTTP 404, so they can only
 * be told apart by the message. Collapsing them would tell a user "this
 * instrument does not exist" when the truth is "your plan cannot see it".
 */

const originalKey = process.env.TWELVEDATA_API_KEY

function mockJson(body: unknown, status = 200) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  })
}

beforeEach(() => {
  process.env.TWELVEDATA_API_KEY = 'test-key'
})

afterEach(() => {
  vi.restoreAllMocks()
  if (originalKey === undefined) delete process.env.TWELVEDATA_API_KEY
  else process.env.TWELVEDATA_API_KEY = originalKey
})

describe('authentication', () => {
  it('sends the key as an Authorization header, not a query parameter', async () => {
    const fetchMock = mockJson({ close: '10', datetime: '2026-10-17' })
    vi.stubGlobal('fetch', fetchMock)

    await createTwelveDataProvider().getQuote('AAPL')

    const [url, init] = fetchMock.mock.calls[0]
    expect(String(url)).not.toContain('test-key')
    expect((init as RequestInit).headers).toMatchObject({ Authorization: 'apikey test-key' })
  })

  it('reports unauthorized without calling the provider when no key is set', async () => {
    delete process.env.TWELVEDATA_API_KEY
    const fetchMock = mockJson({})
    vi.stubGlobal('fetch', fetchMock)

    const result = await createTwelveDataProvider().getQuote('AAPL')

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.status).toBe('unauthorized')
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('error classification', () => {
  it('treats a 404 mentioning a plan as plan-gated, not missing', async () => {
    vi.stubGlobal('fetch', mockJson(
      { code: 404, status: 'error', message: 'This symbol is available starting with the Pro or Venture plan.' },
      404,
    ))

    const result = await createTwelveDataProvider().getSeries({ symbol: 'US100', interval: '1day', limit: 1 })

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.status).toBe('plan-gated')
  })

  it('treats a 404 about an invalid symbol as not-supported', async () => {
    vi.stubGlobal('fetch', mockJson(
      { code: 404, status: 'error', message: '**symbol** or **figi** parameter is missing or invalid.' },
      404,
    ))

    const result = await createTwelveDataProvider().getSeries({ symbol: 'US30', interval: '1day', limit: 1 })

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.status).toBe('not-supported')
  })

  it('maps 429 to rate-limited', async () => {
    vi.stubGlobal('fetch', mockJson({ code: 429, status: 'error', message: 'You have reached the API request limit.' }, 429))

    const result = await createTwelveDataProvider().getQuote('AAPL')

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.status).toBe('rate-limited')
  })

  it('maps 401 to unauthorized', async () => {
    vi.stubGlobal('fetch', mockJson({ code: 401, status: 'error', message: 'Invalid API key.' }, 401))

    const result = await createTwelveDataProvider().getQuote('AAPL')

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.status).toBe('unauthorized')
  })

  it('maps a network failure to unavailable rather than missing', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('socket hang up')))

    const result = await createTwelveDataProvider().getSeries({ symbol: 'AAPL', interval: '1day', limit: 1 })

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.status).toBe('unavailable')
  })

  it('rejects an unsupported interval without spending a request', async () => {
    const fetchMock = mockJson({})
    vi.stubGlobal('fetch', fetchMock)

    const result = await createTwelveDataProvider().getSeries({ symbol: 'AAPL', interval: '3sec', limit: 1 })

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.status).toBe('not-supported')
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('series parsing', () => {
  it('reverses newest-first provider output into oldest-first', async () => {
    vi.stubGlobal('fetch', mockJson({
      meta: { symbol: 'AAPL', currency: 'USD', type: 'Common Stock' },
      values: [
        { datetime: '2026-10-17', open: '3', high: '3', low: '3', close: '3' },
        { datetime: '2026-10-16', open: '2', high: '2', low: '2', close: '2' },
        { datetime: '2026-10-15', open: '1', high: '1', low: '1', close: '1' },
      ],
      status: 'ok',
    }))

    const result = await createTwelveDataProvider().getSeries({ symbol: 'AAPL', interval: '1day', limit: 3 })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.map(c => c.time)).toEqual(['2026-10-15', '2026-10-16', '2026-10-17'])
      expect(result.provenance.sourceTimestamp).toBe('2026-10-17')
      expect(result.provenance.currency).toBe('USD')
      expect(result.provenance.licenceNote).toContain('personal/internal')
    }
  })

  it('skips bars with unparseable prices instead of emitting nulls', async () => {
    vi.stubGlobal('fetch', mockJson({
      meta: { symbol: 'AAPL' },
      values: [
        { datetime: '2026-10-17', open: '3', high: '3', low: '3', close: '3' },
        { datetime: '2026-10-16', open: 'n/a', high: '2', low: '2', close: '2' },
        { datetime: '2026-10-15', open: '1', high: '1', low: '1', close: '' },
      ],
      status: 'ok',
    }))

    const result = await createTwelveDataProvider().getSeries({ symbol: 'AAPL', interval: '1day', limit: 3 })

    expect(result.ok).toBe(true)
    if (result.ok) expect(result.data).toHaveLength(1)
  })

  it('reports insufficient-data rather than an empty success', async () => {
    vi.stubGlobal('fetch', mockJson({ meta: { symbol: 'AAPL' }, values: [], status: 'ok' }))

    const result = await createTwelveDataProvider().getSeries({ symbol: 'AAPL', interval: '1day', limit: 5 })

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.status).toBe('insufficient-data')
  })

  it('clamps outputsize into the provider-supported range', async () => {
    const fetchMock = mockJson({ meta: {}, values: [{ datetime: '2026-10-17', open: '1', high: '1', low: '1', close: '1' }], status: 'ok' })
    vi.stubGlobal('fetch', fetchMock)

    await createTwelveDataProvider().getSeries({ symbol: 'AAPL', interval: '1day', limit: 99999 })

    const [, init] = fetchMock.mock.calls[0]
    expect(String((init as RequestInit).body ?? '')).toBe('')
    expect(String(fetchMock.mock.calls[0][0])).toContain('outputsize=5000')
  })
})

describe('instrument metadata', () => {
  it('reads the type from meta, since an ETF quote omits it', async () => {
    vi.stubGlobal('fetch', mockJson({
      meta: {
        symbol: 'DIA', type: 'ETF', exchange: 'NYSE', mic_code: 'ARCX',
        currency: 'USD', exchange_timezone: 'America/New_York',
      },
      values: [{ datetime: '2026-10-16', open: '522', high: '525', low: '517', close: '519' }],
      status: 'ok',
    }))

    const result = await createTwelveDataProvider().getInstrument('DIA')

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.instrumentType).toBe('ETF')
      expect(result.data.exchangeTimezone).toBe('America/New_York')
    }
  })

  it('does not invent a type when the provider omits one', async () => {
    vi.stubGlobal('fetch', mockJson({ meta: { symbol: 'X' }, values: [], status: 'ok' }))

    const result = await createTwelveDataProvider().getInstrument('X')

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.status).toBe('insufficient-data')
  })

  it('surfaces a plan gate on instrument lookup too', async () => {
    vi.stubGlobal('fetch', mockJson(
      { code: 404, status: 'error', message: 'This symbol is available starting with the Grow or Venture plan.' },
      404,
    ))

    const result = await createTwelveDataProvider().getInstrument('NDX')

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.status).toBe('plan-gated')
  })
})
