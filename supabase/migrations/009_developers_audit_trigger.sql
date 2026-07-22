-- 009_developers_audit_trigger.sql
-- Guarantees that developer create / update / delete are recorded in
-- public.audit_logs, so they surface under the "Developers" category in
-- System Logs (tracing who created / last edited each developer).
--
-- This trigger is normally installed by 008_audit_logs.sql. This migration
-- re-asserts it idempotently and is a safe no-op if the audit function is not
-- present yet (in which case run 008 first). The migration runner re-applies
-- every file on each run, so this must stay idempotent.

BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE p.proname = 'fhi_audit' AND n.nspname = 'public'
  ) THEN
    DROP TRIGGER IF EXISTS trg_audit_developers ON public.developers;
    CREATE TRIGGER trg_audit_developers
      AFTER INSERT OR UPDATE OR DELETE ON public.developers
      FOR EACH ROW EXECUTE FUNCTION public.fhi_audit();
  ELSE
    RAISE NOTICE 'public.fhi_audit() not found — run 008_audit_logs.sql first; skipping developer audit trigger.';
  END IF;
END $$;

COMMIT;
