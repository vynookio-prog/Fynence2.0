import { normalisePrice } from '@/lib/market/provider'

/**
 * Frankfurter adapter: reference exchange rates.
 *
 * Materially different from the market data provider, and the differences are
 * the reason this is a separate module rather than another MarketDataProvider:
 *
 * - No API key and no quota. Nothing here needs a budget guard.
 * - Daily granularity, deliberately. The provider states plainly that it is not
 *   built for live trading, so nothing here may be presented as a live price.
 * - Blended rates are the provider's own calculation and free for commercial
 *   use. Querying an individual provider endpoint changes the licence, which is
 *   why only the blended feed is used and the source is recorded per row.
 *
 * Two failure shapes had to be distinguished, and one of them is a trap:
 * a bad currency answers 422 with a message, but an unknown date answers 200
 * with an empty array. Treating that empty array as success would let the UI
 * say "no rate available" when the truth is the date was wrong.
 */

const BASE = 'https://api.frankfurter.dev/v2'

const ATTRIBUTION = 'Rates provided by Frankfurter (frankfurter.dev)'

/**
 * Blended rates only. Individual provider endpoints are subject to that
 * provider's own terms, so the code never reaches for one.
 */
const LICENCE_NOTE =
  'Frankfurter blended rates are its own calculation and free for commercial use. Not for live trading; daily granularity, mid-market.'

export type RateObservation = {
  base: string
  quote: string
  /** The rate's own effective date, which may differ from the date requested. */
  rateDate: string
  rate: string
}

export type RatesResult =
  | { ok: true; data: RateObservation[]; provenance: RateProvenance }
  | { ok: false; status: RateFailure; message: string; provenance: RateProvenance }

export type RateFailure =
  | 'invalid-currency'
  | 'no-data'
  | 'unavailable'
  | 'bad-request'

export type RateProvenance = {
  provider: 'frankfurter'
  source: 'blended'
  sourceUrl: string
  retrievedAt: string
  attribution: string
  licenceNote: string
}

function provenanceFor(url: string): RateProvenance {
  return {
    provider: 'frankfurter',
    source: 'blended',
    sourceUrl: url,
    retrievedAt: new Date().toISOString(),
    attribution: ATTRIBUTION,
    licenceNote: LICENCE_NOTE,
  }
}

type CallOutcome =
  | { kind: 'ok'; body: unknown; url: string }
  | { kind: 'error'; status: RateFailure; message: string; url: string }

async function call(path: string, params: Record<string, string> = {}): Promise<CallOutcome> {
  const query = new URLSearchParams(params).toString()
  const url = `${BASE}${path}${query ? `?${query}` : ''}`

  let response: Response
  try {
    response = await fetch(url, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(15_000),
    })
  } catch {
    return { kind: 'error', status: 'unavailable', message: 'Tidak bisa menghubungi penyedia kurs.', url }
  }

  let body: unknown
  try {
    body = await response.json()
  } catch {
    return { kind: 'error', status: 'unavailable', message: 'Respons penyedia kurs tidak bisa dibaca.', url }
  }

  if (!response.ok) {
    const message = (body as { message?: string })?.message ?? 'Permintaan kurs gagal.'
    // 422 is the provider's answer for a currency it does not know.
    const status: RateFailure = response.status === 422 ? 'invalid-currency' : 'bad-request'
    return { kind: 'error', status, message, url }
  }

  return { kind: 'ok', body, url }
}

/** Accepts the array shape from /rates and the object shape from /rate. */
function toObservations(body: unknown): RateObservation[] {
  const rows = Array.isArray(body) ? body : [body]

  const observations: RateObservation[] = []
  for (const raw of rows) {
    const row = (raw ?? {}) as Record<string, unknown>
    const base = typeof row.base === 'string' ? row.base : null
    const quote = typeof row.quote === 'string' ? row.quote : null
    const date = typeof row.date === 'string' ? row.date : null
    // Rate arrives as a number, unlike the market provider's string prices.
    const rate = normalisePrice(row.rate)
    if (!base || !quote || !date || rate === null) continue
    observations.push({ base, quote, rateDate: date, rate })
  }
  return observations
}

/**
 * Fetches one or more pairs. `quotes` narrows the response, which keeps it
 * small when only a couple of currencies are needed.
 */
export async function getRates(
  base: string,
  quotes: string[],
  date?: string,
): Promise<RatesResult> {
  const params: Record<string, string> = { base: base.toUpperCase() }
  if (quotes.length) params.quotes = quotes.map(q => q.toUpperCase()).join(',')
  if (date) params.date = date

  const outcome = await call('/rates', params)
  if (outcome.kind === 'error') {
    return { ok: false, status: outcome.status, message: outcome.message, provenance: provenanceFor(outcome.url) }
  }

  const observations = toObservations(outcome.body)
  if (!observations.length) {
    // HTTP 200 with an empty body. Not a success: nothing was learned about
    // this date, and saying "no data" without saying why would be misleading.
    return {
      ok: false,
      status: 'no-data',
      message: date
        ? `Tidak ada kurs terbit untuk ${date}. Tanggal mungkin di luar jangkauan data.`
        : 'Penyedia tidak mengembalikan kurs untuk permintaan ini.',
      provenance: provenanceFor(outcome.url),
    }
  }

  return { ok: true, data: observations, provenance: provenanceFor(outcome.url) }
}

/** A single pair, the smallest useful request. */
export async function getRate(base: string, quote: string, date?: string): Promise<RatesResult> {
  const params: Record<string, string> = date ? { date } : {}
  const outcome = await call(`/rate/${base.toUpperCase()}/${quote.toUpperCase()}`, params)
  if (outcome.kind === 'error') {
    return { ok: false, status: outcome.status, message: outcome.message, provenance: provenanceFor(outcome.url) }
  }

  const observations = toObservations(outcome.body)
  if (!observations.length) {
    return {
      ok: false,
      status: 'no-data',
      message: 'Penyedia tidak mengembalikan kurs untuk pasangan ini.',
      provenance: provenanceFor(outcome.url),
    }
  }

  return { ok: true, data: observations, provenance: provenanceFor(outcome.url) }
}

/** Whether the provider is usable at all. Used to decide which state to render. */
export async function isAvailable(): Promise<boolean> {
  const probe = await getRate('USD', 'EUR')
  return probe.ok
}
