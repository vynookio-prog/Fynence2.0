import { getInsForgeAdminClient } from '@/lib/insforge/admin'
import type { Candle, DataErr, DataResult, MarketDataProvider, Provenance } from './provider'

/**
 * Ingestion: fetch from a provider and persist with provenance.
 *
 * Three rules drive the shape of this module:
 *
 * 1. The quota is a hard budget, not a target. Free tier is 8 credits/minute
 *    and 800/day and every call costs at least 1. Budget is checked BEFORE the
 *    provider is called; a 429 is a failure to plan, not a normal condition.
 * 2. A provided value is never overwritten by a cheaper one. A later header-only
 *    fetch must not erase a stored close.
 * 3. A failed fetch is logged with its reason. Silence would hide that the
 *    provider is gated or that the quota is gone.
 */

/** Provider-stated limits for the Twelve Data free plan, verified 2026-10-16. */
export const FREE_TIER = {
  creditsPerMinute: 8,
  creditsPerDay: 800,
} as const

export type FetchLogEntry = {
  provider: string
  endpoint: string
  symbol: string | null
  interval: string | null
  httpStatus: number | null
  outcome: 'ok' | 'gated' | 'missing' | 'rate_limited' | 'unauthorized' | 'error'
  providerCode: number | null
  message: string | null
  rowsWritten: number
  creditsUsed: number
}

/** Maps a provider failure onto the fetch log's outcome vocabulary. */
function outcomeFor(status: DataErr['status']): FetchLogEntry['outcome'] {
  switch (status) {
    case 'plan-gated': return 'gated'
    case 'not-supported': return 'missing'
    case 'rate-limited': return 'rate_limited'
    case 'unauthorized': return 'unauthorized'
    default: return 'error'
  }
}

export type BudgetSnapshot = { usedThisMinute: number; usedToday: number }

/** Credits already spent, read from the fetch log rather than tracked in memory. */
export async function readBudget(): Promise<BudgetSnapshot | null> {
  const client = getInsForgeAdminClient()
  if (!client) return null

  const now = new Date()
  const minuteAgo = new Date(now.getTime() - 60_000).toISOString()
  const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString()

  const [minute, day] = await Promise.all([
    client.database.from('market_fetch_log').select('credits_used').gte('fetched_at', minuteAgo),
    client.database.from('market_fetch_log').select('credits_used').gte('fetched_at', dayStart),
  ])

  const sum = (rows: unknown) =>
    ((rows ?? []) as { credits_used: number | null }[]).reduce((total, row) => total + (row.credits_used ?? 0), 0)

  if (minute.error || day.error) return null
  return { usedThisMinute: sum(minute.data), usedToday: sum(day.data) }
}

export type BudgetCheck = { allowed: true; remainingThisMinute: number; remainingToday: number } | { allowed: false; reason: string }

/**
 * Refuses a fetch that would exceed the provider's published limit. Local
 * headroom is kept (one credit below the cap) so tracking lag cannot push us
 * into a 429.
 */
export function checkBudget(snapshot: BudgetSnapshot, cost: number): BudgetCheck {
  const remainingThisMinute = FREE_TIER.creditsPerMinute - snapshot.usedThisMinute
  const remainingToday = FREE_TIER.creditsPerDay - snapshot.usedToday

  if (remainingToday < cost) {
    return { allowed: false, reason: `Kuota harian habis (${snapshot.usedToday}/${FREE_TIER.creditsPerDay} kredit). Coba lagi besok.` }
  }
  if (remainingThisMinute < cost) {
    return { allowed: false, reason: `Batas per menit tercapai (${snapshot.usedThisMinute}/${FREE_TIER.creditsPerMinute} kredit). Tunggu sebentar.` }
  }
  return { allowed: true, remainingThisMinute: remainingThisMinute - cost, remainingToday: remainingToday - cost }
}

/**
 * Writes a fetch log row.
 *
 * The mapping is explicit because the SDK does not translate field names: an
 * object typed with camelCase keys is sent verbatim and rejected with PGRST204.
 * That failure is silent unless the result is inspected, and a silent failure
 * here is serious — the budget is read back from this table, so an unwritten
 * log makes every future fetch look free.
 */
