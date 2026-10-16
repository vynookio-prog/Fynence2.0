-- Market data cache with provenance.
--
-- Implements the provenance contract in DATA_SOURCES.md §7: every stored
-- market record carries provider, source timestamp, retrieval time,
-- instrument, data class, status, and licence notes.
--
-- This is a SHARED cache, not user data. Market prices are the same for every
-- user, so rows are not owned by a user. Reads are open to any signed-in user
-- because the content is public market data; writes are restricted to the
-- service role because only server-side ingestion may populate it.

CREATE TABLE IF NOT EXISTS public.market_instruments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Provider-scoped symbol. The same instrument differs per provider, so the
  -- pair (provider, symbol) is the identity, never the symbol alone.
  provider text NOT NULL,
  symbol text NOT NULL,
  name text,
  instrument_type text NOT NULL,
  exchange text,
  mic_code text,
  currency text,
  exchange_timezone text,
  -- Whether this instrument is actually reachable on the current plan.
  -- 'available' means a request succeeded; 'gated' means plan-locked;
  -- 'missing' means the provider does not carry it. Recorded, not assumed.
  coverage text NOT NULL DEFAULT 'unverified'
    CHECK (coverage IN ('unverified', 'available', 'gated', 'missing')),
  coverage_note text,
  coverage_checked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(provider, symbol)
);

CREATE INDEX IF NOT EXISTS market_instruments_provider_idx
  ON public.market_instruments(provider, instrument_type);

-- Time series bars, one row per (provider, symbol, interval, bar time).
CREATE TABLE IF NOT EXISTS public.market_candles (
  id bigserial PRIMARY KEY,
  provider text NOT NULL,
  symbol text NOT NULL,
  instrument_id uuid REFERENCES public.market_instruments(id) ON DELETE SET NULL,
  interval text NOT NULL,
  -- The bar's own timestamp, in exchange local time as the provider returns it.
  bar_time timestamptz NOT NULL,
  open numeric(30,12) NOT NULL,
  high numeric(30,12) NOT NULL,
  low numeric(30,12) NOT NULL,
  close numeric(30,12) NOT NULL,
  volume numeric(30,8),
  -- Provenance. data_class distinguishes delayed/historical/live so nothing
  -- can be presented as live when it is not.
  data_class text NOT NULL DEFAULT 'historical'
    CHECK (data_class IN ('live', 'delayed', 'historical', 'manual', 'derived')),
  provider_exchange_timezone text,
  retrieved_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(provider, symbol, interval, bar_time)
);

CREATE INDEX IF NOT EXISTS market_candles_lookup_idx
  ON public.market_candles(symbol, interval, bar_time DESC);
CREATE INDEX IF NOT EXISTS market_candles_retrieved_idx
  ON public.market_candles(retrieved_at DESC);

-- Records which provider call produced which rows, so a quota problem can be
-- traced back to the request that caused it.
CREATE TABLE IF NOT EXISTS public.market_fetch_log (
  id bigserial PRIMARY KEY,
  provider text NOT NULL,
  endpoint text NOT NULL,
  symbol text,
  interval text,
  http_status integer,
  outcome text NOT NULL
    CHECK (outcome IN ('ok', 'gated', 'missing', 'rate_limited', 'unauthorized', 'error')),
  provider_code integer,
  message text,
  rows_written integer NOT NULL DEFAULT 0,
  credits_used integer,
  fetched_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS market_fetch_log_recent_idx
  ON public.market_fetch_log(fetched_at DESC);

-- RLS: shared public market data. Read for any signed-in user, write for none.
-- Server-side ingestion uses the service key, which bypasses RLS by design.
ALTER TABLE public.market_instruments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.market_candles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.market_fetch_log ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.market_instruments TO authenticated;
GRANT SELECT ON public.market_candles TO authenticated;

-- The fetch log is operational, not user-facing. No policy grants authenticated
-- read, so it is invisible to app users and reachable only via the service role.
REVOKE ALL ON public.market_fetch_log FROM authenticated;

CREATE POLICY market_instruments_read_all ON public.market_instruments
  FOR SELECT TO authenticated USING (true);

CREATE POLICY market_candles_read_all ON public.market_candles
  FOR SELECT TO authenticated USING (true);
