-- 039_agent_feedback.sql
-- Customer feedback on advisors. Each agent shares a personal link/QR; the
-- customer fills the public form (mirrors the printed "Customer Feedback
-- Review" sheet) with no login. Writes go through the service-role client
-- only (public POST /api/feedback); agents read their own rows, admins all.
--
-- `status` exists for the later "publish reviews on the website" step:
-- everything arrives as 'new', and only rows an admin marks 'approved' will
-- ever be considered for public display.
--
-- Idempotent: the migration runner re-applies every file on each run.

BEGIN;

CREATE TABLE IF NOT EXISTS public.agent_feedback (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id              UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  -- Advisor name snapshot, so the review survives renames/offboarding.
  agent_name            TEXT,

  client_name           TEXT NOT NULL,
  property_ref          TEXT,
  transaction_type      TEXT CHECK (transaction_type IN ('sale', 'rent', 'purchase')),
  transaction_date      DATE,

  overall_rating        INT  NOT NULL CHECK (overall_rating BETWEEN 1 AND 5),
  -- The seven performance questions, each Poor(1) … Excellent(5).
  score_communication   INT NOT NULL CHECK (score_communication BETWEEN 1 AND 5),
  score_market          INT NOT NULL CHECK (score_market BETWEEN 1 AND 5),
  score_understanding   INT NOT NULL CHECK (score_understanding BETWEEN 1 AND 5),
  score_professionalism INT NOT NULL CHECK (score_professionalism BETWEEN 1 AND 5),
  score_negotiation     INT NOT NULL CHECK (score_negotiation BETWEEN 1 AND 5),
  score_process         INT NOT NULL CHECK (score_process BETWEEN 1 AND 5),
  score_experience      INT NOT NULL CHECK (score_experience BETWEEN 1 AND 5),

  recommend             TEXT NOT NULL CHECK (recommend IN
    ('definitely_not', 'unlikely', 'not_sure', 'likely', 'very_likely', 'definitely_yes')),

  did_well              TEXT,
  to_improve            TEXT,
  other_comments        TEXT,

  status                TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'approved', 'hidden')),
  ip_address            TEXT,
  user_agent            TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_feedback_agent
  ON public.agent_feedback (agent_id, created_at DESC);

COMMENT ON TABLE public.agent_feedback IS
  'Customer feedback per advisor, collected via the public /feedback/[agentId] form.';

ALTER TABLE public.agent_feedback ENABLE ROW LEVEL SECURITY;

-- Agents read their own; admin staff read all. All writes are service-role.
DROP POLICY IF EXISTS "agent_feedback_select_own" ON public.agent_feedback;
CREATE POLICY "agent_feedback_select_own"
  ON public.agent_feedback FOR SELECT TO authenticated
  USING (agent_id = auth.uid() OR public.is_admin_profile(auth.uid()));

COMMIT;
