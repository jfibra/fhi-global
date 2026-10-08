-- Migration 077: the boss picks which agents the public site shows (boss via
-- Juliecor, 2026-10-08).
--
-- profiles.show_on_agents_page — an agent or team leader appears on /agents
-- (and among the About page's faces and agent count) only when admin staff
-- switch them on in Accounts & Invites → Public Agents. Everyone starts
-- hidden, new sign-ups included: the boss picks one by one.
--
-- profiles_update_own lets a user update their own row, so a trigger keeps
-- this one column admin-only: a change from a signed-in user who isn't admin
-- staff is quietly dropped (the rest of their update still saves), and a
-- self-inserted row always starts hidden. Service-role writes (the admin API)
-- and migrations are not affected.
--
-- Idempotent for the runner.

BEGIN;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS show_on_agents_page boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.show_on_agents_page IS
  'Shown on the public /agents page and the About page faces/count. Admin staff only (trg_profiles_guard_agents_page).';

CREATE OR REPLACE FUNCTION public.profiles_guard_agents_page()
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
    NEW.show_on_agents_page := false;
  ELSE
    NEW.show_on_agents_page := OLD.show_on_agents_page;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_guard_agents_page ON public.profiles;
CREATE TRIGGER trg_profiles_guard_agents_page
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.profiles_guard_agents_page();

COMMIT;
