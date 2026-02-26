-- 1. THE TEAMS TABLE
CREATE TABLE public.teams (
id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
name TEXT NOT NULL,
slug TEXT UNIQUE,
description TEXT,
logo_url TEXT,
parent_id uuid REFERENCES public.teams(id) ON DELETE CASCADE,
team_type TEXT DEFAULT 'department',
is_active BOOLEAN DEFAULT true,
created_at TIMESTAMPTZ DEFAULT now(),
updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. THE MEMBERSHIP & HISTORY TABLE
CREATE TABLE public.team_memberships (
id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
team_id uuid REFERENCES public.teams(id) ON DELETE CASCADE,
role_in_team TEXT DEFAULT 'member',
joined_at TIMESTAMPTZ DEFAULT now(),
left_at TIMESTAMPTZ,
is_active BOOLEAN GENERATED ALWAYS AS (left_at IS NULL) STORED,
transfer_reason TEXT
);

-- 3. THE TRANSFER TRIGGER FUNCTION
CREATE OR REPLACE FUNCTION public.handle_team_transfer()
RETURNS TRIGGER AS $$
BEGIN
UPDATE public.team_memberships
SET left_at = now()
WHERE user_id = NEW.user_id
AND left_at IS NULL
AND id != NEW.id;
RETURN NEW;
END;

$$
LANGUAGE plpgsql;

-- 4. APPLY THE TRIGGER
CREATE TRIGGER on_team_transfer
  BEFORE INSERT ON public.team_memberships
  FOR EACH ROW
  WHEN (NEW.left_at IS NULL)
  EXECUTE FUNCTION public.handle_team_transfer();

-- 5. THE FIXED VIEW (CORRECTED COLUMN NAMES)
CREATE OR REPLACE VIEW public.team_hierarchy_members AS
WITH RECURSIVE team_tree AS (
    -- Base: Start with every team as its own "root"
    SELECT
        id AS root_team_id,
        id AS current_team_id,
        name AS root_team_name
    FROM public.teams

    UNION ALL

    -- Recursive: Find all children of those teams
    -- This links the parent_id of a team to the current_team_id in our tree
    SELECT
        tt.root_team_id,
        t.id AS current_team_id,
        tt.root_team_name
    FROM public.teams t
    JOIN team_tree tt ON t.parent_id = tt.current_team_id
)
SELECT
    tt.root_team_name,
    t.name AS specific_team_name,
    p.fullname,
    tm.role_in_team,
    tm.joined_at,
    tm.is_active
FROM team_tree tt
JOIN public.team_memberships tm ON tt.current_team_id = tm.team_id
JOIN public.profiles p ON tm.user_id = p.id
JOIN public.teams t ON tm.team_id = t.id;
$$
