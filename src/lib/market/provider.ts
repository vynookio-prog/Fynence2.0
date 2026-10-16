/**
 * Provider contract for market data.
 *
 * Adapters are the only place that knows a provider's wire format. Everything
 * above this layer works with the shapes below, so swapping Twelve Data for
 * another provider does not touch the domain or the UI.
 *
 * Two rules are encoded in the types rather than left to convention:
 *
 * 1. A failed or unavailable read is a discriminated result, never an empty
 *    array or a zero. Callers cannot accidentally render "no data" as "0.00".
 * 2. Every successful read carries provenance, so a value can never reach the
 *    UI without its source, timestamp, and data class attached.
 */

/** How fresh a value is. Never inferred; the adapter states it. */
export type DataClass = 'live' | 'delayed' | 'historical'

/** Outcome of a read, including the ways it can legitimately fail. */
export type DataStatus =
  | 'current'
  | 'stale'
  | 'unavailable'
  | 'partial'
  | 'insufficient-data'
  /** Provider carries the instrument but the current plan cannot access it. */
  | 'plan-gated'
  /** Provider does not carry the instrument at all. */
  | 'not-supported'
  /** Credentials rejected or missing. */
  | 'unauthorized'
  /** Quota exhausted; retrying now would make it worse. */
  | 'rate-limited'

export type Provenance = {
  provider: string
  /** Provider's own URL for the endpoint that produced this value. */
  sourceUrl: string
  symbol: string
  /** The instrument's own timestamp (bar open time, or quote time). */
  sourceTimestamp: string
  /** When our server retrieved it. */
  retrievedAt: string
  dataClass: DataClass
  /** Currency the value is denominated in, when the provider states one. */
  currency: string | null
  /** Attribution required by the provider's terms. */
  attribution: string
  /** Licence note that must be honoured before this value is shown to anyone. */
  licenceNote: string
}

export type Candle = {
  /** Bar open time, ISO 8601. */
  time: string
  open: string
  high: string
  low: string
  close: string
  volume: string | null
}

export type Quote = {
  symbol: string
  name: string | null
  price: string
  previousClose: string | null
  change: string | null
  percentChange: string | null
  currency: string | null
  exchange: string | null
}

export type InstrumentInfo = {
  symbol: string
  name: string | null
  instrumentType: string
  exchange: string | null
  micCode: string | null
  currency: string | null
  exchangeTimezone: string | null
}

/** A successful read: the data plus the provenance it must be shown with. */
export type DataOk<T> = {
  ok: true
  status: Extract<DataStatus, 'current' | 'stale'>
  data: T
  provenance: Provenance
}

/** A failed read. `status` says why, so the UI can pick the right message. */
export type DataErr = {
  ok: false
  status: Exclude<DataStatus, 'current' | 'stale'>
  /** Safe to show a user; never a raw provider payload or stack trace. */
  message: string
  provenance: Omit<Provenance, 'sourceTimestamp' | 'dataClass'>
}

export type DataResult<T> = DataOk<T> | DataErr

export type SeriesRequest = {
  symbol: string
  interval: string
  /** Number of bars, oldest-to-newest in the returned array. */
  limit: number
}

export type ProviderCapabilities = {
  /** Instruments verified reachable on the current plan, at last check. */
  readonly includedInstruments: readonly string[]
  /** Whether the provider carries instruments the current plan locks. */
  readonly hasPlanGated: boolean
  /** Interval tokens this adapter accepts. */
  readonly intervals: readonly string[]
}

export interface MarketDataProvider {
  readonly id: string
  readonly displayName: string
  /** Attribution text the provider's terms require be shown. */
  readonly attribution: string
  readonly licenceNote: string
  readonly capabilities: ProviderCapabilities

  /** Daily (or intraday) bars for one instrument, ascending by time. */
  getSeries(request: SeriesRequest): Promise<DataResult<Candle[]>>
  /** Latest available quote. */
  getQuote(symbol: string): Promise<DataResult<Quote>>
  /** Instrument metadata, used to confirm what a symbol actually is. */
  getInstrument(symbol: string): Promise<DataResult<InstrumentInfo>>
}

/** Coerces a provider's string-or-number price into the canonical string form. */
export function normalisePrice(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null
  const text = typeof value === 'string' ? value.trim() : String(value)
  if (!/^-?\d+(\.\d+)?([eE][-+]?\d+)?$/.test(text)) return null
  const asNumber = Number(text)
  if (!Number.isFinite(asNumber)) return null
  return text
}
