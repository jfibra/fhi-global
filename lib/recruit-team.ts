import type { SupabaseClient } from "@supabase/supabase-js"

/**
 * A new recruit joins their recruiter's team (2026-10-02): when someone
 * registers through an invite link and the inviter belongs to an active team,
 * the recruit becomes a member of that same team. That keeps a leader's team
 * equal to "everyone under them" — CMG Properties is Michelle Q. Guinto and
 * her whole downline — without an admin adding each sign-up by hand.
 *
 * Best effort: a failure here never blocks a registration. Developer accounts
 * never join (they are partners, not team members). The on_team_transfer
 * trigger keeps one active membership per person.
 */

/** The team role that matches an account role (the Teams page's role list). */
export function teamRoleFor(accountRole: string | null | undefined): string {
  switch ((accountRole ?? "").toLowerCase()) {
    case "team_leader":
      return "Team Leader"
    case "unit_manager":
      return "Unit Manager"
    case "agent":
    case "global_partner":
      return "Agent"
    case "secretary":
    case "team_secretary":
      return "Secretary"
    default:
      return "Member"
  }
}

export async function joinInvitersTeam(
  admin: SupabaseClient,
  opts: { userId: string; inviterId: string; accountRole: string | null },
): Promise<{ teamId: string; teamName: string | null } | null> {
  try {
    if ((opts.accountRole ?? "").toLowerCase() === "developer") return null
    const { data: rows } = await admin
      .from("team_memberships")
      .select("team_id, teams!inner(id, name, is_active)")
      .eq("user_id", opts.inviterId)
      .eq("is_active", true)
      .eq("teams.is_active", true)
      .order("joined_at", { ascending: false })
      .limit(1)
    const row = (rows?.[0] ?? null) as unknown as { team_id: string; teams: { id: string; name: string | null } | null } | null
    if (!row?.team_id) return null
    // Already in it (a re-run, or an admin added them first): nothing to do.
    const { data: existing } = await admin
      .from("team_memberships")
      .select("id")
      .eq("user_id", opts.userId)
      .eq("team_id", row.team_id)
      .eq("is_active", true)
      .limit(1)
    if (existing?.length) return { teamId: row.team_id, teamName: row.teams?.name ?? null }
    const { error } = await admin.from("team_memberships").insert({
      user_id: opts.userId,
      team_id: row.team_id,
      role_in_team: teamRoleFor(opts.accountRole),
      transfer_reason: "Joined their recruiter's team on sign-up",
    })
    if (error) {
      console.error("[recruit-team] join failed:", error.message)
      return null
    }
    return { teamId: row.team_id, teamName: row.teams?.name ?? null }
  } catch (e) {
    console.error("[recruit-team] join failed:", e instanceof Error ? e.message : e)
    return null
  }
}
