import {
  normalisePrice,
  type Candle,
  type DataErr,
  type DataResult,
  type DataStatus,
  type InstrumentInfo,
  type MarketDataProvider,
  type Provenance,
  type Quote,
  type SeriesRequest,
} from './provider'

/**
 * Twelve Data adapter.
 *
 * Verified behaviour this encodes (2026-10-16/17):
 * - Auth: the `Authorization: apikey <key>` header, not a query parameter.
 * - Plan-gated instruments answer `code: 404` with an upgrade message, which is
 *   why gating must be detected from the message and not from 403 alone.
 * - Unknown symbols also answer 404, with a different message. These are
 *   different conditions and must not collapse into one "not found".
 * - 429 means the quota is spent. Retrying immediately makes it worse.
 * - Free tier is 8 credits/minute and 800/day; every call costs at least 1.
 */

const BASE = 'https://api.twelvedata.com'

const ATTRIBUTION = 'Data provided by Twelve Data (twelvedata.com)'

/**
 * The free tier is personal/internal use only. This note is carried on every
 * value so the restriction travels with the data rather than living only in a
 * document that a future change might not read.
 */
const LICENCE_NOTE =
  'Twelve Data Individual plan: personal/internal use only. No commercial display or redistribution to third parties without a Redistribution Rights Add-on.'

const INTERVALS = ['1min', '5min', '15min', '30min', '45min', '1h', '2h', '4h', '8h', '1day', '1week', '1month'] as const

type FetchOutcome =
  | { kind: 'ok'; payload: Record<string, unknown>; httpStatus: number }
  | { kind: 'error'; status: Exclude<DataStatus, 'current' | 'stale'>; message: string; httpStatus: number; code: number | null }

/** Distinguishes a plan gate from a genuinely unknown symbol. Both answer 404. */
function classifyError(code: number | null, message: string, httpStatus: number): Exclude<DataStatus, 'current' | 'stale'> {
  const text = message.toLowerCase()
  if (text.includes('plan') || text.includes('upgrade') || text.includes('premium')) return 'plan-gated'
  if (httpStatus === 401 || code === 401) return 'unauthorized'
  if (httpStatus === 429 || code === 429) return 'rate-limited'
  if (text.includes('invalid') || text.includes('not found') || code === 404) return 'not-supported'
  return 'unavailable'
}

async function callProvider(path: string, params: Record<string, string>): Promise<FetchOutcome> {
  const apiKey = process.env.TWELVEDATA_API_KEY
  if (!apiKey) {
    return { kind: 'error', status: 'unauthorized', message: 'Provider key not configured on the server.', httpStatus: 0, code: null }
  }

  const query = new URLSearchParams(params).toString()
  const url = `${BASE}${path}?${query}`

  let response: Response
  try {
    response = await fetch(url, {
      headers: { Authorization: `apikey ${apiKey}`, Accept: 'application/json' },
      // Market data is cached in our own table; never let Next cache the fetch too.
      cache: 'no-store',
      signal: AbortSignal.timeout(12_000),
    })
  } catch {
    // Timeouts and network failures are transient, not "the instrument is gone".
    return { kind: 'error', status: 'unavailable', message: 'Tidak bisa menghubungi penyedia data.', httpStatus: 0, code: null }
  }

  let payload: unknown
  try {
    payload = await response.json()
  } catch {
    return { kind: 'error', status: 'unavailable', message: 'Respons penyedia tidak bisa dibaca.', httpStatus: response.status, code: null }
  }

  const body = (payload ?? {}) as Record<string, unknown>
  const code = typeof body.code === 'number' ? body.code : null
  const status = typeof body.status === 'string' ? body.status : null

  if (!response.ok || status === 'error') {
    const message = typeof body.message === 'string' ? body.message : 'Permintaan ke penyedia gagal.'
    return { kind: 'error', status: classifyError(code, message, response.status), message, httpStatus: response.status, code }
  }

  return { kind: 'ok', payload: body, httpStatus: response.status }
}

function provenanceFor(symbol: string, sourceTimestamp: string, path: string, currency: string | null): Provenance {
  return {
    provider: 'twelvedata',
    sourceUrl: `${BASE}${path}`,
    symbol,
    sourceTimestamp,
    retrievedAt: new Date().toISOString(),
    dataClass: 'historical',
    currency,
    attribution: ATTRIBUTION,
    licenceNote: LICENCE_NOTE,
  }
}

function failure(symbol: string, path: string, status: Exclude<DataStatus, 'current' | 'stale'>, message: string): DataErr {
  return {
    ok: false,
    status,
    message,
    provenance: {
      provider: 'twelvedata',
      sourceUrl: `${BASE}${path}`,
      symbol,
      retrievedAt: new Date().toISOString(),
      currency: null,
      attribution: ATTRIBUTION,
      licenceNote: LICENCE_NOTE,
    },
  }
}

type MetaBlock = {
  symbol?: string
  currency?: string
  exchange?: string
  mic_code?: string
  type?: string
  exchange_timezone?: string
}

/**
 * Twelve Data returns newest-first. The contract here is oldest-first, so every
 * series is reversed once, at the boundary, instead of in each consumer.
 */
