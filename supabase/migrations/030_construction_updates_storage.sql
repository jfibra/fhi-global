-- Migration 030: Supabase Storage bucket for construction-update files
-- Files are uploaded straight from the browser to Supabase Storage (bypassing
-- the ~4.5 MB Vercel serverless body limit that blocked large PDFs, and avoiding
-- CORS changes on the shared S3 bucket). The bucket is public: files are served
-- via their public URL, while per-project discovery stays gated by the
-- construction_updates row policy (migration 029). Idempotent.
--
-- NOTE: creating a policy on storage.objects requires the migration to run as a
-- privileged role (the Supabase `postgres` role does). If db:migrate errors on
-- the CREATE POLICY, create the bucket ("construction-updates", public) and the
-- equivalent INSERT policy from the Supabase dashboard → Storage instead.

BEGIN;

INSERT INTO storage.buckets (id, name, public)
VALUES ('construction-updates', 'construction-updates', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Project managers (admin/editor/super_admin) and developers may upload. The
-- specific project's ownership is enforced when the row is created via the
-- service-role API; a file with no row is harmless. Public read is served by the
-- public bucket, so no SELECT policy is needed.
DROP POLICY IF EXISTS "construction_updates_storage_insert" ON storage.objects;
CREATE POLICY "construction_updates_storage_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'construction-updates'
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('super_admin', 'admin', 'editor', 'developer')
        AND p.status = 'active'
        AND p.is_deleted IS NOT TRUE
    )
  );

COMMIT;
