-- Institutional releases from official RSS feeds.
--
-- The Fed and ECB publish their own announcements over unauthenticated RSS.
-- This table stores them.
--
-- What this table is NOT: a market news feed. These two sources carry each
-- institution's own press releases and nothing else — no equity coverage, no
-- commodity stories, no market commentary. The app labels the scope wherever
-- these rows are shown, because calling a central bank's press page "market
-- news" would misstate both the source and the coverage.
--
-- Why RSS rather than the commercial candidates, all tested 2026-10-17:
-- Trading Economics answers 401 without a key and 410 for its discontinued
-- guest account; Finnhub and FMP both require keys; GDELT rate-limits to one
-- request per five seconds shared across callers and returned 429 even after
-- 45 seconds idle, so a scheduled refresh cannot use it.
--
-- Permission note, recorded rather than assumed: the Fed's feed page describes
-- aggregators displaying "the links, headlines, and a brief summary of the
-- feed", which describes a normal use but does not read as an explicit licence
-- grant. USAGov warns federal material "may be subject to copyright or other
-- restrictions" and directs enquiries to the managing agency. This table
-- therefore holds only what RSS itself publishes — headline, link, timestamp,
-- category, source — and never an article body. If a feed's terms change, the
-- rows are deleted by dropping a feed's data, not by rewriting history.

CREATE TABLE IF NOT EXISTS public.release_items (
  id bigserial PRIMARY KEY,
  -- 'fed' or 'ecb'. Which feed this came from, so a bad source is removable.
  feed text NOT NULL,
  -- The item's own identity: its guid, or its link when the feed omits a guid.
  -- Unique per feed so re-reading a feed is idempotent.
  external_id text NOT NULL,
  source_name text NOT NULL,
  headline text NOT NULL,
  url text NOT NULL,
  category text,
  -- The publisher's own publication time. Nullable: an item whose date could
  -- not be parsed is stored as undated rather than stamped with "now", which
  -- would invent a timestamp the source never gave.
  published_at timestamptz,
  -- When our server read the feed. Distinct from published_at on purpose:
  -- this is our retrieval, that is their publication.
  retrieved_at timestamptz NOT NULL DEFAULT now(),
  -- The attribution this row must be displayed with.
  attribution text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(feed, external_id)
);

CREATE INDEX IF NOT EXISTS release_items_published_idx
  ON public.release_items(published_at DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS release_items_feed_idx
  ON public.release_items(feed, published_at DESC NULLS LAST);

ALTER TABLE public.release_items ENABLE ROW LEVEL SECURITY;

-- Shared public data, like the market and rate tables: readable by any signed-in
-- user, writable by none. Ingestion uses the service key, which bypasses RLS.
GRANT SELECT ON public.release_items TO authenticated;

CREATE POLICY release_items_read_all ON public.release_items
  FOR SELECT TO authenticated USING (true);
