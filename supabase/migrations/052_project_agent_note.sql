-- Migration 052: "Why we picked it" note on projects
--
-- The homepage's featured-projects showcase prints a short, hand-written line
-- from the FHI team under the hero pick ("Faces the water, not Sheikh Zayed
-- Road, so it's quiet at night"). It is deliberately a separate column from
-- `description` (marketing copy, often developer-supplied) so the card only
-- ever shows something a person at FHI actually wrote; the card hides the
-- note box when the column is null.
--
-- Applied with: npm run db:migrate (requires DATABASE_URL)

BEGIN;

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS agent_note text;

COMMENT ON COLUMN public.projects.agent_note IS
  'One or two sentences from the FHI team on why this project is worth a look. Shown on the homepage featured showcase when the project is featured.';

COMMIT;
