-- Least-privilege defaults for auto-created profiles.
--
-- The handle_new_user trigger (and ensureProfileForUser / the Google finalize
-- fallback) insert a profile with only id/name and rely on the column defaults
-- for role + status. Those defaults were 'agent' / 'active', which — combined
-- with Google sign-in creating the auth user before the client-side finalize
-- call — let anyone self-provision an ACTIVE AGENT by skipping finalize.
--
-- Default to the lowest-privilege, non-active state instead, so a skipped or
-- failed provisioning step can never yield elevated or active access; finalize
-- (and the register/admin routes, which set role+status explicitly and are
-- unaffected) UP-grant from there.
BEGIN;

ALTER TABLE public.profiles ALTER COLUMN role SET DEFAULT 'member';
ALTER TABLE public.profiles ALTER COLUMN status SET DEFAULT 'pending';

COMMIT;
