-- Migration 050: "global_partner" user role
-- Agents based outside the UAE (initially the Philippines) recruited by FHI
-- Dubai agents through the Global Partners invite link. They register with
-- role global_partner and metadata.invited_by = the Dubai agent, so they
-- appear in that agent's recruits like any other upline relationship. Their
-- dashboard is read-only: the Top Sales and Top Developers rankings only.
-- App-layer access lives in lib/app-roles.ts / lib/auth.ts; this migration
-- only registers the role for profiles_role_fkey. Idempotent.

BEGIN;

INSERT INTO public.user_roles (name, label)
VALUES ('global_partner', 'Global Partner')
ON CONFLICT (name) DO UPDATE SET label = EXCLUDED.label;

COMMIT;
