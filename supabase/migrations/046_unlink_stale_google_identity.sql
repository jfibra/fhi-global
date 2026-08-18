-- 046_unlink_stale_google_identity.sql
-- Service-role-only helper for the email-change flow (/api/account/email):
-- after the sign-in email rotates, any linked Google identity whose address no
-- longer matches must be removed, or the OLD address's "Sign in with Google"
-- button stays a permanent key to the account. The GoTrue admin REST endpoint
-- for identity deletion 404s on this instance, so the route calls this
-- function via RPC instead. Returns the number of identities removed.
--
-- Idempotent: the migration runner re-applies every file on each run.

BEGIN;

CREATE OR REPLACE FUNCTION public.admin_unlink_stale_google_identity(target_user uuid)
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH del AS (
    DELETE FROM auth.identities i
    USING auth.users u
    WHERE u.id = i.user_id
      AND i.user_id = target_user
      AND i.provider = 'google'
      AND lower(coalesce(i.identity_data->>'email', '')) IS DISTINCT FROM lower(coalesce(u.email, ''))
    RETURNING i.id
  )
  SELECT count(*)::integer FROM del;
$$;

REVOKE ALL ON FUNCTION public.admin_unlink_stale_google_identity(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_unlink_stale_google_identity(uuid) TO service_role;

COMMIT;
