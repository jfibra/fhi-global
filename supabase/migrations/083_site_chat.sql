-- Migration 083: the website chat (boss via Juliecor, 2026-11-06).
--
-- fhiglobal.ae gets a public FHI Assistant — a chat bubble on every public
-- page that answers from the site's own data (projects, listings, events,
-- guides) and asks for the visitor's number (app/api/site-chat, lib/site-chat.ts).
--
-- Every message a visitor sends is recorded here with what it cost, so the
-- brakes hold across Vercel instances (an in-memory counter resets on every
-- cold start): per-IP hourly and daily limits, a per-conversation limit, a
-- site-wide hourly limit, and daily + monthly spend caps (lib/site-chat-usage.ts).
-- A request refused by those brakes is recorded too (`blocked` names the
-- reason) so the admin page shows abuse — but refused rows never count
-- towards the limits, or a blocked visitor could never come back.
--
-- Service role only: the public route writes it and the admin page reads it.
--
-- Idempotent for the runner.

BEGIN;

CREATE TABLE IF NOT EXISTS public.site_chat_messages (
  id                bigserial PRIMARY KEY,
  -- The visitor's conversation (a random id the browser keeps for the tab).
  session_id        uuid        NOT NULL,
  -- A salted hash of the visitor's IP — enough to rate-limit, never the address itself.
  ip_hash           text        NOT NULL,
  -- Cloudflare's country code for the visitor, when present.
  country           text,
  -- The page they were on (path only).
  page              text,
  asked_at          timestamptz NOT NULL DEFAULT now(),
  question          text,
  -- The answer, trimmed — admins read conversations on the usage page.
  answer            text,
  tools             text[]      NOT NULL DEFAULT '{}',
  -- Projects the answer showed cards for; the lead form names the latest one.
  projects          text[]      NOT NULL DEFAULT '{}',
  model             text,
  prompt_tokens     integer     NOT NULL DEFAULT 0,
  completion_tokens integer     NOT NULL DEFAULT 0,
  cost_usd          numeric(10, 6) NOT NULL DEFAULT 0,
  ok                boolean     NOT NULL DEFAULT true,
  error             text,
  -- Set when the request never reached the model: ip_minute, ip_hour, ip_day, session, site_hour, day_cap, month_cap.
  blocked           text
);

CREATE INDEX IF NOT EXISTS idx_site_chat_messages_time    ON public.site_chat_messages (asked_at DESC);
CREATE INDEX IF NOT EXISTS idx_site_chat_messages_session ON public.site_chat_messages (session_id, asked_at);
CREATE INDEX IF NOT EXISTS idx_site_chat_messages_ip      ON public.site_chat_messages (ip_hash, asked_at DESC);

ALTER TABLE public.site_chat_messages ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.site_chat_messages FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.site_chat_messages TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.site_chat_messages_id_seq TO service_role;

-- Everything the brakes need in ONE round trip (the database is in Singapore,
-- the functions in Virginia — each query costs ~200 ms). Refused rows are left
-- out of every count; spend counts every row.
CREATE OR REPLACE FUNCTION public.site_chat_gate(p_ip_hash text, p_session uuid, p_day_start timestamptz, p_month_start timestamptz)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'ip_hour',    count(*) FILTER (WHERE blocked IS NULL AND ip_hash = p_ip_hash AND asked_at >= now() - interval '1 hour'),
    'ip_day',     count(*) FILTER (WHERE blocked IS NULL AND ip_hash = p_ip_hash AND asked_at >= p_day_start),
    'session',    count(*) FILTER (WHERE blocked IS NULL AND session_id = p_session),
    'site_hour',  count(*) FILTER (WHERE blocked IS NULL AND asked_at >= now() - interval '1 hour'),
    'day_cost',   COALESCE(sum(cost_usd) FILTER (WHERE asked_at >= p_day_start), 0),
    'month_cost', COALESCE(sum(cost_usd), 0)
  )
  FROM public.site_chat_messages
  WHERE asked_at >= p_month_start;
$$;

REVOKE ALL ON FUNCTION public.site_chat_gate(text, uuid, timestamptz, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.site_chat_gate(text, uuid, timestamptz, timestamptz) TO service_role;

-- A lead left in the chat is an ordinary inquiry (source 'chat') and lands in
-- Emails like every Inquire Now lead. Two extra columns: what the visitor asked
-- (built server-side from the recorded conversation, so the admin reads the
-- context) and which conversation it came from (so the usage page can tell
-- which chats turned into leads).
ALTER TABLE public.inquiries ADD COLUMN IF NOT EXISTS message TEXT;
ALTER TABLE public.inquiries ADD COLUMN IF NOT EXISTS chat_session_id UUID;
COMMENT ON COLUMN public.inquiries.message IS 'Website chat leads: the conversation excerpt the lead came from (built server-side).';
COMMENT ON COLUMN public.inquiries.chat_session_id IS 'Website chat leads: the site_chat_messages.session_id the lead was left in.';

COMMIT;
