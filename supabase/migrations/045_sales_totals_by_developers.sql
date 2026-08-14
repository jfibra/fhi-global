-- Top Developers leaderboard: totals of sales grouped by developer, same
-- period/status semantics as sales_totals_by_agents_period_status (021) —
-- business date is coalesce(reservation_date, created_at::date), bounds are
-- half-open, and the caller filters to validated only.
BEGIN;

CREATE OR REPLACE FUNCTION public.sales_totals_by_developers_period(
  p_from     date DEFAULT NULL,
  p_to       date DEFAULT NULL,
  p_statuses text[] DEFAULT NULL
)
RETURNS TABLE (developer_id uuid, deal_count bigint, total_value numeric)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    s.developer_id,
    count(*)::bigint,
    coalesce(sum(s.contract_price), 0)::numeric
  FROM public.sales_reports s
  WHERE s.developer_id IS NOT NULL
    AND (p_from IS NULL OR coalesce(s.reservation_date, s.created_at::date) >= p_from)
    AND (p_to   IS NULL OR coalesce(s.reservation_date, s.created_at::date) <  p_to)
    AND (p_statuses IS NULL OR s.validation_status = ANY (p_statuses))
  GROUP BY s.developer_id;
$$;

GRANT EXECUTE ON FUNCTION public.sales_totals_by_developers_period(date, date, text[]) TO authenticated;

COMMIT;