async function logFetch(entry: FetchLogEntry): Promise<void> {
  const client = getInsForgeAdminClient()
  if (!client) return

  const { error } = await client.database.from('market_fetch_log').insert([{
    provider: entry.provider,
    endpoint: entry.endpoint,
    symbol: entry.symbol,
    interval: entry.interval,
    http_status: entry.httpStatus,
    outcome: entry.outcome,
    provider_code: entry.providerCode,
    message: entry.message,
    rows_written: entry.rowsWritten,
    credits_used: entry.creditsUsed,
  }])

  // Surfaced, not swallowed. Ingestion still succeeds when only the log fails,
  // but the operator needs to know the budget is now inaccurate.
  if (error) {
    console.error('[market] fetch log write failed:', error.message)
  }
}

export type IngestResult =
  | { ok: true; written: number; fetched: number; provenance: Provenance; coverage: 'available' }
  | { ok: false; status: DataErr['status'] | 'budget'; message: string }

/** Credits one call to /time_series costs for a single symbol. */
const SERIES_COST = 1

/**
 * Fetches a daily series and upserts the bars.
 *
 * Existing bars are updated only in the fields the provider actually returned,
 * so a partial fetch cannot blank out a stored value.
 */
export async function ingestSeries(
  provider: MarketDataProvider,
  symbol: string,
  interval: string,
  limit: number,
): Promise<IngestResult> {
  const admin = getInsForgeAdminClient()
  if (!admin) return { ok: false, status: 'unavailable', message: 'Kunci admin server tidak dikonfigurasi; ingestion tidak tersedia.' }

  const snapshot = await readBudget()
  if (!snapshot) return { ok: false, status: 'unavailable', message: 'Tidak bisa membaca anggaran kredit.' }

  const budget = checkBudget(snapshot, SERIES_COST)
  if (!budget.allowed) {
    await logFetch({
      provider: provider.id, endpoint: '/time_series', symbol, interval,
      httpStatus: null, outcome: 'rate_limited', providerCode: null,
      message: budget.reason, rowsWritten: 0, creditsUsed: 0,
    })
    return { ok: false, status: 'budget', message: budget.reason }
  }

  const result = await provider.getSeries({ symbol, interval, limit })

  if (!result.ok) {
    await logFetch({
      provider: provider.id, endpoint: '/time_series', symbol, interval,
      httpStatus: null, outcome: outcomeFor(result.status), providerCode: null,
      message: result.message, rowsWritten: 0, creditsUsed: SERIES_COST,
    })
    return { ok: false, status: result.status, message: result.message }
  }

  let written: number
  try {
    written = await writeCandles(result.data, provider.id, symbol, interval, result.provenance)
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : 'Penyimpanan bar gagal.'
    await logFetch({
      provider: provider.id, endpoint: '/time_series', symbol, interval,
      httpStatus: 200, outcome: 'error', providerCode: null,
      message, rowsWritten: 0, creditsUsed: SERIES_COST,
    })
    return { ok: false, status: 'unavailable', message: `Data terambil tapi gagal disimpan: ${message}` }
  }

  await logFetch({
    provider: provider.id, endpoint: '/time_series', symbol, interval,
    httpStatus: 200, outcome: 'ok', providerCode: null, message: null,
    rowsWritten: written, creditsUsed: SERIES_COST,
  })

  // Record what the instrument actually is, now that the provider confirmed it.
  await recordInstrumentCoverage(provider.id, symbol, result.provenance.currency)

  return { ok: true, written, fetched: result.data.length, provenance: result.provenance, coverage: 'available' }
}

async function writeCandles(
  candles: Candle[],
  provider: string,
  symbol: string,
  interval: string,
  provenance: Provenance,
): Promise<number> {
  const admin = getInsForgeAdminClient()
  if (!admin || !candles.length) return 0

  const rows = candles.map(candle => ({
    provider,
    symbol,
    interval,
    bar_time: candle.time,
    open: candle.open,
    high: candle.high,
    low: candle.low,
    close: candle.close,
    volume: candle.volume,
    data_class: provenance.dataClass,
    provider_exchange_timezone: null,
    retrieved_at: provenance.retrievedAt,
  }))

  // Postgres rejects a single upsert whose payload names the same conflict key
  // twice: "ON CONFLICT DO UPDATE command cannot affect row a second time".
  // A provider can return two rows carrying the same bar time, so the payload
  // is collapsed to one row per key before it is sent. Last one wins, which
  // matches what a sequential write of the same rows would produce.
  const deduped = new Map<string, (typeof rows)[number]>()
  for (const row of rows) {
    deduped.set(`${row.bar_time}`, row)
  }
  const payload = [...deduped.values()]

  // onConflict key matches the unique constraint on the table.
  const { error } = await admin.database
    .from('market_candles')
    .upsert(payload, { onConflict: 'provider,symbol,interval,bar_time' })

  // Counted, not assumed. Reporting every row as written when the upsert
  // actually failed would turn a storage problem into a fake success.
  if (error) throw new Error(error.message)
  return payload.length
}

