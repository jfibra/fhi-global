-- Migration 086: profiles.suffix — the name suffix (Jr., Sr., II, III …).
--
-- The profile page first kept it in profiles.metadata->>'suffix'; it now has
-- its own column next to fname / mname / lname. fullname still ends with it
-- ("Juan Dela Cruz Jr."), built by the profile page and the admin user route.
--
-- The runner re-applies every file, so the one-time copy out of metadata runs
-- only in the same pass that first adds the column (an admin clearing a
-- suffix later must not get it re-filled from old metadata).

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'suffix'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN suffix TEXT;

    UPDATE public.profiles
       SET suffix = NULLIF(btrim(metadata->>'suffix'), '')
     WHERE metadata ? 'suffix';

    UPDATE public.profiles
       SET metadata = metadata - 'suffix'
     WHERE metadata ? 'suffix';
  END IF;
END
$$;

COMMIT;
