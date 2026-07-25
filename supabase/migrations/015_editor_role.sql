-- Migration 015: "editor" user role
-- Content editor — manages Developers and Projects (create/edit/delete + the
-- toggles on those pages). App-layer access control lives in lib/app-roles.ts /
-- lib/auth.ts / proxy.ts; this migration only registers the role so
-- profiles.role = 'editor' satisfies the profiles_role_fkey → user_roles(name).
-- Idempotent.

BEGIN;

INSERT INTO public.user_roles (name, label)
VALUES ('editor', 'Editor')
ON CONFLICT (name) DO UPDATE SET label = EXCLUDED.label;

COMMIT;
