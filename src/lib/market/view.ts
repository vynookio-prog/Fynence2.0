import { getInsForgeAdminClient } from '@/lib/insforge/admin'
import { MAX_INSTRUMENTS, type CatalogueEntry, type SelectedInstrument } from './selection'

// Re-exported so server callers keep one import site, while the definitions
// stay in a module a client component can safely reference.
export { MAX_INSTRUMENTS }
export type { CatalogueEntry, SelectedInstrument }
import { getInsForgeServerClient } from '@/lib/insforge/server'
import type { Candle, DataErr } from './provider'
import { ingestSeries } from './ingest'
import type { MarketDataProvider } from './provider'

/**
 * The market view: what this user selected, and the bars behind it.
 *
 * The two ideas that shape this module are deliberately separate, because
 * conflating them is what makes a per-user view expensive:
 *
 * 1. WHICH instruments are rendered is the user's selection. Nothing else.
 *    The catalogue is global, but the view is not — a user sees their five,
 *    not the whole list.
 * 2. WHETHER a fetch is needed is a property of the cache, not of the user.
 *    If fresh bars for a symbol are already stored, a second user selecting
 *    that same symbol costs zero credits. The selection decides what is shown;
 *    it does not decide what is downloaded.
 *
 * That second point is the whole reason a per-user selection does not have to
 * mean per-user cost. Ten users selecting XAU/USD is one fetch, not ten.
 */

/** How long stored bars are considered good enough before a refetch. */
const FRESH_FOR_MS = 6 * 60 * 60 * 1000

/**
 * The client these reads go through.
 *
 * Production uses the cookie-scoped server client, so RLS applies to every
 * query. Tests can pass the admin client instead, because a test process has no
 * request scope and therefore no cookies to read. The query logic — and the
 * policies it would be subject to — is otherwise identical.
 */
type ReadClient = {
  database: {
    from: (table: string) => {
      select: (columns: string) => {
        eq: (column: string, value: string) => any
        in: (column: string, values: string[]) => any
        order: (column: string, options: { ascending: boolean }) => any
      }
    }
  }
}

async function readClient(override?: ReadClient): Promise<ReadClient> {
  return override ?? ((await getInsForgeServerClient()) as unknown as ReadClient)
}

/** How a symbol stands relative to the cache, before any fetching. */
export type CacheState =
  /** Fresh bars exist. Rendering costs nothing and calls no provider. */
  | { kind: 'fresh'; bars: number; latestBar: string | null; retrievedAt: string }
  /** Bars exist but are older than the freshness window. */
  | { kind: 'stale'; bars: number; latestBar: string | null; retrievedAt: string }
  /** Nothing stored for this symbol yet. */
  | { kind: 'absent' }

export async function listSelected(userId: string, clientOverride?: ReadClient): Promise<SelectedInstrument[]> {
  const client = await readClient(clientOverride)
  const { data } = await client.database
    .from('user_instruments')
    .select('provider,symbol,position')
    .eq('user_id', userId)
    .order('position', { ascending: true })

  return ((data ?? []) as SelectedInstrument[])
}

/**
 * What the catalogue offers: only instruments a fetch has actually proven
 * reachable. Offering a symbol that later fails would waste a credit and
 * disappoint the user who chose it.
 */
export async function listCatalogue(clientOverride?: ReadClient): Promise<CatalogueEntry[]> {
  const client = await readClient(clientOverride)
  const { data } = await client.database
    .from('market_instruments')
    .select('provider,symbol,instrument_type,exchange,currency')
    .eq('coverage', 'available')
    .order('symbol', { ascending: true })

  return ((data ?? []) as {
    provider: string; symbol: string; instrument_type: string
    exchange: string | null; currency: string | null
  }[]).map(row => ({
    provider: row.provider,
    symbol: row.symbol,
    instrumentType: row.instrument_type,
    exchange: row.exchange,
    currency: row.currency,
  }))
}

/**
 * Reads the cache state for a set of symbols in one query per user load.
 * Deliberately does not call the provider: seeing the shape of the cache must
 * never cost a credit, or merely opening the page becomes a spend.
 */
