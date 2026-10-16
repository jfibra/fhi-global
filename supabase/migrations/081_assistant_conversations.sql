-- Migration 081: FHI Assistant conversation history (boss via Juliecor, 2026-10-16).
--
-- The assistant chat gets a ChatGPT-style history: every person's past
-- conversations in a side list, saved to their account so they follow them
-- across devices. One row per conversation; `messages` holds the thread as
-- the page renders it (questions, answers, tiles, charts, cards, report data).
--
-- Private to the owner: the API (app/api/assistant/conversations) reads and
-- writes it with the service role after checking the session, and only ever
-- the signed-in user's own rows. Nobody reads it through RLS. The admin and
-- the agent assistants keep separate lists (`audience`).
--
-- Idempotent for the runner.

BEGIN;

CREATE TABLE IF NOT EXISTS public.assistant_conversations (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  audience    text        NOT NULL CHECK (audience IN ('admin', 'agent')),
  title       text        NOT NULL DEFAULT 'New chat',
  messages    jsonb       NOT NULL DEFAULT '[]'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_assistant_conversations_owner
  ON public.assistant_conversations (user_id, audience, updated_at DESC);

ALTER TABLE public.assistant_conversations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.assistant_conversations FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.assistant_conversations TO service_role;

COMMIT;
