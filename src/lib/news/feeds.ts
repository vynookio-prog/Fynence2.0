/**
 * Official RSS adapter for institutional releases.
 *
 * Two sources, both central banks publishing their own material over an
 * unauthenticated RSS feed:
 *
 * - Federal Reserve Board press releases
 * - European Central Bank press releases
 *
 * What this is NOT, and the reason the UI says so out loud: it is not market
 * news. These feeds carry each institution's own announcements and nothing
 * else. There are no equity stories, no commodity coverage, no market
 * commentary. Presenting them as general market news would misrepresent both
 * the sources and the coverage.
 *
 * Why RSS rather than the commercial candidates: Trading Economics answers 401
 * without a key and 410 for its discontinued guest account; Finnhub and FMP
 * require keys; GDELT rate-limits to one request per five seconds shared across
 * all callers, which a scheduled refresh cannot live with. GDELT returned 429
 * even after 45 seconds idle. Tested 2026-10-17.
 *
 * Two constraints are recorded here rather than assumed away:
 *
 * - Permission is not explicit. The Fed's feed page describes aggregators
 *   displaying "the links, headlines, and a brief summary of the feed", which
 *   describes a normal use but does not read as a licence grant. USAGov warns
 *   that federal material "may be subject to copyright or other restrictions"
 *   and directs enquiries to the managing agency. So this module stores only
 *   what RSS itself publishes — title, link, timestamp, source — and never a
 *   copied article body.
 * - These feeds have no forecast or actual/previous figures. An economic
 *   calendar in the usual sense cannot be built from them. `economic_events`
 *   stays empty; only dated releases are recorded.
 */

const FEEDS = {
  fed: {
    url: 'https://www.federalreserve.gov/feeds/press_all.xml',
    name: 'Federal Reserve Board',
    shortName: 'Fed',
    /** The institution's own words, shown next to the item. */
    attribution: 'Federal Reserve Board press releases (federalreserve.gov)',
    licenceNote:
      'Federal Reserve press releases via the Board\'s official RSS feed. Only the headline, link, and publication time shown; no article body copied.',
  },
  ecb: {
    url: 'https://www.ecb.europa.eu/rss/press.html',
    name: 'European Central Bank',
    shortName: 'ECB',
    attribution: 'European Central Bank press releases (ecb.europa.eu)',
    licenceNote:
      'ECB press releases via the institution\'s official RSS feed. Only the headline, link, and publication time shown; no article body copied.',
  },
} as const

export type FeedKey = keyof typeof FEEDS

export const FEED_KEYS = Object.keys(FEEDS) as FeedKey[]

export type ReleaseItem = {
  /** Stable identity for dedupe: the item's own link, else its guid. */
  externalId: string
  feed: FeedKey
  sourceName: string
  headline: string
  url: string
  /** The publisher's own publication time, ISO. Null when the feed omits it. */
  publishedAt: string | null
  category: string | null
  retrievedAt: string
}

export type FeedProvenance = {
  feed: FeedKey
  sourceName: string
  sourceUrl: string
  retrievedAt: string
  attribution: string
  licenceNote: string
}

export type FeedResult = {
  items: ReleaseItem[]
  provenance: FeedProvenance
  /** Present when the feed could not be read at all. */
  failure: string | null
}

/**
 * Reads one feed.
 *
 * A failure returns provenance alongside an empty list, so a caller can record
 * that a source was attempted and failed rather than leaving a gap that looks
 * identical to "no news today".
 */
export async function fetchFeed(feed: FeedKey, fetchImpl: typeof fetch = fetch): Promise<FeedResult> {
  const config = FEEDS[feed]
  const retrievedAt = new Date().toISOString()
  const provenance: FeedProvenance = {
    feed,
    sourceName: config.name,
    sourceUrl: config.url,
    retrievedAt,
    attribution: config.attribution,
    licenceNote: config.licenceNote,
  }

  let xml: string
  try {
    const response = await fetchImpl(config.url, {
      headers: { accept: 'application/rss+xml, application/xml, text/xml' },
      // Feeds change on publication, not per request.
      cache: 'no-store',
    })
    if (!response.ok) {
      return { items: [], provenance, failure: `HTTP ${response.status}` }
    }
    xml = await response.text()
  } catch (error) {
    return {
      items: [],
      provenance,
      failure: error instanceof Error ? error.message : 'network error',
    }
  }

  return { items: parseFeed(xml, feed, retrievedAt), provenance, failure: null }
}

/** Reads every configured feed, one result per source. */
export async function fetchAllFeeds(fetchImpl: typeof fetch = fetch): Promise<FeedResult[]> {
  return Promise.all(FEED_KEYS.map(key => fetchFeed(key, fetchImpl)))
}

const decode = (value: string): string =>
  value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    // Ampersand last: decoding it first would turn "&amp;lt;" into "<".
    .replace(/&amp;/g, '&')
    .trim()

const tag = (block: string, name: string): string | null => {
  const match = new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, 'i').exec(block)
  return match ? decode(match[1]) : null
}

/**
 * Parses RSS 2.0 with a small purpose-built reader.
 *
 * A general XML parser would be the wrong tool here: the only input is two
 * known feeds whose shape is stable, and pulling in a parser to read six tags
 * adds a dependency for no coverage gain. Anything unexpected degrades to a
 * skipped item rather than a thrown error — one malformed entry must not cost
 * the whole feed.
 */
export function parseFeed(xml: string, feed: FeedKey, retrievedAt: string): ReleaseItem[] {
  const blocks = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) ?? []
  const sourceName = FEEDS[feed].name
  const items: ReleaseItem[] = []

  for (const block of blocks) {
    const headline = tag(block, 'title')
    const link = tag(block, 'link')
    const guid = tag(block, 'guid')

    // An item with no headline or no destination cannot be shown honestly.
    if (!headline || !link) continue

    const externalId = guid ?? link
    const pubDate = tag(block, 'pubDate')

    items.push({
      externalId,
      feed,
      sourceName,
      headline,
      url: link,
      publishedAt: toIso(pubDate),
      category: tag(block, 'category'),
      retrievedAt,
    })
  }

  // Newest first; items without a timestamp sort last rather than being dropped.
  return items.sort((a, b) => {
    if (a.publishedAt === null && b.publishedAt === null) return 0
    if (a.publishedAt === null) return 1
    if (b.publishedAt === null) return -1
    return b.publishedAt.localeCompare(a.publishedAt)
  })
}

/** RSS dates are RFC 822. An unparseable one becomes null, never "now". */
function toIso(pubDate: string | null): string | null {
  if (!pubDate) return null
  const parsed = new Date(pubDate)
  if (Number.isNaN(parsed.valueOf())) return null
  return parsed.toISOString()
}
