-- 043_auth_user_emails_view.sql
-- Service-role-only bridge from login email -> profile id. profiles carries
-- no email column (emails live in auth.users), and PostgREST cannot join
-- across schemas — this view lets server routes put a registered sender's
-- profile photo on their inbound emails. anon/authenticated get no grant, so
-- nothing about registered emails leaks to clients.
--
-- Idempotent: the migration runner re-applies every file on each run.

BEGIN;

CREATE OR REPLACE VIEW public.auth_user_emails
WITH (security_invoker = off) AS
  SELECT id, lower(email) AS email
  FROM auth.users
  WHERE email IS NOT NULL;

REVOKE ALL ON public.auth_user_emails FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.auth_user_emails TO service_role;

COMMIT;
