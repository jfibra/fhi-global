-- Migration 056: credit shared sales by each agent's share.
--
-- A shared sale (migration 055) is ONE row, so company-wide totals already
-- count it once, in full — that stays exactly as it is. What changes is every
-- PER-AGENT number: instead of the whole contract price going to the agent who
-- recorded it, each agent on the deal is credited their agreed share.
--
--   AED 2,000,000 sale, Juliecor (Lead) 60% / Maria (Co-Agent) 40%
--     company total ........... AED 2,000,000   (unchanged — counted once)
--     Juliecor's totals ....... AED 1,200,000, 1 deal
--     Maria's totals .......... AED   800,000, 1 deal
--   Adding every agent's value still equals the company total.
--
-- The deal itself counts once for each agent on it. Group figures
-- (sales_monthly_series, used for a team's trend) count a deal shared by two
-- members of the same group once, and credit the group the sum of their shares.
--
-- A solo sale credits its agent 100%, so every existing number is unchanged
-- until someone records a shared sale.
--
-- Every function keeps its exact signature, defaults and result columns (the
-- app calls them unchanged), stays SECURITY INVOKER so RLS still decides which
-- rows a browser caller aggregates (an agent sees their own and partnered
-- sales since 055), and is re-granted to authenticated as in 016/017/018/021/023.
-- The runner re-applies those older files first on every run; this later file
-- then puts the share-aware versions back. Company-level and per-developer
-- totals (sales_totals_by_developers_period, sales_summary with no agent) are
-- deliberately not split.

BEGIN;

-- ── Who a sale counts for ───────────────────────────────────────────────────
-- One row per credited agent: the recording agent at 100% for a solo sale,
-- otherwise every agent in the partners snapshot at their share. The 055
-- trigger guarantees partners is an array whose shares total 100.
CREATE OR REPLACE FUNCTION public.sale_credits(_agent_id uuid, _partners jsonb)
RETURNS TABLE (agent_id uuid, share numeric)
LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT _agent_id, 100::numeric
  WHERE CASE WHEN jsonb_typeof(_partners) = 'array' THEN jsonb_array_length(_partners) = 0 ELSE true END
  UNION ALL
  SELECT (e->>'agent_id')::uuid, (e->>'share')::numeric
  FROM jsonb_array_elements(CASE WHEN jsonb_typeof(_partners) = 'array' THEN _partners ELSE '[]'::jsonb END) e
$$;
GRANT EXECUTE ON FUNCTION public.sale_credits(uuid, jsonb) TO authenticated;

-- ── Sales Reports tiles / tab badges (016) ──────────────────────────────────
-- No agent → the whole company, every sale once in full (unchanged). An agent
-- → their share of every sale they're on, owner or partner.
CREATE OR REPLACE FUNCTION public.sales_summary(p_sale_type text, p_agent_id uuid DEFAULT NULL)
RETURNS TABLE (deal_count bigint, total_value numeric, pending_count bigint)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT
    count(*)::bigint,
    coalesce(round(sum(s.contract_price * c.share / 100), 2), 0)::numeric,
    count(*) FILTER (WHERE s.validation_status = 'pending')::bigint
  FROM public.sales_reports s
  CROSS JOIN LATERAL (
    SELECT 100::numeric AS share WHERE p_agent_id IS NULL
    UNION ALL
    SELECT sc.share FROM public.sale_credits(s.agent_id, s.partners) sc
    WHERE p_agent_id IS NOT NULL AND sc.agent_id = p_agent_id
  ) c
  WHERE s.sale_type = p_sale_type
    AND (p_agent_id IS NULL OR s.agent_id = p_agent_id OR s.partner_agent_ids @> ARRAY[p_agent_id]);
$$;
GRANT EXECUTE ON FUNCTION public.sales_summary(text, uuid) TO authenticated;

-- ── Filtered tiles (023) ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.sales_summary_filtered(
  p_sale_type         text DEFAULT NULL,
  p_agent_id          uuid DEFAULT NULL,
  p_property_type     text DEFAULT NULL,
  p_developer_id      uuid DEFAULT NULL,
  p_commission_status text DEFAULT NULL,
  p_validation_status text DEFAULT NULL,
  p_from              date DEFAULT NULL,
  p_to                date DEFAULT NULL,
  p_search            text DEFAULT NULL
)
RETURNS TABLE (deal_count bigint, total_value numeric, pending_count bigint)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT
    count(*)::bigint,
    coalesce(round(sum(s.contract_price * c.share / 100), 2), 0)::numeric,
    count(*) FILTER (WHERE s.validation_status = 'pending')::bigint
  FROM public.sales_reports s
  CROSS JOIN LATERAL (
    SELECT 100::numeric AS share WHERE p_agent_id IS NULL
    UNION ALL
    SELECT sc.share FROM public.sale_credits(s.agent_id, s.partners) sc
    WHERE p_agent_id IS NOT NULL AND sc.agent_id = p_agent_id
  ) c
  LEFT JOIN public.clients    cl ON cl.id = s.client_id
  LEFT JOIN public.projects   pr ON pr.id = s.project_id
  LEFT JOIN public.developers d  ON d.id  = s.developer_id
  WHERE (p_sale_type       IS NULL OR s.sale_type         = p_sale_type)
    AND (p_agent_id          IS NULL OR s.agent_id = p_agent_id OR s.partner_agent_ids @> ARRAY[p_agent_id])
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
        OR cl.first_name      ILIKE '%' || p_search || '%'
        OR cl.middle_name     ILIKE '%' || p_search || '%'
        OR cl.last_name       ILIKE '%' || p_search || '%'
        OR pr.name            ILIKE '%' || p_search || '%'
        OR d.name             ILIKE '%' || p_search || '%'
      )
    );
