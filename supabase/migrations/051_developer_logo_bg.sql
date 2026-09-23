-- Migration 051: developers.logo_bg
-- Many developer logos arrive with a baked-in solid background (Reportage on
-- black, Peace Homes on green). Painting the whole logo panel in that colour
-- reads as a deliberate brand tile instead of a coloured rectangle floating in
-- a white card. The colour is detected server-side from the image's edge
-- pixels (lib/logo-analysis.ts) at upload and stored here as a CSS hex; NULL
-- means transparent / no uniform background — the card keeps its default.
-- Applied with: npm run db:migrate (requires DATABASE_URL)

BEGIN;

ALTER TABLE public.developers ADD COLUMN IF NOT EXISTS logo_bg text;

COMMIT;
