-- Reference exchange rates.
--
-- Frankfurter's blended rates, which are its own calculation and free for
-- commercial use with no quota. Storing them locally is explicitly encouraged
-- by the provider, and it is what keeps the app from depending on a live call
-- to render a page.
--
-- These rates are for DISPLAY ONLY. They convert a total into a viewing
-- currency so a multi-currency portfolio can be read at a glance. They must
-- never feed a trade's recorded result: P&L is what the user recorded, and
-- re-deriving it from a rate that moves daily would silently rewrite history.
--
-- Kept separate from market_candles on purpose. Those are provider instrument
-- prices with instrument provenance; these are currency pair observations with
-- a different provider, a different licence, and daily granularity.

CREATE TABLE IF NOT EXISTS public.reference_rates (
  id bigserial PRIMARY KEY,
  base_currency text NOT NULL,
  quote_currency text NOT NULL,
  -- The rate's own date, which is not always the date requested: a weekend or
  -- holiday request resolves to the last published business day. Storing the
  -- effective date is what lets the UI show when the rate is actually from.
  rate_date date NOT NULL,
  rate numeric(30,12) NOT NULL,
  -- Frankfurter blended by default, or a provider key when queried directly.
  source text NOT NULL DEFAULT 'blended',
  provider text NOT NULL DEFAULT 'frankfurter',
  retrieved_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(provider, source, base_currency, quote_currency, rate_date)
);

CREATE INDEX IF NOT EXISTS reference_rates_pair_idx
  ON public.reference_rates(base_currency, quote_currency, rate_date DESC);

CREATE INDEX IF NOT EXISTS reference_rates_recent_idx
  ON public.reference_rates(rate_date DESC);

ALTER TABLE public.reference_rates ENABLE ROW LEVEL SECURITY;

-- Shared public data, like the market tables: readable by any signed-in user,
-- writable by none. Ingestion uses the service key, which bypasses RLS.
GRANT SELECT ON public.reference_rates TO authenticated;

CREATE POLICY reference_rates_read_all ON public.reference_rates
  FOR SELECT TO authenticated USING (true);

-- A viewing currency per user. Nullable so existing rows keep working; the app
-- falls back to a default when it is unset.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS display_currency text;
