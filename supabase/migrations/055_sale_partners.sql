-- Migration 055: partnership (shared) sales.
--
-- WHAT THIS ADDS
-- Record Your Sale now asks "Do you have a partner with this sale?". On yes,
-- the agent names up to two FHI partner agents, each agent's role (one Lead
-- Agent — the client source — plus Co-Agents) and share (totalling 100%), and
-- uploads the signed A2A agreement as proof of the partnership.
--
--   sales_reports.partners           jsonb, [] for a solo sale. EVERY agent on
--                                    the deal, including the one recording it:
--                                    { agent_id, name, role: lead|co_agent,
--                                      share, brn }
--   sales_reports.partner_agent_ids  uuid[], the OTHER agents (never agent_id).
--                                    Derived by the trigger below — nobody
--                                    writes it; it exists for RLS and for the
--                                    "my sales" filter.
--   sales_attachments.category       NULL/'proof' = proof of transaction (every
--                                    existing row), 'partnership_agreement' =
--                                    the signed A2A.
--
-- The partners snapshot is written in the SAME insert as the sale, so a sale
-- can never be saved half-way (flagged shared but with nobody named). The
-- trigger re-validates it server-side — shares, exactly one lead, the
-- recording agent included, partners are active sales agents — and replaces
-- each name with the profile's own, so the snapshot can't be spoofed.
--
-- WHO SEES WHAT
-- Partners READ the sale, its client and its files. They never edit it: the
-- update/insert policies are untouched (still owner/admin only). How the sale
-- is credited in per-agent totals (each agent's share) is migration 056.
--
-- ALSO: can_encode_sales() gains global_partner. That role (050) has the full
-- agent dashboard, Record Your Sale included, but this helper was never
-- updated, so sales_reports_insert_own rejected every partner's sale. 020 is
-- re-applied before this file on every run, so the definition here wins.
--
-- Additive only: no existing row is changed beyond getting the empty defaults.
-- Idempotent (IF NOT EXISTS / DROP … IF EXISTS / CREATE OR REPLACE) because the
-- runner re-applies every migration on each run.

BEGIN;

-- ── Columns ─────────────────────────────────────────────────────────────────
ALTER TABLE public.sales_reports
  ADD COLUMN IF NOT EXISTS partners jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS partner_agent_ids uuid[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_sales_reports_partner_agent_ids
  ON public.sales_reports USING gin (partner_agent_ids);

ALTER TABLE public.sales_attachments
  ADD COLUMN IF NOT EXISTS category text;
ALTER TABLE public.sales_attachments
  DROP CONSTRAINT IF EXISTS sales_attachments_category_check;
ALTER TABLE public.sales_attachments
  ADD CONSTRAINT sales_attachments_category_check
  CHECK (category IS NULL OR category IN ('proof', 'partnership_agreement'));

-- ── Partners guard ──────────────────────────────────────────────────────────
-- Runs as the caller: profiles is readable by every signed-in user (020), which
-- is all the partner lookup needs.
CREATE OR REPLACE FUNCTION public.sales_reports_partners_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  el        jsonb;
  out_arr   jsonb   := '[]'::jsonb;
  ids       uuid[]  := '{}';
  aid       uuid;
  r         text;
  s         numeric;
  total     numeric := 0;
  leads     int     := 0;
  has_owner boolean := false;
  pname     text;
BEGIN
  IF NEW.partners IS NULL THEN
    NEW.partners := '[]'::jsonb;
  END IF;

  -- Validate only a new or changed snapshot: an admin editing some other
  -- column must not be blocked because a partner has since left the company.
  IF TG_OP = 'INSERT' OR NEW.partners IS DISTINCT FROM OLD.partners THEN
    IF jsonb_typeof(NEW.partners) <> 'array' THEN
      RAISE EXCEPTION 'partners must be a JSON array';
    END IF;

    IF jsonb_array_length(NEW.partners) > 0 THEN
      IF jsonb_array_length(NEW.partners) NOT BETWEEN 2 AND 3 THEN
        RAISE EXCEPTION 'A shared sale has 2 or 3 agents (you plus up to 2 partners)';
      END IF;

      FOR el IN SELECT value FROM jsonb_array_elements(NEW.partners) LOOP
        pname := NULL;
        BEGIN
          aid := (el->>'agent_id')::uuid;
        EXCEPTION WHEN others THEN
          RAISE EXCEPTION 'Invalid partner agent id';
        END;
        IF aid IS NULL THEN
          RAISE EXCEPTION 'Invalid partner agent id';
        END IF;
        IF aid = ANY (ids) THEN
          RAISE EXCEPTION 'The same agent is listed twice on this sale';
        END IF;

        r := el->>'role';
        IF r IS NULL OR r NOT IN ('lead', 'co_agent') THEN
          RAISE EXCEPTION 'Each agent must be the Lead Agent or a Co-Agent';
        END IF;
        IF r = 'lead' THEN
          leads := leads + 1;
        END IF;

        BEGIN
          s := (el->>'share')::numeric;
        EXCEPTION WHEN others THEN
          RAISE EXCEPTION 'Invalid share';
        END;
        IF s IS NULL OR s <= 0 OR s > 100 THEN
          RAISE EXCEPTION 'Each share must be above 0%% and at most 100%%';
        END IF;
        total := total + s;

        IF aid = NEW.agent_id THEN
          has_owner := true;
          SELECT fullname INTO pname FROM public.profiles WHERE id = aid;
        ELSE
          SELECT fullname INTO pname
          FROM public.profiles
          WHERE id = aid
            AND LOWER(TRIM(role)) IN ('agent', 'team_leader', 'unit_manager', 'global_partner')
            AND status = 'active'
            AND is_deleted IS NOT TRUE;
          IF NOT FOUND THEN
            RAISE EXCEPTION 'A selected partner is not an active FHI agent';
          END IF;
        END IF;

        ids := ids || aid;
        out_arr := out_arr || jsonb_build_array(jsonb_build_object(
          'agent_id', aid,
          'name',     COALESCE(NULLIF(TRIM(pname), ''), NULLIF(TRIM(el->>'name'), ''), 'Agent'),
          'role',     r,
          'share',    round(s, 2),
          'brn',      NULLIF(LEFT(TRIM(COALESCE(el->>'brn', '')), 40), '')
        ));
      END LOOP;

      IF NOT has_owner THEN
        RAISE EXCEPTION 'The recording agent must be one of the agents on a shared sale';
      END IF;
      IF leads <> 1 THEN
        RAISE EXCEPTION 'A shared sale needs exactly one Lead Agent';
      END IF;
      IF abs(total - 100) > 0.01 THEN
        RAISE EXCEPTION 'Shares must total exactly 100%% (they total %)', round(total, 2)::text || '%';
      END IF;

      NEW.partners := out_arr;
    END IF;
  END IF;

  -- Derived on every write so it can never drift from the snapshot or agent_id.
  NEW.partner_agent_ids := COALESCE(ARRAY(
    SELECT (e->>'agent_id')::uuid
    FROM jsonb_array_elements(NEW.partners) e
    WHERE (e->>'agent_id')::uuid IS DISTINCT FROM NEW.agent_id
  ), '{}');

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sales_reports_partners_guard ON public.sales_reports;
CREATE TRIGGER trg_sales_reports_partners_guard
  BEFORE INSERT OR UPDATE ON public.sales_reports
  FOR EACH ROW EXECUTE FUNCTION public.sales_reports_partners_guard();

-- ── Read access for partners ────────────────────────────────────────────────
-- SELECT only. can_view_sale() is deliberately NOT widened: it also gates
-- INSERT/UPDATE/DELETE on sales_attachments, and partners must never be able
-- to remove the owner's files.
DROP POLICY IF EXISTS sales_reports_select_partner ON public.sales_reports;
CREATE POLICY sales_reports_select_partner ON public.sales_reports
  FOR SELECT TO authenticated
  USING (auth.uid() = ANY (partner_agent_ids));

DROP POLICY IF EXISTS clients_select_via_partner_sale ON public.clients;
CREATE POLICY clients_select_via_partner_sale ON public.clients
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.sales_reports s
    WHERE s.client_id = clients.id
      AND auth.uid() = ANY (s.partner_agent_ids)
  ));

DROP POLICY IF EXISTS sales_attachments_select_partner ON public.sales_attachments;
CREATE POLICY sales_attachments_select_partner ON public.sales_attachments
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.sales_reports s
    WHERE s.id = sales_attachments.sales_report_id
      AND auth.uid() = ANY (s.partner_agent_ids)
  ));

-- ── Global partners may record sales ────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.can_encode_sales(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = _uid
      AND LOWER(TRIM(role)) IN (
        'super_admin', 'admin', 'secretary', 'team_secretary',
        'agent', 'team_leader', 'unit_manager', 'global_partner'
      )
      AND status = 'active'
      AND is_deleted IS NOT TRUE
  );
$$;
REVOKE ALL ON FUNCTION public.can_encode_sales(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_encode_sales(uuid) TO authenticated;

COMMIT;
