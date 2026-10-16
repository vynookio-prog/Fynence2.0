-- Revoke the write privileges the `anon` role was granted by default.
--
-- These grants are currently INERT: every RLS policy in this schema is scoped to
-- `authenticated`, and RLS denies by default, so an anonymous caller cannot
-- touch a row. Verified directly — an anon DELETE returned HTTP 204 while every
-- row survived, and an anon INSERT was rejected 401.
--
-- So this is not a breach fix. It removes a misleading signal. A DELETE that
-- answers 204 while deleting nothing is indistinguishable from a real deletion,
-- which makes an attack look like it worked and hides a genuine one. With the
-- grant gone the same request answers 403/401, so the response matches reality.
--
-- SELECT is revoked too, for the same reason: an anonymous read of a private
-- table answering 200 with [] reads like "there is no data here" rather than
-- "you are not allowed to see it".
--
-- Nothing in the app is affected: it talks to these tables either as an
-- authenticated user or through the service key, which bypasses grants and RLS
-- entirely.

DO $$
DECLARE
  t text;
BEGIN
  FOR t IN
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r'
  LOOP
    EXECUTE format('REVOKE ALL ON public.%I FROM anon', t);
  END LOOP;
END $$;

-- Belt and braces: strips the default privileges that would grant `anon` on any
-- table created later. Without this, the next migration that adds a table
-- silently reintroduces the same misleading responses.
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon;
