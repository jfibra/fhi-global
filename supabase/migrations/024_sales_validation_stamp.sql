-- Migration 024: stamp who last changed a sale's validation status, and when.
--
-- Every validation change is already recorded in sales_activity_logs (022 made
-- that log append-only), but reading it means opening the admin-only Activity
-- tab on one sale at a time. The report table and the sale details need the
-- answer at a glance — "Validated · by Hernan Malubay · Aug 3" — so the stamp
-- lives on the sale row itself.
--
-- The name is stored denormalised on purpose: it is a snapshot of who acted at
-- that moment. If the profile is later renamed or deleted, the record of who
-- validated the sale should not quietly change with it. The uuid is kept
-- alongside for joins; the name is what gets displayed.
--
-- Backfill: seeded from the latest validation_status_changed activity log per
-- sale, so history recorded before this migration shows up too. Guarded on
-- validation_changed_at IS NULL — the runner re-applies every file on every
-- run, and a re-run must not overwrite stamps written by the app since.

BEGIN;

ALTER TABLE public.sales_reports
  ADD COLUMN IF NOT EXISTS validation_changed_by uuid,
  ADD COLUMN IF NOT EXISTS validation_changed_by_name text,
  ADD COLUMN IF NOT EXISTS validation_changed_at timestamptz;

-- Name preference: fullname, else fname+lname, else the email's local part —
-- one live admin (an OAuth-provisioned account) has a completely blank profile
-- name, and "chymeyap27" is more transparent than a dash.
WITH latest AS (
  SELECT DISTINCT ON (l.sales_report_id)
         l.sales_report_id,
         l.performed_by,
         l.created_at
  FROM public.sales_activity_logs l
  WHERE l.action_type = 'validation_status_changed'
  ORDER BY l.sales_report_id, l.created_at DESC
)
UPDATE public.sales_reports s
SET validation_changed_by      = latest.performed_by,
    validation_changed_by_name = COALESCE(
      NULLIF(btrim(p.fullname), ''),
      NULLIF(btrim(concat_ws(' ', p.fname, p.lname)), ''),
      split_part(u.email, '@', 1)
    ),
    validation_changed_at      = latest.created_at
FROM latest
LEFT JOIN public.profiles p ON p.id = latest.performed_by
LEFT JOIN auth.users u      ON u.id = latest.performed_by
WHERE s.id = latest.sales_report_id
  AND s.validation_changed_at IS NULL;

COMMIT;
