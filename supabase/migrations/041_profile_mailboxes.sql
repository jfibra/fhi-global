-- 041_profile_mailboxes.sql
-- Personal company mailboxes. A profile with mailbox_address set gets an
-- Emails section in their own dashboard, and everything they compose is sent
-- AS that address (Hostinger rejects cross-mailbox From, so the server logs
-- in as the mailbox itself — all team mailboxes share the SMTP password that
-- already lives in the environment, so only the address is stored here).
--
-- Assigned by admins only: there is no client write path to this column
-- (profile self-service updates go through the profile API's allowlist).
--
-- Idempotent: the migration runner re-applies every file on each run.

BEGIN;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS mailbox_address TEXT;

-- One mailbox belongs to one person.
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_mailbox_address
  ON public.profiles (lower(mailbox_address))
  WHERE mailbox_address IS NOT NULL;

COMMIT;
