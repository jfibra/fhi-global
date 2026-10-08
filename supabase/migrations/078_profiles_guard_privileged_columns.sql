-- Migration 078: role, status, deletion and the company mailbox are admin-only
-- on profiles (Juliecor, 2026-10-08).
--
-- profiles_update_own lets a signed-in user update their own row and the
-- authenticated role has table-wide UPDATE, so until now anyone could make
-- themselves an active super_admin straight through the REST API, or point
-- mailbox_address (041 — shared SMTP login, inbound routing) at someone
-- else's address. profiles_insert_own had the same gap for a brand-new
-- account inserting its own row.
--
-- The app never writes these columns from a user's own session — role and
-- status changes go through server routes on the service role (admin users
-- API, invite approve/role, Google finalize, registration), and
-- complete-profile only edits names, contact fields and metadata. So:
--   * UPDATE by a signed-in user who isn't admin staff: changing role, status,
--     is_deleted or mailbox_address is refused (42501). Sending the same
--     values back unchanged is fine, so whole-row saves keep working.
--   * INSERT by such a user: the row starts least-privileged (the column
--     defaults — member, pending, not deleted, no mailbox).
-- Admin staff (is_admin_profile), the service role and migrations pass.
--
-- Idempotent for the runner.

BEGIN;

CREATE OR REPLACE FUNCTION public.profiles_guard_privileged()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Only API callers acting as a user are limited; service_role and postgres pass.
  -- Two IFs, not one OR: anon may not execute is_admin_profile().
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;
  IF current_user = 'authenticated' AND public.is_admin_profile(auth.uid()) THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.role := 'member';
    NEW.status := 'pending';
    NEW.is_deleted := false;
    NEW.mailbox_address := NULL;
    RETURN NEW;
  END IF;

  IF NEW.role IS DISTINCT FROM OLD.role
     OR NEW.status IS DISTINCT FROM OLD.status
     OR NEW.is_deleted IS DISTINCT FROM OLD.is_deleted
     OR NEW.mailbox_address IS DISTINCT FROM OLD.mailbox_address THEN
    RAISE EXCEPTION 'Only admin staff can change role, status, deletion or mailbox on a profile.'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_guard_privileged ON public.profiles;
CREATE TRIGGER trg_profiles_guard_privileged
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.profiles_guard_privileged();

COMMIT;
