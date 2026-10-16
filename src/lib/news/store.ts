import { getInsForgeAdminClient } from '@/lib/insforge/admin'
import { getInsForgeServerClient } from '@/lib/insforge/server'
import { fetchAllFeeds, type FeedResult, type ReleaseItem } from './feeds'

/**
 * Reading and writing release items.
 *
 * Same split as the market and rate layers: writes go through the service
 * client, reads go through whatever client the caller has. The table is
 * read-only for signed-in users by RLS.
 *
 * Ingestion is idempotent. Re-reading a feed re-upserts the same rows against
 * `(feed, external_id)`, so running the refresh twice costs nothing and
 * duplicates nothing.
 */

/** How stale a stored set may be before a page load should refresh it. */
export const REFRESH_AFTER_MS = 3 * 60 * 60 * 1000

export type StoredRelease = ReleaseItem & {
  id: number
  /** The attribution this row must be shown with, stored per row. */
  attribution: string
}

/**
 * Records one feed's items.
 *
 * Returns the number of rows written, or an error string. An unchecked write
 * is how a silent failure happens, so the caller always gets one or the other.
 */
export async function storeFeedItems(result: FeedResult): Promise<{ written: number; error: string | null }> {
  if (!result.items.length) {
    return { written: 0, error: result.failure }
  }

  const client = await getInsForgeAdminClient()
  if (!client) {
    return { written: 0, error: 'server not configured' }
  }
  const rows = result.items.map(item => ({
    // Explicit snake_case: the SDK does not translate field names, and a
    // camelCase payload comes back as PGRST204 "column does not exist".
    feed: item.feed,
    external_id: item.externalId,
    source_name: item.sourceName,
    headline: item.headline,
    url: item.url,
    category: item.category,
    published_at: item.publishedAt,
    retrieved_at: item.retrievedAt,
    attribution: result.provenance.attribution,
  }))

  const { error } = await client.database
    .from('release_items')
    .upsert(rows, { onConflict: 'feed,external_id' })

  if (error) {
    return { written: 0, error: error.message ?? 'upsert failed' }
  }
  return { written: rows.length, error: null }
}

/** Reads every configured feed and stores what it finds. */
export async function refreshReleases(
  fetchImpl: typeof fetch = fetch,
): Promise<{ written: number; sources: { feed: string; items: number; failure: string | null }[] }> {
  const results = await fetchAllFeeds(fetchImpl)
  const sources: { feed: string; items: number; failure: string | null }[] = []
  let written = 0

  for (const result of results) {
    const { written: count, error } = await storeFeedItems(result)
    written += count
    sources.push({
      feed: result.provenance.feed,
      items: result.items.length,
      failure: error ?? result.failure,
    })
  }

  return { written, sources }
}

export type ReleaseFeedState = {
  items: StoredRelease[]
  /** When our server last read the feeds, newest across all rows. */
  retrievedAt: string | null
  /** True when nothing has ever been stored. */
  empty: boolean
  /** True when the stored set is older than REFRESH_AFTER_MS. */
  stale: boolean
  /** Distinct sources present, for the coverage note. */
  sources: string[]
  error: string | null
}

/**
 * Reads stored releases.
 *
 * Never fetches. A page load reads what is stored and reports its age; calling
 * an external publisher on every page view would be both slow and impolite.
 * Refreshing is the cron job's job.
 */
export async function readReleases(limit = 50): Promise<ReleaseFeedState> {
  const client = await getInsForgeServerClient()
  const { data, error } = await client.database
    .from('release_items')
    .select('id,feed,source_name,headline,url,published_at,retrieved_at,category,attribution,external_id')
    .order('published_at', { ascending: false, nullsFirst: false })
    .limit(limit)

  if (error) {
    return { items: [], retrievedAt: null, empty: true, stale: false, sources: [], error: error.message }
  }

  const rows = (data ?? []) as {
    id: number; feed: string; source_name: string; headline: string; url: string
    published_at: string | null; retrieved_at: string; category: string | null
    attribution: string; external_id: string
  }[]

  const items: StoredRelease[] = rows.map(row => ({
    id: row.id,
    externalId: row.external_id,
    feed: row.feed as ReleaseItem['feed'],
    sourceName: row.source_name,
    headline: row.headline,
    url: row.url,
    publishedAt: row.published_at,
    category: row.category,
    retrievedAt: row.retrieved_at,
    attribution: row.attribution,
  }))

  const retrievedAt = items.length
    ? items.map(i => i.retrievedAt).sort().at(-1) ?? null
    : null

  return {
    items,
    retrievedAt,
    empty: items.length === 0,
    stale: retrievedAt !== null && Date.now() - new Date(retrievedAt).valueOf() > REFRESH_AFTER_MS,
    sources: [...new Set(items.map(i => i.sourceName))].sort(),
    error: null,
  }
}
