-- Migration 026: drop the developer-invite feature
-- The admin "Invite Registration" flow (/join/<token> self-registration) was
-- replaced by admin-only direct developer-account creation. This removes the
-- backing table and its claim/release RPCs. Migration 013 has been neutralized
-- to a no-op so the re-apply-all runner stops recreating the table before this
-- drop runs. Idempotent.

BEGIN;

DROP FUNCTION IF EXISTS public.claim_developer_invite(text);
DROP FUNCTION IF EXISTS public.release_developer_invite(uuid);
DROP TABLE IF EXISTS public.developer_invites CASCADE;

COMMIT;
