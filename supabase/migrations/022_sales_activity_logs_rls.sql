-- Migration 022: RLS for sales_activity_logs — the last unprotected table in
-- the sales domain.
--
-- 020 locked sales_reports, clients and sales_attachments, but the activity log
-- was left open, and it holds old_value/new_value for every change to a sale —
-- contract prices, statuses, who changed them. So the numbers 020 hid were
-- still readable here, by anyone with the public key. It was also deletable,
-- which means the audit trail of a sale could simply be erased.
--
-- Visibility follows the parent sale, exactly like sales_attachments: the
-- owning agent, plus admin staff and secretaries.
--
-- Writes: INSERT is allowed for anyone who can see the sale, because
-- logActivity() in lib/sales-service.ts records from the browser client.
-- UPDATE and DELETE are denied outright — an audit trail nobody can rewrite is
-- the entire point. Service-role callers bypass RLS and are unaffected.
--
-- Idempotent and transactional: the runner re-applies every file on each run.

BEGIN;

ALTER TABLE public.sales_activity_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sales_activity_logs_select_via_sale" ON public.sales_activity_logs;
CREATE POLICY "sales_activity_logs_select_via_sale"
  ON public.sales_activity_logs FOR SELECT TO authenticated
  USING (public.can_view_sale(auth.uid(), sales_report_id));

DROP POLICY IF EXISTS "sales_activity_logs_insert_via_sale" ON public.sales_activity_logs;
CREATE POLICY "sales_activity_logs_insert_via_sale"
  ON public.sales_activity_logs FOR INSERT TO authenticated
  WITH CHECK (public.can_view_sale(auth.uid(), sales_report_id));

-- Append-only from the client.
DROP POLICY IF EXISTS "sales_activity_logs_update_none" ON public.sales_activity_logs;
CREATE POLICY "sales_activity_logs_update_none"
  ON public.sales_activity_logs FOR UPDATE TO authenticated
  USING (false);

DROP POLICY IF EXISTS "sales_activity_logs_delete_none" ON public.sales_activity_logs;
CREATE POLICY "sales_activity_logs_delete_none"
  ON public.sales_activity_logs FOR DELETE TO authenticated
  USING (false);

COMMIT;
