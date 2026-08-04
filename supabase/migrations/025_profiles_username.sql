-- Migration 025: profiles.username
-- Developer partner accounts sign in with a username (not an email) at
-- /developer-login. The username is stored here and mapped to a synthetic
-- Supabase auth email (<username>@developers.fhiglobal.ae) in application code
-- (lib/developer-accounts.ts). A partial, case-insensitive unique index keeps
-- usernames unique without constraining the many rows that have none (NULL).
-- Idempotent: the runner re-applies every file each run.

BEGIN;

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS username text;

COMMENT ON COLUMN public.profiles.username IS
  'Login handle for developer accounts (username sign-in at /developer-login). NULL for everyone else.';

CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_lower_key
  ON public.profiles (lower(username)) WHERE username IS NOT NULL;

COMMIT;
