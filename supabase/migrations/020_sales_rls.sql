-- Migration 020: Row Level Security for the sales tables and profiles.
--
-- WHY THIS EXISTS
-- RLS was never enabled on sales_reports, clients, sales_attachments or
-- profiles, and PostgREST grants anon/authenticated full SELECT/INSERT/UPDATE/
-- DELETE on all four. Because the anon key ships to every browser, anyone
-- could read every sale, contract price and client's contact details — and
-- update or delete them — without logging in. Verified live before writing
-- this. The app's own filtering (lib/sales-service.ts) is client-side and
-- cannot enforce anything.
--
-- WHO SEES WHAT (mirrors the app as it behaves today)
--   sales_reports  read : the owning agent, plus admin staff AND secretaries.
--                         Secretaries matter: fetchSales does NOT scope them,
--                         so they read every sale today. Omitting them would
--                         silently empty their Sales Reports page — PostgREST
--                         returns [] rather than an error, so nothing would
--                         even show a toast.
--                  write: the owning agent creates their own; only
--                         super_admin/admin edit, matching updateSale and
--                         updateSaleValidationStatus.
--   clients        has no owner column, so visibility is derived by joining
--                  through sales_reports. INSERT must stay open to sales-
--                  capable roles because createSale writes the client BEFORE
--                  the sale row exists.
--   sales_attachments follows its parent sale.
--   profiles       any signed-in user may read (the app shows agent names on
--                  sales, teammates, listings); nobody anonymous may. Writes
--                  are own-row only, plus admin.
--
-- Service-role callers bypass RLS entirely, so every app/api route using
-- createAdminSupabase() — sale deletion, Team Sales, the admin user APIs — is
-- unaffected by this file.
--
-- The runner re-applies every migration on each run, in one non-transactional
-- pass, so this file is wrapped in BEGIN/COMMIT and every statement is
-- idempotent (DROP POLICY IF EXISTS before CREATE, CREATE OR REPLACE).

BEGIN;

-- ── Role helpers ─────────────────────────────────────────────────────────────
-- SECURITY DEFINER so the lookup itself is not subject to RLS on profiles —
-- a policy on profiles that plainly SELECTed profiles would recurse.
-- is_admin_profile(uuid) already exists (008_audit_logs.sql) and covers
-- super_admin/admin; these add the wider sales audiences.

/** Roles that read every sale today: admin staff + both secretary kinds. */
CREATE OR REPLACE FUNCTION public.can_read_all_sales(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = _uid
      AND LOWER(TRIM(role)) IN ('super_admin', 'admin', 'secretary', 'team_secretary')
      AND status = 'active'
      AND is_deleted IS NOT TRUE
  );
