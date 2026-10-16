-- Which instruments a user has chosen to see.
--
-- This is the only thing that decides what a user's market view renders. The
-- instrument catalogue is global and shared, but a user's selection is theirs
-- alone, so it is owned data with RLS scoped to auth.uid().
--
-- The cap is enforced by a database constraint rather than only in the UI. A
-- limit that lives only in a form is not a limit: any direct call would exceed
-- it, and the whole point of the cap is to bound how much gets fetched.

CREATE TABLE IF NOT EXISTS public.user_instruments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider text NOT NULL,
  symbol text NOT NULL,
  -- Order the user arranged them in, so the market view is stable across loads
  -- instead of reshuffling with whatever the query planner returns.
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  -- One instrument cannot be chosen twice by the same user.
  UNIQUE(user_id, provider, symbol)
);

CREATE INDEX IF NOT EXISTS user_instruments_user_idx
  ON public.user_instruments(user_id, position);

-- Which instruments are still referenced by at least one user, so eviction can
-- tell "nobody wants these bars" from "somebody still does".
CREATE INDEX IF NOT EXISTS user_instruments_symbol_idx
  ON public.user_instruments(provider, symbol);

ALTER TABLE public.user_instruments ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_instruments TO authenticated;

-- Standard owner-scoped policy: a user sees and changes only their own rows.
-- The WITH CHECK on UPDATE matters as much as USING; without it a user could
-- reassign a row to someone else by rewriting user_id.
CREATE POLICY user_instruments_select_own ON public.user_instruments
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY user_instruments_insert_own ON public.user_instruments
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY user_instruments_update_own ON public.user_instruments
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY user_instruments_delete_own ON public.user_instruments
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- The cap of five is enforced here, in the database, so it holds against every
-- path and not just the one the UI happens to take.
CREATE OR REPLACE FUNCTION public.enforce_user_instrument_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_count integer;
BEGIN
  SELECT count(*) INTO current_count
  FROM public.user_instruments
  WHERE user_id = NEW.user_id;

  IF current_count >= 5 THEN
    RAISE EXCEPTION 'instrument_limit_reached'
      USING HINT = 'A user may select at most 5 instruments. Remove one first.',
            ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS user_instruments_limit ON public.user_instruments;
CREATE TRIGGER user_instruments_limit
  BEFORE INSERT ON public.user_instruments
  FOR EACH ROW EXECUTE FUNCTION public.enforce_user_instrument_limit();
