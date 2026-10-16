-- Trade screenshots: private per-user chart captures attached to journal entries.
-- Objects live in the private bucket "trade-screenshots"; this table stores metadata
-- so metadata reads can be scoped with ordinary table RLS instead of storage list calls.

CREATE TABLE IF NOT EXISTS public.trade_screenshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  trade_id uuid NOT NULL REFERENCES public.trades(id) ON DELETE CASCADE,
  storage_key text NOT NULL,
  storage_url text,
  file_name text,
  mime_type text CHECK (mime_type IS NULL OR mime_type IN ('image/png','image/jpeg','image/webp')),
  byte_size bigint CHECK (byte_size IS NULL OR byte_size > 0),
  caption text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(storage_key)
);

CREATE INDEX IF NOT EXISTS trade_screenshots_trade_idx ON public.trade_screenshots(trade_id, created_at DESC);
CREATE INDEX IF NOT EXISTS trade_screenshots_owner_idx ON public.trade_screenshots(user_id, created_at DESC);

ALTER TABLE public.trade_screenshots ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.trade_screenshots TO authenticated;

CREATE POLICY trade_screenshots_select_own ON public.trade_screenshots
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY trade_screenshots_insert_own ON public.trade_screenshots
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY trade_screenshots_update_own ON public.trade_screenshots
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY trade_screenshots_delete_own ON public.trade_screenshots
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- Storage objects: owner-only for the private screenshot bucket.
-- RLS on storage.objects is disabled on fresh installs, so it is enabled here.
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
GRANT USAGE ON SCHEMA storage TO authenticated;

-- Keys are written as <user_id>/<trade_id>/<file>. The foldername check keeps one
-- user from writing into another user's prefix even if a client crafts the path.
CREATE POLICY storage_objects_screenshots_select ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket = 'trade-screenshots'
    AND (storage.foldername(key))[1] = (SELECT auth.jwt() ->> 'sub')
  );

CREATE POLICY storage_objects_screenshots_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket = 'trade-screenshots'
    AND (storage.foldername(key))[1] = (SELECT auth.jwt() ->> 'sub')
  );

CREATE POLICY storage_objects_screenshots_update ON storage.objects
  FOR UPDATE TO authenticated
  USING      (bucket = 'trade-screenshots' AND (storage.foldername(key))[1] = (SELECT auth.jwt() ->> 'sub'))
  WITH CHECK (bucket = 'trade-screenshots' AND (storage.foldername(key))[1] = (SELECT auth.jwt() ->> 'sub'));

CREATE POLICY storage_objects_screenshots_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket = 'trade-screenshots'
    AND (storage.foldername(key))[1] = (SELECT auth.jwt() ->> 'sub')
  );
