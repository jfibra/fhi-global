-- Migration 073: the password an admin last set for each developer login.
--
-- Admin → Developers Login has a Show button (boss request, 2026-10-02). Supabase
-- Auth keeps only a one-way hash, so the app keeps its own copy of every
-- password an admin sets for a developer account, AES-256-GCM encrypted in
-- lib/developer-login-secrets.ts before it reaches this table. A developer
-- changing their own password (Profile Settings) deletes their row, so Show
-- never offers a password that no longer works.
--
-- Service role only: RLS on with no policies, nothing granted to anon or
-- authenticated. No audit trigger on purpose (the app logs every view).
--
-- Additive and idempotent for the runner.

BEGIN;

CREATE TABLE IF NOT EXISTS public.developer_login_secrets (
  profile_id  uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  ciphertext  text NOT NULL,
  set_by      uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  set_by_name text,
  set_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.developer_login_secrets ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.developer_login_secrets FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.developer_login_secrets TO service_role;

COMMENT ON TABLE public.developer_login_secrets IS
  'Admin-set developer login passwords, AES-256-GCM encrypted by the app (lib/developer-login-secrets.ts). Service role only.';

COMMIT;
