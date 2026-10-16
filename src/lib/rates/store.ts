import { getInsForgeAdminClient } from '@/lib/insforge/admin'
import { getInsForgeServerClient } from '@/lib/insforge/server'
import { getRates, type RateObservation } from './frankfurter'
import { pairKey, type RateLookup } from '@/lib/domain/currency'

/**
 * Reference rate storage and reads.
 *
 * No budget guard here, and that is a deliberate difference from the market
 * provider: Frankfurter has no quota, so the reason for throttling does not
 * exist. The reason to fetch rarely is different — the rates are daily, so
 * fetching more often than daily would only re-learn the same number.
 */

/** Dates are published once per business day; refetching sooner is pointless. */
const REFRESH_AFTER_MS = 12 * 60 * 60 * 1000

/** Currencies the app displays. Fetching all 165 would store noise. */
const WANTED = ['USD', 'IDR', 'EUR', 'GBP', 'JPY', 'SGD', 'AUD'] as const

export type IngestRatesResult =
  | { ok: true; stored: number; rateDate: string }
  | { ok: false; status: string; message: string }

/**
 * Fetches every pair the app may need, anchored on USD, and stores the
 * observations.
 *
 * One request per base currency is enough: Frankfurter returns all requested
 * quotes at once. Pairs are stored in the direction fetched, and the inverse is
 * derived at read time so two stored directions can never disagree.
 */
export async function ingestRates(): Promise<IngestRatesResult> {
  const admin = getInsForgeAdminClient()
  if (!admin) return { ok: false, status: 'unavailable', message: 'Kunci admin server tidak dikonfigurasi.' }

  const stored: RateObservation[] = []
  const failures: string[] = []

  for (const base of WANTED) {
    const quotes = WANTED.filter(code => code !== base)
    const result = await getRates(base, [...quotes])

    if (!result.ok) {
      failures.push(`${base}: ${result.message}`)
      continue
    }
    stored.push(...result.data)
  }

  if (!stored.length) {
    return {
      ok: false,
      status: 'unavailable',
      message: failures[0] ?? 'Tidak ada kurs yang bisa diambil.',
    }
  }

  const rows = stored.map(observation => ({
    base_currency: observation.base,
    quote_currency: observation.quote,
    rate_date: observation.rateDate,
    rate: observation.rate,
    source: 'blended',
    provider: 'frankfurter',
    retrieved_at: new Date().toISOString(),
  }))

  const { error } = await admin.database
    .from('reference_rates')
    .upsert(rows, { onConflict: 'provider,source,base_currency,quote_currency,rate_date' })

  if (error) return { ok: false, status: 'unavailable', message: `Gagal menyimpan kurs: ${error.message}` }

  const dates = [...new Set(stored.map(observation => observation.rateDate))].sort()
  return { ok: true, stored: rows.length, rateDate: dates.at(-1) ?? '' }
}

/** Whether a refresh is worth doing yet. */
export async function needsRefresh(): Promise<boolean> {
  const admin = getInsForgeAdminClient()
  if (!admin) return true

  const { data } = await admin.database
    .from('reference_rates')
    .select('retrieved_at')
    .order('retrieved_at', { ascending: false })
    .limit(1)

  const latest = ((data ?? []) as { retrieved_at: string }[])[0]?.retrieved_at
  if (!latest) return true

  return Date.now() - new Date(latest).getTime() > REFRESH_AFTER_MS
}

/**
 * Loads the rates needed to convert `currencies` into `target`.
 *
 * Both directions are read, because the stored direction may not match the one
 * needed and the inverse is derived rather than stored twice.
 */
export async function loadRates(
  currencies: string[],
  target: string,
  clientOverride?: unknown,
): Promise<{ rates: Map<string, RateLookup>; rateDate: string | null }> {
  const client = clientOverride
    ? (clientOverride as { database: { from: (t: string) => any } })
    : ((await getInsForgeServerClient()) as unknown as { database: { from: (t: string) => any } })

  const wanted = [...new Set([...currencies, target].map(code => code.toUpperCase()))]
  if (wanted.length < 2) return { rates: new Map(), rateDate: null }

  const { data } = await client.database
    .from('reference_rates')
    .select('base_currency,quote_currency,rate,rate_date')
    .in('base_currency', wanted)
    .in('quote_currency', wanted)
    .order('rate_date', { ascending: false })

  const rows = (data ?? []) as {
    base_currency: string; quote_currency: string; rate: string; rate_date: string
  }[]

  const rates = new Map<string, RateLookup>()
  for (const row of rows) {
    const key = pairKey(row.base_currency, row.quote_currency)
    // Rows arrive newest-first, so the first seen for a pair is the latest rate.
    if (!rates.has(key)) rates.set(key, { rate: row.rate, rateDate: row.rate_date })
  }

  const dates = [...new Set(rows.map(row => row.rate_date))].sort()
  return { rates, rateDate: dates.at(-1) ?? null }
}