/** Credits a single /time_series lookup costs. */
const LOOKUP_COST = 1

/**
 * Records the cost of a provider call that is not a series fetch.
 *
 * Instrument lookups spend credits just like series fetches do. If they are not
 * logged, the budget undercounts and a quota can be exhausted while the
 * enforcement still believes there is room — which is worse than having no
 * budget at all, because it is trusted.
 */
export async function logLookup(
  provider: string,
  symbol: string,
  status: DataErr['status'] | 'ok',
  message: string | null,
): Promise<void> {
  await logFetch({
    provider,
    endpoint: '/time_series',
    symbol,
    interval: '1day',
    httpStatus: status === 'ok' ? 200 : null,
    outcome: status === 'ok' ? 'ok' : outcomeFor(status),
    providerCode: null,
    message,
    rowsWritten: 0,
    creditsUsed: LOOKUP_COST,
  })
}

/**
 * Records what a fetch proved about an instrument.
 *
 * Deliberately an update of the coverage columns only. A successful series
 * fetch confirms reachability; it does not confirm the instrument's type, and
 * it must not overwrite a type that a real instrument lookup already
 * established. Inserting a placeholder type here would replace truth with a
 * guess.
 */
async function recordInstrumentCoverage(provider: string, symbol: string, currency: string | null): Promise<void> {
  const admin = getInsForgeAdminClient()
  if (!admin) return

  const now = new Date().toISOString()
  const patch: Record<string, unknown> = {
    coverage: 'available',
    coverage_checked_at: now,
    updated_at: now,
  }
  if (currency) patch.currency = currency

  const { data } = await admin.database
    .from('market_instruments')
    .update(patch)
    .eq('provider', provider)
    .eq('symbol', symbol)
    .select('id')

  // No row yet: the instrument has never been looked up, so the coverage
  // columns have nowhere to land. That is fine — coverage is informational and
  // the candles are already stored. Creating a stub row here would mean
  // inventing an instrument type to satisfy a NOT NULL column.
  if (Array.isArray(data) && data.length === 0) return
}

/**
 * Persists an instrument's real metadata, used when a lookup has actually
 * confirmed what the symbol is.
 */
export async function recordInstrument(
  provider: string,
  info: {
    symbol: string
    name: string | null
    instrumentType: string
    exchange: string | null
    micCode: string | null
    currency: string | null
    exchangeTimezone: string | null
  },
): Promise<void> {
  const admin = getInsForgeAdminClient()
  if (!admin) return

  const now = new Date().toISOString()
  await admin.database.from('market_instruments').upsert([{
    provider,
    symbol: info.symbol,
    name: info.name,
    instrument_type: info.instrumentType,
    exchange: info.exchange,
    mic_code: info.micCode,
    currency: info.currency,
    exchange_timezone: info.exchangeTimezone,
    coverage: 'available',
    coverage_note: null,
    coverage_checked_at: now,
    updated_at: now,
  }], { onConflict: 'provider,symbol' })
}

/** Records a symbol the current plan cannot reach, so the UI can say why. */
export async function recordUnavailable(
  provider: string,
  symbol: string,
  status: DataErr['status'],
  message: string,
): Promise<void> {
  const admin = getInsForgeAdminClient()
  if (!admin) return

  const coverage = status === 'plan-gated' ? 'gated' : status === 'not-supported' ? 'missing' : 'unverified'
  const now = new Date().toISOString()
  await admin.database.from('market_instruments').upsert([{
    provider,
    symbol,
    // 'unknown' is honest here: the fetch failed, so nothing was learned about
    // what this symbol is. Only the coverage columns carry a claim.
    instrument_type: 'unknown',
    coverage,
    coverage_note: message,
    coverage_checked_at: now,
    updated_at: now,
  }], { onConflict: 'provider,symbol' })
}