function toCandles(values: unknown): { candles: Candle[]; latest: string | null } {
  if (!Array.isArray(values)) return { candles: [], latest: null }

  const candles: Candle[] = []
  for (const raw of values) {
    const row = (raw ?? {}) as Record<string, unknown>
    const time = typeof row.datetime === 'string' ? row.datetime : null
    const open = normalisePrice(row.open)
    const high = normalisePrice(row.high)
    const low = normalisePrice(row.low)
    const close = normalisePrice(row.close)
    // A bar missing OHLC is not usable; skip it rather than emit nulls.
    if (!time || open === null || high === null || low === null || close === null) continue
    candles.push({ time, open, high, low, close, volume: normalisePrice(row.volume) })
  }

  candles.reverse()
  return { candles, latest: candles.length ? candles[candles.length - 1].time : null }
}

export function createTwelveDataProvider(): MarketDataProvider {
  return {
    id: 'twelvedata',
    displayName: 'Twelve Data',
    attribution: ATTRIBUTION,
    licenceNote: LICENCE_NOTE,
    capabilities: {
      // Only what was actually verified reachable on the free plan.
      includedInstruments: ['XAU/USD', 'BTC/USD'],
      hasPlanGated: true,
      intervals: INTERVALS,
    },

    async getSeries({ symbol, interval, limit }: SeriesRequest): Promise<DataResult<Candle[]>> {
      if (!INTERVALS.includes(interval as (typeof INTERVALS)[number])) {
        return failure(symbol, '/time_series', 'not-supported', `Interval ${interval} tidak didukung.`)
      }

      const size = Math.min(Math.max(Math.trunc(limit), 1), 5000)
      const outcome = await callProvider('/time_series', { symbol, interval, outputsize: String(size) })

      if (outcome.kind === 'error') return failure(symbol, '/time_series', outcome.status, outcome.message)

      const meta = (outcome.payload.meta ?? {}) as MetaBlock
      const { candles, latest } = toCandles(outcome.payload.values)

      if (!candles.length) {
        return failure(symbol, '/time_series', 'insufficient-data', 'Tidak ada bar yang bisa dipakai pada rentang ini.')
      }

      return {
        ok: true,
        status: 'current',
        // Bar open times are exchange-local strings; the adapter keeps them as
        // the provider states them rather than guessing a UTC offset.
        provenance: provenanceFor(symbol, latest ?? new Date().toISOString(), '/time_series', meta.currency ?? null),
        data: candles,
      }
    },

    async getQuote(symbol: string): Promise<DataResult<Quote>> {
      const outcome = await callProvider('/quote', { symbol })
      if (outcome.kind === 'error') return failure(symbol, '/quote', outcome.status, outcome.message)

      const body = outcome.payload
      const price = normalisePrice(body.close) ?? normalisePrice(body.price)
      if (price === null) {
        return failure(symbol, '/quote', 'insufficient-data', 'Penyedia tidak mengembalikan harga.')
      }

      const stamp = typeof body.datetime === 'string' ? body.datetime : new Date().toISOString()

      return {
        ok: true,
        status: 'current',
        provenance: provenanceFor(symbol, stamp, '/quote', typeof body.currency === 'string' ? body.currency : null),
        data: {
          symbol: typeof body.symbol === 'string' ? body.symbol : symbol,
          name: typeof body.name === 'string' ? body.name : null,
          price,
          previousClose: normalisePrice(body.previous_close),
          change: normalisePrice(body.change),
          percentChange: normalisePrice(body.percent_change),
          currency: typeof body.currency === 'string' ? body.currency : null,
          exchange: typeof body.exchange === 'string' ? body.exchange : null,
        },
      }
    },

    async getInstrument(symbol: string): Promise<DataResult<InstrumentInfo>> {
      // `/quote` does NOT return an instrument type for every asset class — an
      // ETF quote omits it entirely. `/time_series` always returns meta.type,
      // so that is the reliable source. Verified against DIA on 2026-10-17.
      const outcome = await callProvider('/time_series', { symbol, interval: '1day', outputsize: '1' })
      if (outcome.kind === 'error') return failure(symbol, '/time_series', outcome.status, outcome.message)

      const meta = (outcome.payload.meta ?? {}) as MetaBlock
      const type = typeof meta.type === 'string' ? meta.type : null
      if (!type) {
        return failure(symbol, '/time_series', 'insufficient-data', 'Penyedia tidak menyatakan jenis instrumen.')
      }

      const values = Array.isArray(outcome.payload.values) ? outcome.payload.values : []
      const first = (values[0] ?? {}) as Record<string, unknown>
      const stamp = typeof first.datetime === 'string' ? first.datetime : new Date().toISOString()

      return {
        ok: true,
        status: 'current',
        provenance: provenanceFor(symbol, stamp, '/time_series', meta.currency ?? null),
        data: {
          symbol: meta.symbol ?? symbol,
          name: null,
          instrumentType: type,
          exchange: meta.exchange ?? null,
          micCode: meta.mic_code ?? null,
          currency: meta.currency ?? null,
          exchangeTimezone: meta.exchange_timezone ?? null,
        },
      }
    },
  }
}
