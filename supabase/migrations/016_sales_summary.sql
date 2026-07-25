-- Migration 016: sales_summary() aggregate for the Sales Reports summary tiles.
-- Returns deal count, total contract value, and pending-validation count for one
-- sale type, optionally narrowed to a single agent.
--
-- SECURITY INVOKER (the default) so the function inherits the exact same RLS that
-- fetchSales relies on: agents/team-leaders aggregate only the rows RLS lets them
-- see, admins/secretaries see all. p_agent_id is the admin "filter by agent"
-- narrowing (NULL = no agent filter). Aggregating server-side avoids PostgREST's
-- ~1000-row select cap that would silently undercount a client-side SUM.
BEGIN;

CREATE OR REPLACE FUNCTION public.sales_summary(p_sale_type text, p_agent_id uuid DEFAULT NULL)
RETURNS TABLE (deal_count bigint, total_value numeric, pending_count bigint)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    count(*)::bigint,
    coalesce(sum(contract_price), 0)::numeric,
    count(*) FILTER (WHERE validation_status = 'pending')::bigint
  FROM public.sales_reports
  WHERE sale_type = p_sale_type
    AND (p_agent_id IS NULL OR agent_id = p_agent_id);
$$;

GRANT EXECUTE ON FUNCTION public.sales_summary(text, uuid) TO authenticated;

COMMIT;
