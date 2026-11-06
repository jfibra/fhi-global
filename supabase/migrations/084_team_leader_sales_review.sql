-- Migration 084: team leaders review their team's sales (boss, 2026-11-06).
--
-- WHAT THIS ADDS
-- A team leader can now fix the sales their team recorded — details, client,
-- contract and the partnership split — and confirm a sale before the admin
-- validates it. Both are switched on per team, by an admin, from the Teams
-- page's ⋯ menu:
--
--   teams.leader_can_edit_sales   the leader may edit the team's sales
--   teams.leader_confirms_sales   the leader confirms a sale first; the admin
--                                 still validates it, and is never blocked
--                                 when the leader hasn't acted
--
-- A switch on a team covers every member of it and of its subteams, at any
-- depth — the same tree every team figure uses (Team Sales, Team Report).
--
-- WHO IS "THE TEAM LEADER"
-- An active team_leader account holding an active membership in the team
-- whose role_in_team reads like a leader ("Team Leader", "Head …") — the rule
-- lib/team-report/data.ts already uses to name a team's leaders. Unit
-- managers are not included. team_leader_scope() below is the one definition:
-- RLS (my_led_member_ids), the server routes (app/api/team/sales/*) and the
-- admin's "waiting for team leader" hint (sales_leader_review) all read it.
--
-- WHO SEES / WRITES WHAT
--   read   A team leader always reads their team's sales, their clients and
--          their files (SELECT policies below) — the "My team" view of Sales
--          Reports, whatever the switches (the boss's call, 2026-11-06: "so
--          Michelle can easily see the other agents' sales"). The switches
--          only add Edit and Confirm.
--   write  Nothing is widened. Every leader write goes through the service-role
--          routes under app/api/team/sales, which check team_leader_scope()
--          and touch only the sale's details, client, partners and the new
--          stamps — never its validation or commission status. A leader's
--          edit keeps the sale's status (the boss's call); it is stamped and
--          logged instead.
--
-- STAMPS (snapshots, like 024's validation stamp — a rename later must not
-- rewrite who acted):
--   sales_reports.edited_*            last change to a sale's details, client
--                                     or partners, by an admin or a leader
--   sales_reports.leader_confirmed_*  the team leader's confirmation; NULL =
--                                     not confirmed
--
-- teams has NO row level security (verified live 2026-11-06), so anyone with
-- the public key could flip a switch through the REST API. The guard trigger
-- below allows that only to admin staff, the service role and migrations —
-- the 078 pattern.
--
-- Additive, and idempotent for the runner, which re-applies every file on
-- every run. The edited_* backfill only fills rows still NULL.

BEGIN;

-- ── Team switches ───────────────────────────────────────────────────────────
ALTER TABLE public.teams
  ADD COLUMN IF NOT EXISTS leader_can_edit_sales boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS leader_confirms_sales boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.teams.leader_can_edit_sales IS
  'The team''s leader may edit the sales recorded by its members (subteams included). Admin-only switch (trg_teams_guard_leader_switches).';
COMMENT ON COLUMN public.teams.leader_confirms_sales IS
  'The team''s leader confirms its members'' sales before the admin validates them; the admin is never blocked. Admin-only switch.';

CREATE OR REPLACE FUNCTION public.teams_guard_leader_switches()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Only API callers acting as a user are limited; service_role and postgres pass.
  -- Two IFs, not one OR: anon may not execute is_admin_profile().
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;
  IF current_user = 'authenticated' AND public.is_admin_profile(auth.uid()) THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.leader_can_edit_sales := false;
    NEW.leader_confirms_sales := false;
    RETURN NEW;
  END IF;

  IF NEW.leader_can_edit_sales IS DISTINCT FROM OLD.leader_can_edit_sales
     OR NEW.leader_confirms_sales IS DISTINCT FROM OLD.leader_confirms_sales THEN
    RAISE EXCEPTION 'Only admin staff can change what a team leader may do with sales.'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_teams_guard_leader_switches ON public.teams;
CREATE TRIGGER trg_teams_guard_leader_switches
  BEFORE INSERT OR UPDATE ON public.teams
  FOR EACH ROW EXECUTE FUNCTION public.teams_guard_leader_switches();

-- ── Sale stamps ─────────────────────────────────────────────────────────────
ALTER TABLE public.sales_reports
  ADD COLUMN IF NOT EXISTS edited_at                timestamptz,
  ADD COLUMN IF NOT EXISTS edited_by                uuid,
  ADD COLUMN IF NOT EXISTS edited_by_name           text,
  ADD COLUMN IF NOT EXISTS leader_confirmed_at      timestamptz,
  ADD COLUMN IF NOT EXISTS leader_confirmed_by      uuid,
  ADD COLUMN IF NOT EXISTS leader_confirmed_by_name text;

-- Backfill "edited" from the activity log. Until now updateSale logged
-- sale_updated on EVERY save (its before/after objects never had the same
-- keys), so only entries where a detail really changed count — status columns
-- aside, empty string read as NULL. Guarded on edited_at IS NULL: a re-run must
-- not overwrite a stamp the app has written since.
WITH changed AS (
  SELECT DISTINCT ON (l.sales_report_id)
         l.sales_report_id,
         l.performed_by,
         l.created_at
  FROM public.sales_activity_logs l
  WHERE l.action_type IN ('sale_updated', 'client_information_updated')
    AND jsonb_typeof(l.old_value) = 'object'
    AND jsonb_typeof(l.new_value) = 'object'
    AND EXISTS (
      SELECT 1
      FROM jsonb_each(l.old_value) o
      WHERE o.key NOT IN ('validation_status', 'commission_status', 'updated_by')
        AND l.new_value ? o.key
        AND NULLIF(o.value #>> '{}', '') IS DISTINCT FROM NULLIF(l.new_value #>> ARRAY[o.key], '')
    )
  ORDER BY l.sales_report_id, l.created_at DESC
)
UPDATE public.sales_reports s
SET edited_at      = changed.created_at,
    edited_by      = changed.performed_by,
    edited_by_name = COALESCE(
      NULLIF(btrim(p.fullname), ''),
      NULLIF(btrim(concat_ws(' ', p.fname, p.lname)), ''),
      split_part(u.email, '@', 1)
    )
FROM changed
LEFT JOIN public.profiles p ON p.id = changed.performed_by
LEFT JOIN auth.users u      ON u.id = changed.performed_by
WHERE s.id = changed.sales_report_id
  AND s.edited_at IS NULL;

-- ── Who a team leader leads ─────────────────────────────────────────────────
-- One row per member of every team _leader leads (its subteams included, any
-- depth), with what the switches of the leader's team allow. A member reached
-- through two led teams gets the most either allows. The leader is a member of
-- their own team, so their own sales are in scope (the boss's call).
--
-- service_role only: it names every member of a team. Browsers get the ids
-- they need through my_led_member_ids() (RLS) and app/api/team/sales-access.
CREATE OR REPLACE FUNCTION public.team_leader_scope(_leader uuid)
RETURNS TABLE (member_id uuid, team_id uuid, team_name text, can_edit boolean, can_confirm boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH RECURSIVE roots AS (
    SELECT DISTINCT t.id, t.leader_can_edit_sales, t.leader_confirms_sales
    FROM public.team_memberships tm
    JOIN public.teams t    ON t.id = tm.team_id AND t.is_active
    JOIN public.profiles p ON p.id = tm.user_id
    WHERE tm.user_id = _leader
      AND tm.left_at IS NULL
      AND tm.role_in_team ~* '(lead|head)'
      AND LOWER(TRIM(p.role)) = 'team_leader'
      AND p.status = 'active'
      AND p.is_deleted IS NOT TRUE
  ),
  -- UNION (not UNION ALL) also stops a parent_id cycle: a revisited row is a duplicate.
  tree AS (
    SELECT r.id AS team_id, r.id AS root_id, r.leader_can_edit_sales AS can_edit, r.leader_confirms_sales AS can_confirm
    FROM roots r
    UNION
    SELECT c.id, tree.root_id, tree.can_edit, tree.can_confirm
    FROM public.teams c
    JOIN tree ON c.parent_id = tree.team_id
    WHERE c.is_active
  )
  SELECT m.user_id,
         (array_agg(tree.root_id ORDER BY rt.name))[1],
         (array_agg(rt.name ORDER BY rt.name))[1],
         bool_or(tree.can_edit),
         bool_or(tree.can_confirm)
  FROM tree
  JOIN public.team_memberships m ON m.team_id = tree.team_id AND m.left_at IS NULL
  JOIN public.profiles mp        ON mp.id = m.user_id AND mp.is_deleted IS NOT TRUE
  JOIN public.teams rt           ON rt.id = tree.root_id
  GROUP BY m.user_id;
$$;
REVOKE ALL ON FUNCTION public.team_leader_scope(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.team_leader_scope(uuid) FROM authenticated, anon;
GRANT EXECUTE ON FUNCTION public.team_leader_scope(uuid) TO service_role;

-- Every member the caller leads, whatever the switches. For the SELECT policies, which
-- call it as `agent_id IN (SELECT unnest(public.my_led_member_ids()))` — an
-- uncorrelated subquery Postgres runs once per query (a hashed SubPlan), not
-- once per row. Empty for everyone who leads nothing.
CREATE OR REPLACE FUNCTION public.my_led_member_ids()
RETURNS uuid[]
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(array_agg(s.member_id), '{}')
  FROM public.team_leader_scope(auth.uid()) s;
$$;
REVOKE ALL ON FUNCTION public.my_led_member_ids() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.my_led_member_ids() TO authenticated;

-- For the report's "Waiting for team leader" line: which of these agents have a
-- leader who confirms sales first, and who. An agent is never their own
-- leader here — a leader's own sale goes straight to the admin unless a team
-- above has a leader of its own. Leader names only; nothing a signed-in user
-- can't already see on the Teams pages.
CREATE OR REPLACE FUNCTION public.sales_leader_review(p_agent_ids uuid[])
RETURNS TABLE (agent_id uuid, leader_names text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH RECURSIVE leaders AS (
    SELECT DISTINCT
           tm.user_id AS leader_id,
           t.id       AS root_id,
           COALESCE(
             NULLIF(btrim(regexp_replace(p.fullname, '\s+', ' ', 'g')), ''),
             NULLIF(btrim(concat_ws(' ', p.fname, p.lname)), ''),
             'Team leader'
           ) AS leader_name
    FROM public.team_memberships tm
    JOIN public.teams t    ON t.id = tm.team_id AND t.is_active AND t.leader_confirms_sales
    JOIN public.profiles p ON p.id = tm.user_id
    WHERE tm.left_at IS NULL
      AND tm.role_in_team ~* '(lead|head)'
      AND LOWER(TRIM(p.role)) = 'team_leader'
      AND p.status = 'active'
      AND p.is_deleted IS NOT TRUE
  ),
  tree AS (
    SELECT l.root_id AS team_id, l.leader_id, l.leader_name FROM leaders l
    UNION
    SELECT c.id, tree.leader_id, tree.leader_name
    FROM public.teams c
    JOIN tree ON c.parent_id = tree.team_id
    WHERE c.is_active
  )
  SELECT m.user_id, string_agg(DISTINCT tree.leader_name, ', ')
  FROM tree
  JOIN public.team_memberships m ON m.team_id = tree.team_id AND m.left_at IS NULL
  WHERE m.user_id = ANY (p_agent_ids)
    AND m.user_id <> tree.leader_id
  GROUP BY m.user_id;
$$;
REVOKE ALL ON FUNCTION public.sales_leader_review(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sales_leader_review(uuid[]) TO authenticated;

-- ── Read access for team leaders ────────────────────────────────────────────
-- SELECT only — a team leader reads their team's sales; every write is a
-- service-role route gated by the switches. Policies of one command are OR'd
-- with the existing ones.
DROP POLICY IF EXISTS sales_reports_select_team_leader ON public.sales_reports;
CREATE POLICY sales_reports_select_team_leader ON public.sales_reports
  FOR SELECT TO authenticated
  USING (agent_id IN (SELECT unnest(public.my_led_member_ids())));

DROP POLICY IF EXISTS clients_select_via_team_sale ON public.clients;
CREATE POLICY clients_select_via_team_sale ON public.clients
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.sales_reports s
    WHERE s.client_id = clients.id
      AND s.agent_id IN (SELECT unnest(public.my_led_member_ids()))
  ));

DROP POLICY IF EXISTS sales_attachments_select_team_sale ON public.sales_attachments;
CREATE POLICY sales_attachments_select_team_sale ON public.sales_attachments
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.sales_reports s
    WHERE s.id = sales_attachments.sales_report_id
      AND s.agent_id IN (SELECT unnest(public.my_led_member_ids()))
  ));

COMMIT;
