-- Migration 021: status-aware totals, for the company Top Sales leaderboard.
--
-- sales_totals_by_agents_period (018) filters on agent and date only. That was
-- fine while it fed the admin-only poster studio, but the leaderboard now shows
-- on every internal overview — and an agent can insert their own sale at any
-- price with validation_status 'pending' (no approval needed). Without a status
-- filter, one invented row puts that agent at rank 1 on everyone's dashboard,
-- and an admin marking it 'invalid_sale' would not remove it.
--
-- This is a NEW function rather than a change to 018: the Team Sales page and
-- the monthly trend still call that one, and altering its signature would
-- break them.
--
-- p_statuses NULL means "every status", so the function is also usable as a
-- drop-in for the unfiltered behaviour.
--
-- Same conventions as 018: business date is coalesce(reservation_date,
-- created_at::date), bounds are half-open [from, to), NULL means unbounded,
-- SECURITY INVOKER so RLS still applies to anyone who isn't the service role.

BEGIN;

CREATE OR REPLACE FUNCTION public.sales_totals_by_agents_period_status(
  p_agent_ids uuid[],
  p_from     date DEFAULT NULL,
  p_to       date DEFAULT NULL,
  p_statuses text[] DEFAULT NULL
)
RETURNS TABLE (agent_id uuid, deal_count bigint, total_value numeric)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    s.agent_id,
    count(*)::bigint,
    coalesce(sum(s.contract_price), 0)::numeric
  FROM public.sales_reports s
  WHERE s.agent_id = ANY (p_agent_ids)
    AND (p_from IS NULL OR coalesce(s.reservation_date, s.created_at::date) >= p_from)
    AND (p_to   IS NULL OR coalesce(s.reservation_date, s.created_at::date) <  p_to)
    AND (p_statuses IS NULL OR s.validation_status = ANY (p_statuses))
  GROUP BY s.agent_id;
$$;

GRANT EXECUTE ON FUNCTION public.sales_totals_by_agents_period_status(uuid[], date, date, text[]) TO authenticated;

COMMIT;