export async function readCacheStates(
  provider: string,
  symbols: string[],
): Promise<Map<string, CacheState>> {
  const states = new Map<string, CacheState>()
  if (!symbols.length) return states

  const admin = getInsForgeAdminClient()
  if (!admin) {
    for (const symbol of symbols) states.set(symbol, { kind: 'absent' })
    return states
  }

  const { data } = await admin.database
    .from('market_candles')
    .select('symbol,bar_time,retrieved_at')
    .eq('provider', provider)
    .in('symbol', symbols)
    .order('bar_time', { ascending: false })

  const grouped = new Map<string, { bars: number; latestBar: string | null; retrievedAt: string }>()
  for (const row of (data ?? []) as { symbol: string; bar_time: string; retrieved_at: string }[]) {
    const existing = grouped.get(row.symbol)
    if (!existing) {
      // Rows arrive newest-first, so the first one seen is the latest bar.
      grouped.set(row.symbol, { bars: 1, latestBar: row.bar_time, retrievedAt: row.retrieved_at })
      continue
    }
    existing.bars += 1
    // Keep the newest retrieval time, since a partial refetch may have touched
    // only some bars.
    if (row.retrieved_at > existing.retrievedAt) existing.retrievedAt = row.retrieved_at
  }

  const now = Date.now()
  for (const symbol of symbols) {
    const found = grouped.get(symbol)
    if (!found) {
      states.set(symbol, { kind: 'absent' })
      continue
    }
    const age = now - new Date(found.retrievedAt).getTime()
    states.set(symbol, { kind: age <= FRESH_FOR_MS ? 'fresh' : 'stale', ...found })
  }

  return states
}

/** Everything the market view needs to render one selected instrument. */
export type InstrumentView = {
  provider: string
  symbol: string
  state: CacheState
  candles: Candle[]
  /** Present when a fetch was attempted and failed. Never a silent gap. */
  failure: { status: DataErr['status'] | 'budget'; message: string } | null
}

export type MarketView = {
  instruments: InstrumentView[]
  /** Symbols skipped because the cache was fresh — zero credits spent. */
  servedFromCache: number
  fetched: number
  /** Total credits this load actually spent. */
  creditsUsed: number
}

/**
 * Builds the market view for a user.
 *
 * Fetches only what the cache cannot serve. A user whose five instruments are
 * all fresh pays nothing, which is what keeps a per-user view affordable.
 */
export async function buildMarketView(
  userId: string,
  provider: MarketDataProvider,
  interval: string,
  limit: number,
  clientOverride?: ReadClient,
): Promise<MarketView> {
  const selected = await listSelected(userId, clientOverride)
  if (!selected.length) {
    return { instruments: [], servedFromCache: 0, fetched: 0, creditsUsed: 0 }
  }

  const byProvider = new Map<string, string[]>()
  for (const item of selected) {
    byProvider.set(item.provider, [...(byProvider.get(item.provider) ?? []), item.symbol])
  }

  const cacheByProvider = new Map<string, Map<string, CacheState>>()
  for (const [providerId, symbols] of byProvider) {
    cacheByProvider.set(providerId, await readCacheStates(providerId, symbols))
  }

  const results: InstrumentView[] = []
  let creditsUsed = 0
  let fetched = 0
  let servedFromCache = 0

  for (const item of selected) {
    const state = cacheByProvider.get(item.provider)?.get(item.symbol) ?? { kind: 'absent' }

    // Fresh cache: render what is stored and do not touch the provider. This is
    // the branch that makes a second user's identical selection free.
    if (state.kind === 'fresh') {
      servedFromCache += 1
      results.push({
        provider: item.provider,
        symbol: item.symbol,
        state,
        candles: await readStoredCandles(item.provider, item.symbol, interval, 200, clientOverride),
        failure: null,
      })
      continue
    }

    const ingest = await ingestSeries(provider, item.symbol, interval, limit)
    creditsUsed += 1
    fetched += 1

    if (!ingest.ok) {
      // A failed refresh must not blank out bars already stored. Stale data
      // with a stated timestamp beats an empty chart.
      results.push({
        provider: item.provider,
        symbol: item.symbol,
        state,
        candles: await readStoredCandles(item.provider, item.symbol, interval, 200, clientOverride),
        failure: { status: ingest.status, message: ingest.message },
      })
      continue
    }

    results.push({
      provider: item.provider,
      symbol: item.symbol,
      state: { kind: 'fresh', bars: ingest.written, latestBar: ingest.provenance.sourceTimestamp, retrievedAt: ingest.provenance.retrievedAt },
      candles: await readStoredCandles(item.provider, item.symbol, interval, 200, clientOverride),
      failure: null,
    })
  }

  return { instruments: results, servedFromCache, fetched, creditsUsed }
}

/** Reads stored bars oldest-first, the order charts expect. */
export async function readStoredCandles(
  provider: string,
  symbol: string,
  interval: string,
  limit = 200,
  clientOverride?: ReadClient,
): Promise<Candle[]> {
  const client = await readClient(clientOverride)
  const { data } = await client.database
    .from('market_candles')
    .select('bar_time,open,high,low,close,volume')
    .eq('provider', provider)
    .eq('symbol', symbol)
    .eq('interval', interval)
    .order('bar_time', { ascending: false })
    .limit(limit)

  const rows = (data ?? []) as {
    bar_time: string; open: string; high: string; low: string; close: string; volume: string | null
  }[]

  return rows
    .map(row => ({
      time: row.bar_time,
      // Kept as the strings Postgres returned. Money never becomes a float.
      open: row.open, high: row.high, low: row.low, close: row.close, volume: row.volume,
    }))
    .reverse()
}
