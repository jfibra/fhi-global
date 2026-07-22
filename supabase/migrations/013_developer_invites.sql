-- Migration 013: developer_invites
-- Admin-generated invite links that let developer "members" self-register bound
-- to a specific developer (pre-bound link) or pick one (generic link). Tokens
-- are created / validated / claimed only through server routes on the
-- service-role client; browsers never write. RLS enables admin read for the
-- management UI. Idempotent: the runner re-applies every file each run.

BEGIN;

CREATE TABLE IF NOT EXISTS public.developer_invites (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token         text NOT NULL,                         -- url-safe, ~32 chars (192 bits)
  developer_id  uuid REFERENCES public.developers (id),-- NULL = generic (registrant picks)
  created_by    uuid REFERENCES public.profiles (id),
  label         text,
  auto_activate boolean NOT NULL DEFAULT true,         -- true → redeemed profile 'active'; false → 'pending'
  expires_at    timestamptz,                           -- NULL = never
  max_uses      integer,                               -- NULL = unlimited
  use_count     integer NOT NULL DEFAULT 0,
  is_active     boolean NOT NULL DEFAULT true,          -- admin revoke
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  deleted_at    timestamptz
);

COMMENT ON TABLE public.developer_invites IS
  'Admin-generated developer-member invite links. Redeemed at /join/<token>. Writes via service-role only.';
COMMENT ON COLUMN public.developer_invites.developer_id IS
  'Pre-bound developer; NULL = generic link (registrant picks an active developer).';
COMMENT ON COLUMN public.developer_invites.auto_activate IS
  'true → redeemed profile status active; false → pending (admin approves).';

CREATE UNIQUE INDEX IF NOT EXISTS developer_invites_token_uniq
  ON public.developer_invites (token);
CREATE INDEX IF NOT EXISTS developer_invites_created_by_idx
  ON public.developer_invites (created_by) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS developer_invites_developer_idx
  ON public.developer_invites (developer_id) WHERE deleted_at IS NULL;

ALTER TABLE public.developer_invites ENABLE ROW LEVEL SECURITY;

-- Admin / super_admin read for the management list; NO client write policy
-- (create / validate / claim / revoke all run on the service-role client).
-- is_admin_profile() is defined in 008_audit_logs.sql, applied earlier.
DROP POLICY IF EXISTS "developer_invites_select_admin" ON public.developer_invites;
CREATE POLICY "developer_invites_select_admin"
  ON public.developer_invites FOR SELECT TO authenticated
  USING (public.is_admin_profile(auth.uid()));

-- Atomic claim: increment use_count only if the link is still redeemable, in a
-- single statement so two concurrent redemptions can't both take the last slot.
-- Returns the row (one) on success, nothing when expired / maxed / revoked /
-- deleted. Called via admin.rpc('claim_developer_invite', { _token }).
CREATE OR REPLACE FUNCTION public.claim_developer_invite(_token text)
RETURNS TABLE (id uuid, developer_id uuid, auto_activate boolean, created_by uuid, use_count integer)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.developer_invites
     SET use_count = use_count + 1,
         updated_at = now()
   WHERE token = _token
     AND is_active
     AND deleted_at IS NULL
     AND (expires_at IS NULL OR expires_at > now())
     AND (max_uses IS NULL OR use_count < max_uses)
  RETURNING id, developer_id, auto_activate, created_by, use_count;
$$;

REVOKE ALL ON FUNCTION public.claim_developer_invite(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_developer_invite(text) TO service_role;

-- Atomic release of a claimed-but-unused slot (e.g. duplicate email, failed
-- profile write). A single self-referencing UPDATE under the row lock so it
-- can't clobber a concurrent claim's increment or drive the count negative.
CREATE OR REPLACE FUNCTION public.release_developer_invite(_id uuid)
RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.developer_invites
     SET use_count = use_count - 1, updated_at = now()
   WHERE id = _id AND use_count > 0;
$$;

REVOKE ALL ON FUNCTION public.release_developer_invite(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.release_developer_invite(uuid) TO service_role;

COMMIT;
