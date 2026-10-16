-- Per-user watchlist: which instruments a user tracks on the Macro Desk.
-- Symbols are user-declared strings, not a validated market instrument list; the
-- app must render an unavailable state for any symbol without a verified source.

CREATE TABLE IF NOT EXISTS public.watchlists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'Utama' CHECK (length(trim(name)) BETWEEN 1 AND 80),
  symbols text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, name)
);

CREATE INDEX IF NOT EXISTS watchlists_owner_idx ON public.watchlists(user_id, created_at DESC);

-- A watchlist must not grow without bound; the app caps the list it writes.
ALTER TABLE public.watchlists
  ADD CONSTRAINT watchlists_symbols_cap CHECK (array_length(symbols, 1) IS NULL OR array_length(symbols, 1) <= 100);

ALTER TABLE public.watchlists ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.watchlists TO authenticated;

CREATE POLICY watchlists_select_own ON public.watchlists
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY watchlists_insert_own ON public.watchlists
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY watchlists_update_own ON public.watchlists
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY watchlists_delete_own ON public.watchlists
  FOR DELETE TO authenticated USING (user_id = auth.uid());
