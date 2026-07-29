-- Migration 017: per-agent sales aggregates for the Account 360 view.
--
-- The Account Directory drill-in shows each teammate's / recruit's production
-- plus group totals. Doing that client-side means either a `.in()` filter with
-- hundreds of UUIDs (a multi-KB GET URL the gateway rejects) or a SUM over rows
-- PostgREST silently caps at ~1000 — the same trap sales_summary() (016) was
-- written to avoid. Aggregating in SQL fixes both: one POST, exact numbers.
--
-- SECURITY INVOKER (the default) so RLS still applies exactly as it does to a
-- direct select; the admin routes call these through the service-role client,
-- which bypasses RLS as intended for back-office reporting.
BEGIN;

-- Deal count + contract value for each of the given agents. Returns one row per
-- agent that has at least one sale; callers treat a missing agent as zero.
CREATE OR REPLACE FUNCTION public.sales_totals_by_agents(p_agent_ids uuid[])
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
  GROUP BY s.agent_id;
$$;

-- One agent's production split by commission status — powers the Sales tab
-- tiles (total deals, contract value, released, pending) without a row cap.
CREATE OR REPLACE FUNCTION public.sales_status_breakdown(p_agent_id uuid)
RETURNS TABLE (commission_status text, deal_count bigint, total_value numeric)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    s.commission_status,
    count(*)::bigint,
    coalesce(sum(s.contract_price), 0)::numeric
  FROM public.sales_reports s
  WHERE s.agent_id = p_agent_id
  GROUP BY s.commission_status;
$$;

GRANT EXECUTE ON FUNCTION public.sales_totals_by_agents(uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sales_status_breakdown(uuid) TO authenticated;

COMMIT;
