import { NextResponse } from 'next/server'
import { createTwelveDataProvider } from '@/lib/market/twelvedata'
import { ingestSeries, readBudget, checkBudget } from '@/lib/market/ingest'
import { getInsForgeAdminClient } from '@/lib/insforge/admin'
import { ingestRates, needsRefresh } from '@/lib/rates/store'

/**
 * Scheduled refresh of the instruments users have actually selected.
 *
 * This is the piece that keeps a quota from depending on who happens to open
 * the page. It refreshes the union of every user's selection, once, on a
 * schedule, instead of each visitor triggering their own fetch.
 *
 * Three things this must get right:
 *
 * 1. It must not be callable by the public. The schedule passes a shared secret.
 *    Without that, anyone could trigger a refresh and burn the day's quota.
 * 2. It must respect the budget before spending, and stop when it runs out
 *    rather than failing its way through the whole list.
 * 3. It must skip instruments whose cache is still fresh. On a schedule this is
 *    what keeps a small quota sufficient.
 */

export const dynamic = 'force-dynamic'
export const maxDuration = 300

/** Instruments refreshed by one run, per day. Bounded so one run cannot drain it. */
const MAX_PER_RUN = 20

/** Bars pulled per instrument. Enough for a chart without paying for history. */
const BARS = 120

const INTERVAL = '1day'

function authorised(request: Request): boolean {
  const secret = process.env.CRON_SECRET
  // No secret configured means the endpoint refuses rather than running open.
  if (!secret) return false

  const header = request.headers.get('authorization') ?? ''
  const provided = header.startsWith('Bearer ') ? header.slice(7) : ''
  if (!provided || provided.length !== secret.length) return false

  // Constant-time-ish comparison: length is already matched above, and this
  // avoids leaking the secret through early-exit timing on the first mismatch.
  let mismatch = 0
  for (let index = 0; index < secret.length; index += 1) {
    mismatch |= secret.charCodeAt(index) ^ provided.charCodeAt(index)
  }
  return mismatch === 0
}

/** Every symbol referenced by at least one user, deduplicated. */
async function instrumentsInUse(): Promise<string[]> {
  const admin = getInsForgeAdminClient()
  if (!admin) return []

  // Only symbols that are known reachable. Refreshing a gated or missing symbol
  // would spend a credit to re-learn something already recorded.
  const { data: usable } = await admin.database
    .from('market_instruments')
    .select('symbol')
    .eq('provider', 'twelvedata')
    .eq('coverage', 'available')

  const allowed = new Set(((usable ?? []) as { symbol: string }[]).map(row => row.symbol))

  const { data: selected } = await admin.database
    .from('user_instruments')
    .select('symbol')
    .eq('provider', 'twelvedata')

  const symbols = new Set<string>()
  for (const row of (selected ?? []) as { symbol: string }[]) {
    if (allowed.has(row.symbol)) symbols.add(row.symbol)
  }
  return [...symbols]
}

export async function POST(request: Request) {
  if (!authorised(request)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const admin = getInsForgeAdminClient()
  if (!admin) {
    return NextResponse.json({ error: 'server not configured' }, { status: 503 })
  }

  const symbols = await instrumentsInUse()

  // Reference rates share this schedule rather than needing their own. They cost
  // no quota, and they are daily, so a 12-hour check is generous. Their absence
  // must not stop the market refresh, so a failure here is reported and ignored.
  let rates: { refreshed: boolean; stored?: number; rateDate?: string; error?: string }
  if (await needsRefresh()) {
    const ingested = await ingestRates()
    rates = ingested.ok
      ? { refreshed: true, stored: ingested.stored, rateDate: ingested.rateDate }
      : { refreshed: false, error: ingested.message }
  } else {
    rates = { refreshed: false }
  }

  if (!symbols.length) {
    return NextResponse.json({
      ok: true,
      refreshed: 0,
      reason: 'no instruments selected by any user',
      referenceRates: rates,
    })
  }

  const provider = createTwelveDataProvider()
  const refreshed: string[] = []
  const skipped: string[] = []
  const failed: { symbol: string; status: string; message: string }[] = []

  for (const symbol of symbols) {
    if (refreshed.length >= MAX_PER_RUN) {
      skipped.push(symbol)
      continue
    }

    // Budget is checked per symbol, not once up front, because the answer can
    // change while the run is in progress.
    const snapshot = await readBudget()
    if (!snapshot) break
    const budget = checkBudget(snapshot, 1)
    if (!budget.allowed) {
      skipped.push(symbol)
      continue
    }

    const result = await ingestSeries(provider, symbol, INTERVAL, BARS, { skipIfFresh: true })
    if (result.ok) refreshed.push(symbol)
    else if (result.status === 'still-fresh') skipped.push(symbol)
    else failed.push({ symbol, status: result.status, message: result.message })
  }

  // A run that touched nothing because the cache was warm is a success, not a
  // problem: it is exactly the behaviour that makes a small quota work.
  return NextResponse.json({
    ok: true,
    considered: symbols.length,
    refreshed: refreshed.length,
    refreshedSymbols: refreshed,
    skipped: skipped.length,
    failed,
    referenceRates: rates,
  })
}
