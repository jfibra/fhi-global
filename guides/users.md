-- 1. Create the User Roles table
CREATE TABLE public.user_roles (
  name TEXT PRIMARY KEY,
  label TEXT NOT NULL
);

INSERT INTO public.user_roles (name, label)
VALUES
  ('super_admin', 'Super Admin'),
  ('admin', 'Admin'),
  ('team_leader', 'Team Leader'),
  ('unit_manager', 'Unit Manager'),
  ('agent', 'Agent'),
  ('team_secretary', 'Team Secretary'),
  ('secretary', 'Secretary');

-- 2. Create the Profile Table (without the GENERATED column)
CREATE TABLE public.profiles (
id uuid REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
role TEXT REFERENCES public.user_roles(name) DEFAULT 'agent',
fname TEXT,
mname TEXT,
lname TEXT,
fullname TEXT, -- We will populate this via trigger
birthday DATE,
gender TEXT,
profile_url TEXT,
status TEXT DEFAULT 'active',
timezone TEXT DEFAULT 'UTC',
metadata JSONB DEFAULT '{}'::jsonb,
joined_at TIMESTAMPTZ DEFAULT now(),
updated_at TIMESTAMPTZ DEFAULT now(),
is_deleted BOOLEAN DEFAULT false,
deleted_at TIMESTAMPTZ
);

-- 3. Function to handle Fullname and Updated_at simultaneously
-- This keeps your database high-performance by reducing the number of triggers
CREATE OR REPLACE FUNCTION public.handle_profile_updates()
RETURNS TRIGGER AS $$
BEGIN
-- Set updated_at
NEW.updated_at = now();

-- Set fullname (handles NULLs and double spaces)
NEW.fullname := trim(
replace(
coalesce(NEW.fname, '') || ' ' ||
coalesce(NEW.mname, '') || ' ' ||
coalesce(NEW.lname, '')
, ' ', ' ')
);

-- If status changes to deleted, set deleted_at automatically
IF NEW.is_deleted IS TRUE AND (OLD.is_deleted IS FALSE OR OLD.is_deleted IS NULL) THEN
NEW.deleted_at = now();
ELSIF NEW.is_deleted IS FALSE THEN
NEW.deleted_at = NULL;
END IF;

RETURN NEW;
END;

$$
LANGUAGE plpgsql;

-- 4. Create the Trigger for updates
CREATE TRIGGER on_profile_update
    BEFORE INSERT OR UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.handle_profile_updates();

-- 5. Supabase Auth Link: Function to auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS
$$

BEGIN
INSERT INTO public.profiles (id, fname, lname, profile_url)
VALUES (
new.id,
new.raw_user_meta_data->>'first_name',
new.raw_user_meta_data->>'last_name',
new.raw_user_meta_data->>'avatar_url'
);
RETURN new;
END;

$$
LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Trigger to link Auth.Users to Public.Profiles
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 7. Bank accounts are defined separately for reuse (see guides/bank-accounts.md)