$$;
REVOKE ALL ON FUNCTION public.can_read_all_sales(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_read_all_sales(uuid) TO authenticated;

/** Roles that may record a sale (and therefore create the client row first). */
CREATE OR REPLACE FUNCTION public.can_encode_sales(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = _uid
      AND LOWER(TRIM(role)) IN (
        'super_admin', 'admin', 'secretary', 'team_secretary',
        'agent', 'team_leader', 'unit_manager'
      )
      AND status = 'active'
      AND is_deleted IS NOT TRUE
  );
$$;
REVOKE ALL ON FUNCTION public.can_encode_sales(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_encode_sales(uuid) TO authenticated;

/**
 * True when no sale references this client.
 *
 * SECURITY DEFINER matters here: a plain `NOT EXISTS (SELECT … sales_reports)`
 * inside the policy runs as the CALLER, so an agent who cannot see the
 * referencing sale would read zero rows and conclude the client is an orphan —
 * letting them delete another agent's client. Only the foreign key stopped
 * that in testing.
 */
CREATE OR REPLACE FUNCTION public.client_is_orphan(_client_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM public.sales_reports s WHERE s.client_id = _client_id
  );
$$;
REVOKE ALL ON FUNCTION public.client_is_orphan(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.client_is_orphan(uuid) TO authenticated;

/** True when _uid may see the sale identified by _sale_id. */
CREATE OR REPLACE FUNCTION public.can_view_sale(_uid uuid, _sale_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.can_read_all_sales(_uid)
      OR EXISTS (
           SELECT 1 FROM public.sales_reports s
           WHERE s.id = _sale_id AND s.agent_id = _uid
         );
$$;
REVOKE ALL ON FUNCTION public.can_view_sale(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_view_sale(uuid, uuid) TO authenticated;

-- ── sales_reports ────────────────────────────────────────────────────────────
ALTER TABLE public.sales_reports ENABLE ROW LEVEL SECURITY;

-- Policies of the same command are OR'd (see 002_agent_listings.sql).
DROP POLICY IF EXISTS "sales_reports_select_own" ON public.sales_reports;
CREATE POLICY "sales_reports_select_own"
  ON public.sales_reports FOR SELECT TO authenticated
  USING (agent_id = auth.uid());

DROP POLICY IF EXISTS "sales_reports_select_staff" ON public.sales_reports;
CREATE POLICY "sales_reports_select_staff"
  ON public.sales_reports FOR SELECT TO authenticated
  USING (public.can_read_all_sales(auth.uid()));

-- createSale always stamps agent_id = the caller, including for admins.
DROP POLICY IF EXISTS "sales_reports_insert_own" ON public.sales_reports;
CREATE POLICY "sales_reports_insert_own"
  ON public.sales_reports FOR INSERT TO authenticated
  WITH CHECK (agent_id = auth.uid() AND public.can_encode_sales(auth.uid()));

-- Editing someone else's sale, and changing validation/commission status, is
-- admin-only in the app (updateSale / updateSaleValidationStatus).
DROP POLICY IF EXISTS "sales_reports_update_admin" ON public.sales_reports;
CREATE POLICY "sales_reports_update_admin"
  ON public.sales_reports FOR UPDATE TO authenticated
  USING (public.is_admin_profile(auth.uid()))
  WITH CHECK (public.is_admin_profile(auth.uid()));

-- No client-side deletes: app/api/sales/[id] deletes on the service-role
-- client, which bypasses RLS. Nothing legitimate deletes from the browser.
DROP POLICY IF EXISTS "sales_reports_delete_none" ON public.sales_reports;
CREATE POLICY "sales_reports_delete_none"
  ON public.sales_reports FOR DELETE TO authenticated
  USING (false);

-- ── clients ──────────────────────────────────────────────────────────────────
-- Reachability is defined by the sales that reference the row… except for the
-- moment right after creation, when no sale references it yet.
--
-- createSale inserts the client and reads back its id (`.insert().select("id")`)
-- to build the sale. Under a purely sale-derived policy that RETURNING is
-- invisible and the insert fails with "new row violates row-level security" —
-- encoding a sale breaks entirely. This column closes that window: it defaults
-- to the caller, so the creator can always see what they just wrote, and the
-- app needs no change to populate it.
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS created_by uuid;
ALTER TABLE public.clients ALTER COLUMN created_by SET DEFAULT auth.uid();
COMMENT ON COLUMN public.clients.created_by IS
  'Who inserted the row (defaults to auth.uid()). Lets RLS show a just-created client to its creator before a sale references it.';

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "clients_select_via_sale" ON public.clients;
CREATE POLICY "clients_select_via_sale"
  ON public.clients FOR SELECT TO authenticated
  USING (
    public.can_read_all_sales(auth.uid())
    OR created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.sales_reports s
      WHERE s.client_id = clients.id AND s.agent_id = auth.uid()
    )
  );

-- createSale inserts the client BEFORE the sale exists, so this cannot be
-- expressed as "a sale of mine references it" — it is gated on the role.
DROP POLICY IF EXISTS "clients_insert_sales_roles" ON public.clients;
CREATE POLICY "clients_insert_sales_roles"
  ON public.clients FOR INSERT TO authenticated
  WITH CHECK (public.can_encode_sales(auth.uid()));

DROP POLICY IF EXISTS "clients_update_via_sale" ON public.clients;
CREATE POLICY "clients_update_via_sale"
  ON public.clients FOR UPDATE TO authenticated
  USING (
    public.can_read_all_sales(auth.uid())
    OR created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.sales_reports s
      WHERE s.client_id = clients.id AND s.agent_id = auth.uid()
    )
  )
  WITH CHECK (
    public.can_read_all_sales(auth.uid())
    OR created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.sales_reports s
      WHERE s.client_id = clients.id AND s.agent_id = auth.uid()
    )
  );

-- Only the orphan-cleanup case: createSale rolls back the client it just made
-- when the sale insert fails, and that row is referenced by nothing.
DROP POLICY IF EXISTS "clients_delete_orphan" ON public.clients;
CREATE POLICY "clients_delete_orphan"
  ON public.clients FOR DELETE TO authenticated
  USING (
    public.can_encode_sales(auth.uid())
    AND public.client_is_orphan(clients.id)
  );

-- ── sales_attachments ────────────────────────────────────────────────────────
-- Follows the parent sale. Note the authoritative upload path already runs on
-- the service-role client (app/api/sales/attachments), which bypasses RLS.
ALTER TABLE public.sales_attachments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sales_attachments_select_via_sale" ON public.sales_attachments;
CREATE POLICY "sales_attachments_select_via_sale"
  ON public.sales_attachments FOR SELECT TO authenticated
  USING (public.can_view_sale(auth.uid(), sales_report_id));

DROP POLICY IF EXISTS "sales_attachments_insert_via_sale" ON public.sales_attachments;
CREATE POLICY "sales_attachments_insert_via_sale"
  ON public.sales_attachments FOR INSERT TO authenticated
  WITH CHECK (public.can_view_sale(auth.uid(), sales_report_id));

-- Agents and secretaries genuinely delete their own attachments from the
-- browser (deleteSaleAttachment), gated in the app by the sale's validation
-- status. RLS enforces the ownership half; the status rule stays in the app.
DROP POLICY IF EXISTS "sales_attachments_update_via_sale" ON public.sales_attachments;
CREATE POLICY "sales_attachments_update_via_sale"
  ON public.sales_attachments FOR UPDATE TO authenticated
  USING (public.can_view_sale(auth.uid(), sales_report_id))
  WITH CHECK (public.can_view_sale(auth.uid(), sales_report_id));

DROP POLICY IF EXISTS "sales_attachments_delete_via_sale" ON public.sales_attachments;
CREATE POLICY "sales_attachments_delete_via_sale"
  ON public.sales_attachments FOR DELETE TO authenticated
  USING (public.can_view_sale(auth.uid(), sales_report_id));

-- Older names from earlier drafts of this file, in case one was applied.
DROP POLICY IF EXISTS "sales_attachments_update_admin" ON public.sales_attachments;
DROP POLICY IF EXISTS "sales_attachments_delete_admin" ON public.sales_attachments;

-- ── profiles ─────────────────────────────────────────────────────────────────
-- Signed-in users may read profiles: the app shows agent names on sales rows,
-- teammates, uploaders and listing owners. What this stops is the anonymous
-- read — today all 191 rows, including the phone numbers in metadata, are
-- public. Writes stay own-row (plus admin).
--
-- Anything public-facing that needs an agent's details must go through the
-- service-role client (app/listings/[id]/page.tsx does).
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_authenticated" ON public.profiles;
CREATE POLICY "profiles_select_authenticated"
  ON public.profiles FOR SELECT TO authenticated
  USING (true);

-- proxy.ts auto-creates a missing profile as the logged-in user.
DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
CREATE POLICY "profiles_insert_own"
  ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id AND is_deleted IS NOT TRUE);

DROP POLICY IF EXISTS "profiles_update_admin" ON public.profiles;
CREATE POLICY "profiles_update_admin"
  ON public.profiles FOR UPDATE TO authenticated
  USING (public.is_admin_profile(auth.uid()))
  WITH CHECK (public.is_admin_profile(auth.uid()));

DROP POLICY IF EXISTS "profiles_delete_none" ON public.profiles;
CREATE POLICY "profiles_delete_none"
  ON public.profiles FOR DELETE TO authenticated
  USING (false);

COMMIT;
