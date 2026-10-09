-- Migration 079: FHI Assistant usage log (boss via Juliecor, 2026-10-09).
--
-- Agents and team leaders get their own FHI Assistant (app/api/fhi-chat).
-- Every answered question is recorded here with its token usage, so the
-- server can enforce the per-person daily limit (count of today's rows) and
-- the company monthly spend cap (sum of cost_usd this month) across Vercel
-- instances — an in-memory counter would reset on every cold start.
--
-- Service role only: the API writes it and the admin usage page (phase 3)
-- reads it. Nobody reads it through RLS.
--
-- Idempotent for the runner.

BEGIN;

CREATE TABLE IF NOT EXISTS public.assistant_usage (
  id                bigserial PRIMARY KEY,
  -- 'agent' = the agent/TL assistant; 'admin' reserved for the admin one.
  audience          text        NOT NULL DEFAULT 'agent',
  user_id           uuid        NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  role              text,
  asked_at          timestamptz NOT NULL DEFAULT now(),
  -- The question, trimmed; never the full conversation.
  question          text,
  tools             text[]      NOT NULL DEFAULT '{}',
  model             text,
  prompt_tokens     integer     NOT NULL DEFAULT 0,
  completion_tokens integer     NOT NULL DEFAULT 0,
  cost_usd          numeric(10, 6) NOT NULL DEFAULT 0,
  ok                boolean     NOT NULL DEFAULT true,
  error             text
);

CREATE INDEX IF NOT EXISTS idx_assistant_usage_user_day ON public.assistant_usage (user_id, asked_at DESC);
CREATE INDEX IF NOT EXISTS idx_assistant_usage_audience_time ON public.assistant_usage (audience, asked_at DESC);

ALTER TABLE public.assistant_usage ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.assistant_usage FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.assistant_usage TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.assistant_usage_id_seq TO service_role;

-- Month-to-date spend of one audience — one aggregate instead of paging rows.
CREATE OR REPLACE FUNCTION public.assistant_usage_spend(p_audience text, p_from timestamptz)
RETURNS numeric
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(SUM(cost_usd), 0)
  FROM public.assistant_usage
  WHERE audience = p_audience AND asked_at >= p_from;
$$;

REVOKE ALL ON FUNCTION public.assistant_usage_spend(text, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.assistant_usage_spend(text, timestamptz) TO service_role;

COMMIT;
