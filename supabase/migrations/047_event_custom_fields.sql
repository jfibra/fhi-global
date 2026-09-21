-- Migration 047: per-event custom registration fields + "who invited you"
--
-- Every event asks different things (company, nationality, budget, how many
-- seats), so the three built-in columns (full_name, email, whatsapp) are no
-- longer enough. Each event now carries its own field list, editable at any
-- time, and answers land in a jsonb bag on the registration.
--
-- Editing a live event's fields is deliberately non-destructive: adding a
-- field leaves earlier registrations without that key, and removing one only
-- stops the form asking for it — answers already collected stay in `answers`
-- so old exports remain complete.
--
-- Applied with: npm run db:migrate (requires DATABASE_URL)

BEGIN;

-- Field definitions, in display order. Each entry:
--   { "key": "company", "label": "Company", "type": "text",
--     "required": false, "placeholder": "", "options": ["A","B"] }
-- type ∈ text | textarea | email | tel | number | date | select | checkbox
-- `options` only applies to select.
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS registration_fields jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Answers to those fields, keyed by the field's `key`.
ALTER TABLE public.event_registrations
  ADD COLUMN IF NOT EXISTS answers jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Free-text "Who invited you?" — an optional box on every event's form. Plain
-- text on purpose: attendees type whatever name they were given, which may be
-- an agent, a friend or a company, and need not match a portal account.
ALTER TABLE public.event_registrations
  ADD COLUMN IF NOT EXISTS invited_by text;

COMMIT;
