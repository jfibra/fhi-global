-- Migration 023: totals that respect the Sales Report filters.
--
-- sales_summary (016) totals a whole sale type, so the "Total Contract Value"
-- and "Pending Validation" tiles ignored every filter below them — narrow the
-- table to one property type or one month and the tiles still showed the
-- company-wide figure. This mirrors fetchSales' WHERE clause so the tiles and
-- the rows always describe the same set.
--
-- The sums must come from SQL: PostgREST aggregates are disabled on this
-- project (select("sum(...)") 400s), and summing a page of rows client-side
-- would only ever total the 10 rows on screen.
--
-- p_search reproduces fetchSales' free-text search, including the joins to
-- clients / projects / developers, so a search narrows the tiles too. Every
-- parameter is optional: NULL means "don't filter on this".
--
-- Date bounds are inclusive (>= / <=) on reservation_date, matching the
-- .gte()/.lte() the table query uses — deliberately NOT the half-open
-- coalesce() logic of the leaderboard RPCs, which answer a different question.
--
-- p_sale_type is optional too: the per-agent drill-in shows every sale type at
-- once, so NULL means "all three" rather than defaulting to one of them.
--
-- SECURITY INVOKER: RLS still applies, so after migration 020 an agent's
-- totals cover only their own sales.

BEGIN;

CREATE OR REPLACE FUNCTION public.sales_summary_filtered(
  p_sale_type          text DEFAULT NULL,
  p_agent_id           uuid DEFAULT NULL,
  p_property_type      text DEFAULT NULL,
  p_developer_id       uuid DEFAULT NULL,
  p_commission_status  text DEFAULT NULL,
  p_validation_status  text DEFAULT NULL,
  p_from               date DEFAULT NULL,
  p_to                 date DEFAULT NULL,
  p_search             text DEFAULT NULL
)
RETURNS TABLE (deal_count bigint, total_value numeric, pending_count bigint)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    count(*)::bigint,
    coalesce(sum(s.contract_price), 0)::numeric,
    count(*) FILTER (WHERE s.validation_status = 'pending')::bigint
  FROM public.sales_reports s
  LEFT JOIN public.clients    c  ON c.id  = s.client_id
  LEFT JOIN public.projects   pr ON pr.id = s.project_id
  LEFT JOIN public.developers d  ON d.id  = s.developer_id
  WHERE (p_sale_type       IS NULL OR s.sale_type         = p_sale_type)
    AND (p_agent_id          IS NULL OR s.agent_id          = p_agent_id)
    AND (p_property_type     IS NULL OR s.property_type     = p_property_type)
    AND (p_developer_id      IS NULL OR s.developer_id      = p_developer_id)
    AND (p_commission_status IS NULL OR s.commission_status = p_commission_status)
    AND (p_validation_status IS NULL OR s.validation_status = p_validation_status)
    AND (p_from IS NULL OR s.reservation_date >= p_from)
    AND (p_to   IS NULL OR s.reservation_date <= p_to)
    AND (
      p_search IS NULL OR btrim(p_search) = '' OR (
           s.unit_number      ILIKE '%' || p_search || '%'
        OR s.property_type    ILIKE '%' || p_search || '%'
        OR s.property_address ILIKE '%' || p_search || '%'
        OR s.block_number     ILIKE '%' || p_search || '%'
        OR s.lot_number       ILIKE '%' || p_search || '%'
        OR s.remarks          ILIKE '%' || p_search || '%'
        OR c.first_name       ILIKE '%' || p_search || '%'
        OR c.middle_name      ILIKE '%' || p_search || '%'
        OR c.last_name        ILIKE '%' || p_search || '%'
        OR pr.name            ILIKE '%' || p_search || '%'
        OR d.name             ILIKE '%' || p_search || '%'
      )
    );
$$;

GRANT EXECUTE ON FUNCTION public.sales_summary_filtered(text, uuid, text, uuid, text, text, date, date, text) TO authenticated;

COMMIT;
