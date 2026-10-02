-- Migration 071: open the Documents library (069) to the sales ladder, read-only.
--
-- Agents, team leaders and unit managers get the same Library → Documents
-- page as admin staff — open a DLD form, fill it in, download it — but not
-- the upload/delete side, which stays admin-only (the insert/delete policies
-- from 069 are untouched). This is the "one-line RLS change" 069 anticipated:
-- the SELECT policy now admits active, non-deleted profiles in either group.
-- Keep in sync with ROLES_DOCUMENT_LIBRARY in lib/app-roles.ts.
--
-- Additive and idempotent for the runner.

BEGIN;

DROP POLICY IF EXISTS "documents_select_admin" ON public.documents;
DROP POLICY IF EXISTS "documents_select_library" ON public.documents;
CREATE POLICY "documents_select_library"
  ON public.documents FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.status = 'active'
        AND p.is_deleted IS NOT TRUE
        AND LOWER(TRIM(p.role)) IN ('super_admin', 'admin', 'agent', 'team_leader', 'unit_manager')
    )
  );

COMMIT;
