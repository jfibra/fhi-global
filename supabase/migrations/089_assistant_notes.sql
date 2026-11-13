-- Migration 089: assistant_notes — an agent's client notes and reminders
-- (boss via Juliecor, 2026-11-13).
--
-- In their FHI Assistant an agent or team leader says "note: Maria wants a
-- 2-bed in JVC under 1.2M" and later asks "what did Maria want?"; or "remind
-- me to call Maria on Friday" — the reminder shows as a tile on the
-- assistant's welcome screen that day and the daily cron
-- (app/api/cron/assistant-notes) emails it that morning. One table, two
-- kinds: a note has no due date; a reminder has one and is done or not.
-- Every row belongs to the person who wrote it and is never shown to anyone
-- else — not even an admin reads it through the dashboard.
--
-- Service role only (like assistant_usage): the chat tools and the cron
-- write and read it; nobody reads it through RLS.
--
-- Idempotent for the runner.

BEGIN;

CREATE TABLE IF NOT EXISTS public.assistant_notes (
  id          bigserial PRIMARY KEY,
  user_id     uuid        NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  kind        text        NOT NULL CHECK (kind IN ('note', 'reminder')),
  -- Who the note or reminder is about, as the person said it (optional).
  client_name text,
  body        text        NOT NULL,
  -- Reminders: the Dubai day it is due; notes: NULL.
  due_on      date,
  done_at     timestamptz,
  -- Reminders: when the morning email went out, so it is sent once.
  sent_at     timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_assistant_notes_user ON public.assistant_notes (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_assistant_notes_due ON public.assistant_notes (due_on) WHERE kind = 'reminder' AND done_at IS NULL;

ALTER TABLE public.assistant_notes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.assistant_notes FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.assistant_notes TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.assistant_notes_id_seq TO service_role;

COMMIT;