$$;
GRANT EXECUTE ON FUNCTION public.sales_summary_filtered(text, uuid, text, uuid, text, text, date, date, text) TO authenticated;

-- ── Per-user lifetime totals + commission breakdown (017) ───────────────────
CREATE OR REPLACE FUNCTION public.sales_totals_by_agents(p_agent_ids uuid[])
RETURNS TABLE (agent_id uuid, deal_count bigint, total_value numeric)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT
    c.agent_id,
    count(*)::bigint,
    coalesce(round(sum(s.contract_price * c.share / 100), 2), 0)::numeric
  FROM public.sales_reports s
  CROSS JOIN LATERAL public.sale_credits(s.agent_id, s.partners) c
  WHERE c.agent_id = ANY (p_agent_ids)
    AND (s.agent_id = ANY (p_agent_ids) OR s.partner_agent_ids && p_agent_ids)
  GROUP BY c.agent_id;
$$;
GRANT EXECUTE ON FUNCTION public.sales_totals_by_agents(uuid[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.sales_status_breakdown(p_agent_id uuid)
RETURNS TABLE (commission_status text, deal_count bigint, total_value numeric)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT
    s.commission_status,
    count(*)::bigint,
    coalesce(round(sum(s.contract_price * c.share / 100), 2), 0)::numeric
  FROM public.sales_reports s
  CROSS JOIN LATERAL public.sale_credits(s.agent_id, s.partners) c
  WHERE c.agent_id = p_agent_id
    AND (s.agent_id = p_agent_id OR s.partner_agent_ids @> ARRAY[p_agent_id])
  GROUP BY s.commission_status;
$$;
GRANT EXECUTE ON FUNCTION public.sales_status_breakdown(uuid) TO authenticated;

-- ── Team Sales: per-member totals + group trend (018) ───────────────────────
CREATE OR REPLACE FUNCTION public.sales_totals_by_agents_period(
  p_agent_ids uuid[],
  p_from date DEFAULT NULL,
  p_to   date DEFAULT NULL
)
RETURNS TABLE (agent_id uuid, deal_count bigint, total_value numeric)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT
    c.agent_id,
    count(*)::bigint,
    coalesce(round(sum(s.contract_price * c.share / 100), 2), 0)::numeric
  FROM public.sales_reports s
  CROSS JOIN LATERAL public.sale_credits(s.agent_id, s.partners) c
  WHERE c.agent_id = ANY (p_agent_ids)
    AND (s.agent_id = ANY (p_agent_ids) OR s.partner_agent_ids && p_agent_ids)
    AND (p_from IS NULL OR coalesce(s.reservation_date, s.created_at::date) >= p_from)
    AND (p_to   IS NULL OR coalesce(s.reservation_date, s.created_at::date) <  p_to)
  GROUP BY c.agent_id;
$$;
GRANT EXECUTE ON FUNCTION public.sales_totals_by_agents_period(uuid[], date, date) TO authenticated;

-- A group's trend: a deal shared by two agents in p_agent_ids counts once, and
-- the group is credited the sum of their shares.
CREATE OR REPLACE FUNCTION public.sales_monthly_series(p_agent_ids uuid[], p_from date, p_to date)
RETURNS TABLE (month_start date, deal_count bigint, total_value numeric)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT
    date_trunc('month', coalesce(s.reservation_date, s.created_at::date))::date,
    count(DISTINCT s.id)::bigint,
    coalesce(round(sum(s.contract_price * c.share / 100), 2), 0)::numeric
  FROM public.sales_reports s
  CROSS JOIN LATERAL public.sale_credits(s.agent_id, s.partners) c
  WHERE c.agent_id = ANY (p_agent_ids)
    AND (s.agent_id = ANY (p_agent_ids) OR s.partner_agent_ids && p_agent_ids)
    AND coalesce(s.reservation_date, s.created_at::date) >= p_from
    AND coalesce(s.reservation_date, s.created_at::date) <  p_to
  GROUP BY 1
  ORDER BY 1;
$$;
GRANT EXECUTE ON FUNCTION public.sales_monthly_series(uuid[], date, date) TO authenticated;

-- ── Top Sales leaderboard, validated only (021) ─────────────────────────────
CREATE OR REPLACE FUNCTION public.sales_totals_by_agents_period_status(
  p_agent_ids uuid[],
  p_from      date   DEFAULT NULL,
  p_to        date   DEFAULT NULL,
  p_statuses  text[] DEFAULT NULL
)
RETURNS TABLE (agent_id uuid, deal_count bigint, total_value numeric)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT
    c.agent_id,
    count(*)::bigint,
    coalesce(round(sum(s.contract_price * c.share / 100), 2), 0)::numeric
  FROM public.sales_reports s
  CROSS JOIN LATERAL public.sale_credits(s.agent_id, s.partners) c
  WHERE c.agent_id = ANY (p_agent_ids)
    AND (s.agent_id = ANY (p_agent_ids) OR s.partner_agent_ids && p_agent_ids)
    AND (p_from IS NULL OR coalesce(s.reservation_date, s.created_at::date) >= p_from)
    AND (p_to   IS NULL OR coalesce(s.reservation_date, s.created_at::date) <  p_to)
    AND (p_statuses IS NULL OR s.validation_status = ANY (p_statuses))
  GROUP BY c.agent_id;
$$;
GRANT EXECUTE ON FUNCTION public.sales_totals_by_agents_period_status(uuid[], date, date, text[]) TO authenticated;

COMMIT;
