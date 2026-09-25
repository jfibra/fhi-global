-- Migration 059: an optional video LINK on events.
--
-- Organizers attach a video by pasting its YouTube / Facebook / Instagram /
-- TikTok / Vimeo / Google Drive link — videos are never uploaded (heavy to
-- store and serve, slow to start). The event page shows a "Watch video"
-- button and loads the platform's player only when it's clicked
-- (lib/video-embed.ts, components/public/video-modal.tsx). Links no page can
-- play are dropped on save (lib/events/validate.ts).
--
-- Additive: NULL for every existing event. Idempotent for the runner.

BEGIN;

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS video_url text;

COMMIT;
