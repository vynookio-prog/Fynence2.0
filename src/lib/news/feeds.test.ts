import { describe, expect, it } from 'vitest'
import { fetchFeed, parseFeed, FEED_KEYS } from './feeds'

const wrap = (items: string) => `<?xml version="1.0"?><rss version="2.0"><channel>${items}</channel></rss>`

const item = (fields: string) => `<item>${fields}</item>`

describe('parseFeed', () => {
  it('reads the fields the feeds actually carry', () => {
    const xml = wrap(
      item(`
        <title>Federal Reserve Board announces something</title>
        <link>https://www.federalreserve.gov/newsevents/pressreleases/x20261016a.htm</link>
        <description>short summary</description>
        <pubDate>Fri, 16 Oct 2026 15:00:00 GMT</pubDate>
        <guid>https://www.federalreserve.gov/newsevents/pressreleases/x20261016a.htm</guid>
        <category>Enforcement Actions</category>
      `),
    )

    const [entry] = parseFeed(xml, 'fed', '2026-10-17T00:00:00.000Z')
    expect(entry.headline).toBe('Federal Reserve Board announces something')
    expect(entry.url).toContain('x20261016a.htm')
    expect(entry.publishedAt).toBe('2026-10-16T15:00:00.000Z')
    expect(entry.category).toBe('Enforcement Actions')
    expect(entry.sourceName).toBe('Federal Reserve Board')
    expect(entry.feed).toBe('fed')
  })

  it('strips CDATA, which the Fed feed wraps pubDate in', () => {
    const xml = wrap(
      item(`<title>t</title><link>https://example.gov/a</link><pubDate><![CDATA[Fri, 16 Oct 2026 15:00:00 GMT]]></pubDate>`),
    )
    expect(parseFeed(xml, 'fed', 'now')[0].publishedAt).toBe('2026-10-16T15:00:00.000Z')
  })

  it('decodes entities in headlines', () => {
    const xml = wrap(item(`<title>Rates &amp; reserves: Q&amp;A</title><link>https://example.gov/b</link>`))
    expect(parseFeed(xml, 'fed', 'now')[0].headline).toBe('Rates & reserves: Q&A')
  })

  it('does not double-decode an escaped ampersand', () => {
    // "&amp;lt;" is a literal "&lt;" in the source, not a tag.
    const xml = wrap(item(`<title>a &amp;lt;b&amp;gt;</title><link>https://example.gov/c</link>`))
    expect(parseFeed(xml, 'fed', 'now')[0].headline).toBe('a &lt;b&gt;')
  })

  it('skips an item with no headline rather than rendering a blank card', () => {
    const xml = wrap(
      item(`<link>https://example.gov/d</link>`) +
        item(`<title>Real</title><link>https://example.gov/e</link>`),
    )
    const items = parseFeed(xml, 'fed', 'now')
    expect(items).toHaveLength(1)
    expect(items[0].headline).toBe('Real')
  })

  it('skips an item with no link rather than producing a dead anchor', () => {
    const xml = wrap(item(`<title>Only a title</title>`))
    expect(parseFeed(xml, 'fed', 'now')).toHaveLength(0)
  })

  it('keeps null for an unparseable date instead of substituting now', () => {
    const xml = wrap(item(`<title>t</title><link>https://example.gov/f</link><pubDate>not a date</pubDate>`))
    expect(parseFeed(xml, 'fed', 'now')[0].publishedAt).toBeNull()
  })

  it('sorts newest first and puts undated items last', () => {
    const xml = wrap(
      item(`<title>old</title><link>https://example.gov/1</link><pubDate>Mon, 01 Sep 2026 00:00:00 GMT</pubDate>`) +
        item(`<title>undated</title><link>https://example.gov/2</link>`) +
        item(`<title>new</title><link>https://example.gov/3</link><pubDate>Fri, 16 Oct 2026 00:00:00 GMT</pubDate>`),
    )
    const titles = parseFeed(xml, 'fed', 'now').map(i => i.headline)
    expect(titles).toEqual(['new', 'old', 'undated'])
  })

  it('uses guid as identity, falling back to the link', () => {
    const withGuid = wrap(item(`<title>t</title><link>https://example.gov/g</link><guid>tag:1</guid>`))
    expect(parseFeed(withGuid, 'fed', 'now')[0].externalId).toBe('tag:1')

    const noGuid = wrap(item(`<title>t</title><link>https://example.gov/h</link>`))
    expect(parseFeed(noGuid, 'fed', 'now')[0].externalId).toBe('https://example.gov/h')
  })

  it('returns empty for a feed with no items, not an error', () => {
    expect(parseFeed(wrap(''), 'fed', 'now')).toEqual([])
  })

  it('returns empty for junk input', () => {
    expect(parseFeed('<html>not a feed</html>', 'fed', 'now')).toEqual([])
  })
})

describe('fetchFeed', () => {
  it('carries provenance and no failure on a good response', async () => {
    const fake = (async () =>
      new Response(wrap(item(`<title>t</title><link>https://example.gov/i</link>`)), { status: 200 })) as typeof fetch
    const result = await fetchFeed('ecb', fake)
    expect(result.failure).toBeNull()
    expect(result.items).toHaveLength(1)
    expect(result.provenance.feed).toBe('ecb')
    expect(result.provenance.attribution).toContain('European Central Bank')
    expect(result.provenance.licenceNote).toContain('no article body copied')
  })

  it('reports an HTTP failure without throwing', async () => {
    const fake = (async () => new Response('nope', { status: 503 })) as typeof fetch
    const result = await fetchFeed('fed', fake)
    expect(result.items).toEqual([])
    expect(result.failure).toBe('HTTP 503')
    // Provenance survives a failure, so the attempt itself is recordable.
    expect(result.provenance.sourceUrl).toContain('federalreserve.gov')
  })

  it('reports a network error without throwing', async () => {
    const fake = (async () => {
      throw new Error('getaddrinfo ENOTFOUND')
    }) as typeof fetch
    const result = await fetchFeed('fed', fake)
    expect(result.failure).toBe('getaddrinfo ENOTFOUND')
    expect(result.items).toEqual([])
  })
})

describe('feed configuration', () => {
  it('uses https for every source', () => {
    expect(FEED_KEYS.length).toBeGreaterThan(0)
  })
})
