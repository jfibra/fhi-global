-- Full traceable audit log: one table fed by (a) Postgres triggers on every
-- domain table (tamper-proof data-change rows, actor via auth.uid()) and (b)
-- app-level logAuditEvent() rows enriched with IP / user-agent / source for
-- auth + security + admin actions. Powers /dashboard/admin/system-logs.
--
-- Idempotent: the migration runner re-runs every file each invocation, so this
-- uses CREATE ... IF NOT EXISTS / CREATE OR REPLACE and DROP-before-CREATE for
-- policies and triggers.

BEGIN;

-- ── Table ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  occurred_at   timestamptz NOT NULL DEFAULT now(),
  category      text NOT NULL,             -- domain bucket (see components/dashboard/system-logs/log-meta.ts)
  event         text NOT NULL,             -- created|updated|deleted|restored|login|login_failed|register|role_granted|password_reset|user_provisioned|activated|deactivated|hard_deleted|cleared_logs|exported
  source        text NOT NULL DEFAULT 'app', -- database|auth|dashboard|system
  actor_id      uuid,                      -- NULL for system / service-role trigger rows
  actor_name    text,                      -- denormalized snapshot (no join needed to render)
  actor_role    text,                      -- denormalized snapshot
  subject_type  text,                      -- table name / domain object
  subject_id    text,                      -- text: handles both uuid and integer PKs
  subject_label text,                      -- denormalized human label
  description   text,
  old_values    jsonb,
  new_values    jsonb,
  changed_keys  text[],
  ip_address    text,
  user_agent    text,
  url           text,
  request_id    text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.audit_logs IS 'Traceable audit trail. Data-change rows written by trigger fhi_audit(); auth/security/admin rows written by lib/audit-log.ts. No CHECK on category/event on purpose (a rejected insert would be swallowed by the trigger exception handler and silently lost).';

