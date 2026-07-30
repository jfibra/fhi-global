-- Migration 018: period-bounded sales aggregates for the Team Sales dashboard.
--
-- Team leaders / unit managers get a page showing their team's production for
-- a chosen year or month, a member leaderboard, and a monthly trend. Like 016
-- and 017, the sums live in SQL so they stay exact past PostgREST's row cap
-- and so the id list travels in a POST body instead of a multi-KB GET URL.
--
-- A sale's business date is reservation_date; created_at is the fallback for
-- rows encoded without one. Bounds are half-open ([from, to)) and NULL means
-- unbounded on that side.
--
-- SECURITY INVOKER (the default): under RLS these aggregate only visible rows;
-- the team API calls them through the service-role client after scoping the
-- id list to the caller's own team.
BEGIN;

-- Per-agent deal count + contract value within a period. One row per agent
-- with at least one sale; callers treat a missing agent as zero.
CREATE OR REPLACE FUNCTION public.sales_totals_by_agents_period(
  p_agent_ids uuid[],
  p_from date DEFAULT NULL,
  p_to   date DEFAULT NULL
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
  GROUP BY s.agent_id;
$$;

-- Month-bucketed totals for a set of agents — one row per month that has at
-- least one sale. month_start is the first day of that month.
CREATE OR REPLACE FUNCTION public.sales_monthly_series(
  p_agent_ids uuid[],
  p_from date,
  p_to   date
)
RETURNS TABLE (month_start date, deal_count bigint, total_value numeric)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    date_trunc('month', coalesce(s.reservation_date, s.created_at::date))::date,
    count(*)::bigint,
    coalesce(sum(s.contract_price), 0)::numeric
  FROM public.sales_reports s
  WHERE s.agent_id = ANY (p_agent_ids)
    AND coalesce(s.reservation_date, s.created_at::date) >= p_from
    AND coalesce(s.reservation_date, s.created_at::date) <  p_to
  GROUP BY 1
  ORDER BY 1;
$$;

GRANT EXECUTE ON FUNCTION public.sales_totals_by_agents_period(uuid[], date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sales_monthly_series(uuid[], date, date) TO authenticated;

COMMIT;
