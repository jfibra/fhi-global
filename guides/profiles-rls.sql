-- Profiles RLS policies for Supabase
-- Run this in your Supabase SQL editor.

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Helper function for admin checks WITHOUT recursive RLS evaluation.
-- SECURITY DEFINER lets this function run with owner privileges.
CREATE OR REPLACE FUNCTION public.is_admin_profile(_uid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = _uid
      AND role IN ('super_admin', 'admin')
      AND status = 'active'
      AND is_deleted IS NOT TRUE
  );
$$;

REVOKE ALL ON FUNCTION public.is_admin_profile(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin_profile(uuid) TO authenticated;

-- IMPORTANT:
-- Keep profile creation unblocked for both normal signups and backend/admin flows.
-- If your trigger inserts into public.profiles after auth.users creation,
-- these INSERT policies ensure RLS does not block valid writes.

-- 0) Users can insert only their own profile row (signup/self-service flow)
DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
CREATE POLICY "profiles_insert_own"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

-- 0.1) Service role can insert any profile row (server/admin flow)
DROP POLICY IF EXISTS "profiles_insert_service_role" ON public.profiles;
CREATE POLICY "profiles_insert_service_role"
ON public.profiles
FOR INSERT
TO service_role
WITH CHECK (true);

-- 1) Users can read their own profile
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
CREATE POLICY "profiles_select_own"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- 2) Users can update safe fields on their own profile
-- Note: role/status/is_deleted are excluded from app-level updates and should
--       be managed by privileged roles via service flows.
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (
  auth.uid() = id
  AND is_deleted IS NOT TRUE
);

-- 3) Admins can read all profiles
DROP POLICY IF EXISTS "profiles_select_admin" ON public.profiles;
CREATE POLICY "profiles_select_admin"
ON public.profiles
FOR SELECT
TO authenticated
USING (public.is_admin_profile(auth.uid()));

-- 4) Admins can update all profiles
DROP POLICY IF EXISTS "profiles_update_admin" ON public.profiles;
CREATE POLICY "profiles_update_admin"
ON public.profiles
FOR UPDATE
TO authenticated
USING (public.is_admin_profile(auth.uid()))
WITH CHECK (public.is_admin_profile(auth.uid()));

-- Optional: lock down delete from client-side authenticated users
DROP POLICY IF EXISTS "profiles_delete_none" ON public.profiles;
CREATE POLICY "profiles_delete_none"
ON public.profiles
FOR DELETE
TO authenticated
USING (false);