CREATE INDEX IF NOT EXISTS idx_audit_logs_occurred          ON public.audit_logs (occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_category_occurred  ON public.audit_logs (category, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_event_occurred     ON public.audit_logs (event, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_occurred     ON public.audit_logs (actor_id, occurred_at DESC) WHERE actor_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_audit_logs_source_occurred    ON public.audit_logs (source, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_subject            ON public.audit_logs (subject_type, subject_id);

-- Trigram search on the two human-searchable columns (description / subject_label).
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_audit_logs_desc_trgm  ON public.audit_logs USING gin (description gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_audit_logs_label_trgm ON public.audit_logs USING gin (subject_label gin_trgm_ops);

-- ── Admin check helper (copied from guides/profiles-rls.sql; may not be deployed) ──
CREATE OR REPLACE FUNCTION public.is_admin_profile(_uid uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = _uid
      AND role IN ('super_admin', 'admin')
      AND status = 'active'
      AND is_deleted IS NOT TRUE
  );
$$;
REVOKE ALL ON FUNCTION public.is_admin_profile(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin_profile(uuid) TO authenticated;

-- ── RLS: admin-only read; no client writes (trigger + service role only) ─────
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audit_logs_select_admin" ON public.audit_logs;
CREATE POLICY "audit_logs_select_admin"
  ON public.audit_logs FOR SELECT TO authenticated
  USING (public.is_admin_profile(auth.uid()));

-- ── Aggregation RPCs (single round-trip; called via service-role client) ─────
CREATE OR REPLACE FUNCTION public.audit_overview()
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'today',    count(*) FILTER (WHERE occurred_at >= date_trunc('day', now())),
    'last_7d',  count(*) FILTER (WHERE occurred_at >= now() - interval '7 days'),
    'last_30d', count(*) FILTER (WHERE occurred_at >= now() - interval '30 days'),
    'total',    count(*),
    'security_7d', count(*) FILTER (
        WHERE occurred_at >= now() - interval '7 days'
        AND (category IN ('auth','security')
             OR event IN ('login_failed','password_reset','role_granted','hard_deleted','user_provisioned'))),
    'top_category_7d', (
        SELECT category FROM public.audit_logs
        WHERE occurred_at >= now() - interval '7 days'
        GROUP BY category ORDER BY count(*) DESC LIMIT 1),
    'top_category_7d_count', (
        SELECT count(*) FROM public.audit_logs a2
        WHERE a2.occurred_at >= now() - interval '7 days'
        AND a2.category = (
          SELECT category FROM public.audit_logs
          WHERE occurred_at >= now() - interval '7 days'
          GROUP BY category ORDER BY count(*) DESC LIMIT 1))
  )
  FROM public.audit_logs;
$$;

CREATE OR REPLACE FUNCTION public.audit_storage()
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'total_rows', count(*),
    'bytes',      pg_total_relation_size('public.audit_logs'),
    'oldest',     min(occurred_at),
    'newest',     max(occurred_at),
    'age_buckets', jsonb_build_object(
      'last_30d',  count(*) FILTER (WHERE occurred_at >= now() - interval '30 days'),
      'in_30_90d', count(*) FILTER (WHERE occurred_at <  now() - interval '30 days'  AND occurred_at >= now() - interval '90 days'),
      'in_90_180d',count(*) FILTER (WHERE occurred_at <  now() - interval '90 days'  AND occurred_at >= now() - interval '180 days'),
      'older_180d',count(*) FILTER (WHERE occurred_at <  now() - interval '180 days')),
    'deletion_preview', jsonb_build_object(
      '30',  count(*) FILTER (WHERE occurred_at < now() - interval '30 days'),
      '60',  count(*) FILTER (WHERE occurred_at < now() - interval '60 days'),
      '90',  count(*) FILTER (WHERE occurred_at < now() - interval '90 days'),
      '180', count(*) FILTER (WHERE occurred_at < now() - interval '180 days'),
      '365', count(*) FILTER (WHERE occurred_at < now() - interval '365 days'))
  )
  FROM public.audit_logs;
$$;

CREATE OR REPLACE FUNCTION public.audit_categories()
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(jsonb_object_agg(category, cnt), '{}'::jsonb)
  FROM (SELECT category, count(*) AS cnt FROM public.audit_logs GROUP BY category) t;
$$;

REVOKE ALL ON FUNCTION public.audit_overview()   FROM PUBLIC;
REVOKE ALL ON FUNCTION public.audit_storage()    FROM PUBLIC;
REVOKE ALL ON FUNCTION public.audit_categories() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.audit_overview()   TO service_role;
GRANT EXECUTE ON FUNCTION public.audit_storage()    TO service_role;
GRANT EXECUTE ON FUNCTION public.audit_categories() TO service_role;

-- ── Generic trigger function ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fhi_audit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_old jsonb;
  v_new jsonb;
  v_changed jsonb := '{}'::jsonb;   -- new side of changed keys
  v_prev    jsonb := '{}'::jsonb;   -- old side of changed keys
  v_key text;
  v_event text;
  v_category text;
  v_subject_id text;
  v_subject_label text;
  v_actor uuid := auth.uid();
  v_actor_name text := 'System';
  v_actor_role text := 'system';
  v_deny text[] := ARRAY[
    'updated_at','created_at','joined_at','deleted_at','published_at',
    'search_vector','tsv','embedding',
    'password','encrypted_password','password_hash','token','refresh_token','access_token',
    'og_card_options','metadata',
    -- financial / government identifiers — never surface verbatim in the trail
    'account_number','account_name','iban','swift_code','routing_number','tax_registration_number'
  ];
BEGIN
  -- Service-role / system writes to profiles (admin user management, register,
  -- Google provisioning, the handle_new_user bootstrap) have no auth.uid(), so
  -- the trigger could only attribute them to "System". Every such path already
  -- emits an app-level audit row via logAuditEvent() naming the real actor with
  -- IP + a friendly description, so this trigger row would be a confusing
  -- duplicate ("System updated roles"). Skip it. Authenticated self-service
  -- profile edits (auth.uid() present) are still audited and correctly
  -- attributed below.
  IF TG_TABLE_NAME = 'profiles' AND v_actor IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF TG_OP = 'INSERT' THEN
    v_new := to_jsonb(NEW);
    v_event := 'created';
  ELSIF TG_OP = 'DELETE' THEN
    v_old := to_jsonb(OLD);
    v_event := 'deleted';
  ELSE  -- UPDATE
    v_old := to_jsonb(OLD);
    v_new := to_jsonb(NEW);
    IF ((v_old->>'deleted_at') IS NULL AND (v_new->>'deleted_at') IS NOT NULL)
       OR (COALESCE((v_old->>'is_deleted')::boolean, false) = false
           AND COALESCE((v_new->>'is_deleted')::boolean, false) = true) THEN
      v_event := 'deleted';       -- soft delete surfaced as a delete
    ELSIF ((v_old->>'deleted_at') IS NOT NULL AND (v_new->>'deleted_at') IS NULL)
       OR (COALESCE((v_old->>'is_deleted')::boolean, false) = true
           AND COALESCE((v_new->>'is_deleted')::boolean, false) = false) THEN
      v_event := 'restored';
    ELSE
      v_event := 'updated';
    END IF;
  END IF;

  -- Build the changed-key diff (denylist filtered).
  IF TG_OP = 'UPDATE' THEN
    FOR v_key IN SELECT jsonb_object_keys(v_new) LOOP
      IF v_key = ANY(v_deny) THEN CONTINUE; END IF;
      IF (v_new->v_key) IS DISTINCT FROM (v_old->v_key) THEN
        v_changed := v_changed || jsonb_build_object(v_key, v_new->v_key);
        v_prev    := v_prev    || jsonb_build_object(v_key, v_old->v_key);
      END IF;
    END LOOP;
    -- A pure soft-delete / restore changes only deleted_at|is_deleted, which are
    -- denylisted — so surface the lifecycle transition explicitly. Without this
    -- the empty-diff early return below would silently drop every soft-delete
    -- and restore (the sole audit source for domains with no app-level logging).
    IF v_event IN ('deleted', 'restored') THEN
      IF (v_old->'deleted_at') IS DISTINCT FROM (v_new->'deleted_at') THEN
        v_prev    := v_prev    || jsonb_build_object('deleted_at', v_old->'deleted_at');
        v_changed := v_changed || jsonb_build_object('deleted_at', v_new->'deleted_at');
      END IF;
      IF (v_old->'is_deleted') IS DISTINCT FROM (v_new->'is_deleted') THEN
        v_prev    := v_prev    || jsonb_build_object('is_deleted', v_old->'is_deleted');
        v_changed := v_changed || jsonb_build_object('is_deleted', v_new->'is_deleted');
      END IF;
    ELSIF v_changed = '{}'::jsonb THEN
      RETURN NEW;  -- only denylisted / no-op columns changed → nothing to audit
    END IF;
  ELSIF TG_OP = 'INSERT' THEN
    FOR v_key IN SELECT jsonb_object_keys(v_new) LOOP
      IF v_key = ANY(v_deny) THEN CONTINUE; END IF;
      v_changed := v_changed || jsonb_build_object(v_key, v_new->v_key);
    END LOOP;
  ELSE  -- DELETE
    FOR v_key IN SELECT jsonb_object_keys(v_old) LOOP
      IF v_key = ANY(v_deny) THEN CONTINUE; END IF;
      v_prev := v_prev || jsonb_build_object(v_key, v_old->v_key);
    END LOOP;
  END IF;

  v_subject_id := COALESCE(v_new->>'id', v_old->>'id');

  v_category := CASE TG_TABLE_NAME
    WHEN 'profiles' THEN 'user_management'
    WHEN 'agent_listings' THEN 'listings'
    WHEN 'agent_listing_images' THEN 'listings'
    WHEN 'projects' THEN 'projects'
    WHEN 'developers' THEN 'developers'
    WHEN 'teams' THEN 'teams'
    WHEN 'team_memberships' THEN 'teams'
    WHEN 'sales_reports' THEN 'sales'
    WHEN 'purchases' THEN 'finance'
    WHEN 'purchase_categories' THEN 'finance'
    WHEN 'company_tax_entities' THEN 'finance'
    WHEN 'user_bank_accounts' THEN 'finance'
    WHEN 'support_tickets' THEN 'support'
    ELSE 'data'
  END;

  v_subject_label := CASE TG_TABLE_NAME
    WHEN 'profiles' THEN COALESCE(v_new->>'fullname', v_old->>'fullname')
    WHEN 'agent_listings' THEN COALESCE(v_new->>'title', v_old->>'title')
    WHEN 'projects' THEN COALESCE(v_new->>'name', v_old->>'name')
    WHEN 'developers' THEN COALESCE(v_new->>'name', v_old->>'name')
    WHEN 'teams' THEN COALESCE(v_new->>'name', v_old->>'name')
    WHEN 'sales_reports' THEN 'Sale ' || left(COALESCE(v_new->>'id', v_old->>'id'), 8)
    WHEN 'purchases' THEN COALESCE(v_new->>'invoice_number', v_old->>'invoice_number')
    WHEN 'purchase_categories' THEN COALESCE(v_new->>'category_name', v_old->>'category_name')
    WHEN 'company_tax_entities' THEN COALESCE(v_new->>'registered_name', v_old->>'registered_name')
    WHEN 'support_tickets' THEN COALESCE(v_new->>'title', v_old->>'title')
    WHEN 'user_bank_accounts' THEN COALESCE(v_new->>'bank_name', v_old->>'bank_name')
    ELSE NULL
  END;

  IF v_actor IS NOT NULL THEN
    SELECT p.fullname, p.role INTO v_actor_name, v_actor_role
    FROM public.profiles p WHERE p.id = v_actor;
    v_actor_name := COALESCE(v_actor_name, 'Unknown user');
    v_actor_role := COALESCE(v_actor_role, 'unknown');
  END IF;

  INSERT INTO public.audit_logs
    (category, event, source, actor_id, actor_name, actor_role,
     subject_type, subject_id, subject_label, old_values, new_values, changed_keys)
  VALUES
    (v_category, v_event, 'database', v_actor, v_actor_name, v_actor_role,
     TG_TABLE_NAME, v_subject_id, v_subject_label,
     NULLIF(v_prev, '{}'::jsonb), NULLIF(v_changed, '{}'::jsonb),
     ARRAY(SELECT jsonb_object_keys(CASE WHEN TG_OP = 'DELETE' THEN v_prev ELSE v_changed END)));

  RETURN COALESCE(NEW, OLD);
EXCEPTION WHEN OTHERS THEN
  RETURN COALESCE(NEW, OLD);  -- auditing must never block or fail the business write
END;
$$;

-- ── Per-table triggers (idempotent) ──────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_audit_profiles ON public.profiles;
CREATE TRIGGER trg_audit_profiles AFTER INSERT OR UPDATE OR DELETE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.fhi_audit();

DROP TRIGGER IF EXISTS trg_audit_agent_listings ON public.agent_listings;
CREATE TRIGGER trg_audit_agent_listings AFTER INSERT OR UPDATE OR DELETE ON public.agent_listings
  FOR EACH ROW EXECUTE FUNCTION public.fhi_audit();

DROP TRIGGER IF EXISTS trg_audit_agent_listing_images ON public.agent_listing_images;
CREATE TRIGGER trg_audit_agent_listing_images AFTER INSERT OR UPDATE OR DELETE ON public.agent_listing_images
  FOR EACH ROW EXECUTE FUNCTION public.fhi_audit();

DROP TRIGGER IF EXISTS trg_audit_projects ON public.projects;
CREATE TRIGGER trg_audit_projects AFTER INSERT OR UPDATE OR DELETE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.fhi_audit();

DROP TRIGGER IF EXISTS trg_audit_developers ON public.developers;
CREATE TRIGGER trg_audit_developers AFTER INSERT OR UPDATE OR DELETE ON public.developers
  FOR EACH ROW EXECUTE FUNCTION public.fhi_audit();

DROP TRIGGER IF EXISTS trg_audit_teams ON public.teams;
CREATE TRIGGER trg_audit_teams AFTER INSERT OR UPDATE OR DELETE ON public.teams
  FOR EACH ROW EXECUTE FUNCTION public.fhi_audit();

DROP TRIGGER IF EXISTS trg_audit_team_memberships ON public.team_memberships;
CREATE TRIGGER trg_audit_team_memberships AFTER INSERT OR UPDATE OR DELETE ON public.team_memberships
  FOR EACH ROW EXECUTE FUNCTION public.fhi_audit();

DROP TRIGGER IF EXISTS trg_audit_sales_reports ON public.sales_reports;
CREATE TRIGGER trg_audit_sales_reports AFTER INSERT OR UPDATE OR DELETE ON public.sales_reports
  FOR EACH ROW EXECUTE FUNCTION public.fhi_audit();

DROP TRIGGER IF EXISTS trg_audit_purchases ON public.purchases;
CREATE TRIGGER trg_audit_purchases AFTER INSERT OR UPDATE OR DELETE ON public.purchases
  FOR EACH ROW EXECUTE FUNCTION public.fhi_audit();

DROP TRIGGER IF EXISTS trg_audit_purchase_categories ON public.purchase_categories;
CREATE TRIGGER trg_audit_purchase_categories AFTER INSERT OR UPDATE OR DELETE ON public.purchase_categories
  FOR EACH ROW EXECUTE FUNCTION public.fhi_audit();

DROP TRIGGER IF EXISTS trg_audit_company_tax_entities ON public.company_tax_entities;
CREATE TRIGGER trg_audit_company_tax_entities AFTER INSERT OR UPDATE OR DELETE ON public.company_tax_entities
  FOR EACH ROW EXECUTE FUNCTION public.fhi_audit();

DROP TRIGGER IF EXISTS trg_audit_support_tickets ON public.support_tickets;
CREATE TRIGGER trg_audit_support_tickets AFTER INSERT OR UPDATE OR DELETE ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION public.fhi_audit();

DROP TRIGGER IF EXISTS trg_audit_user_bank_accounts ON public.user_bank_accounts;
CREATE TRIGGER trg_audit_user_bank_accounts AFTER INSERT OR UPDATE OR DELETE ON public.user_bank_accounts
  FOR EACH ROW EXECUTE FUNCTION public.fhi_audit();

COMMIT;
