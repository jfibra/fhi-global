-- AI Photo Studio history: one row per generation, so the studio can show a
-- results gallery, chain edits, delete files, and (later) count per-user
-- daily usage for the agents' cap. Service-role access only: RLS is enabled
-- with no policies, so browser clients can't touch it — the API routes are
-- the gate.
BEGIN;

CREATE TABLE IF NOT EXISTS public.ai_photo_edits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  result_url text NOT NULL,
  source_url text,
  prompt text NOT NULL,
  quality text NOT NULL DEFAULT 'medium',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_photo_edits_user_idx
  ON public.ai_photo_edits (user_id, created_at DESC);

ALTER TABLE public.ai_photo_edits ENABLE ROW LEVEL SECURITY;

COMMIT;
