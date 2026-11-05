import { NextRequest, NextResponse } from "next/server"
import { requireRole } from "@/lib/auth-guard"
import { ROLES_TEAM_REPORT_LEADERS } from "@/lib/app-roles"
import { createAdminSupabase } from "@/lib/admin-supabase"
import { reportGET, reportPOST, type ReportActor } from "@/lib/team-report/handler"

/**
 * The Team Performance Report for a team leader or unit manager's OWN team (boss, 2026-11-05: "put it
 * on the team leaders so they can know what they are lacking"). The team is never taken from the
 * request: it is the caller's latest active team membership — the same rule as Team Sales
 * (app/api/team/sales-overview) — so nobody can point this at another team. The team's subteams are
 * included, as everywhere. Agents are refused: the report lists every member's sales.
 *
 * The AI analysis is limited per leader per day and by a monthly budget (lib/team-report/budget.ts);
 * over a limit the report still opens with the standard analysis and says why. The request logic is
 * shared with the admin door (app/api/admin/teams/[id]/report) in lib/team-report/handler.tsx.
 */

export const runtime = "nodejs"
export const maxDuration = 60

type Resolved = { ok: true; teamId: string; actor: ReportActor } | { ok: false; response: NextResponse }

async function resolveOwnTeam(): Promise<Resolved> {
  const guard = await requireRole([...ROLES_TEAM_REPORT_LEADERS])
  if (!guard.ok) return guard
  const { userId, profile } = guard.context
  const { data, error } = await createAdminSupabase()
    .from("team_memberships")
    .select("team_id, teams!inner(id, is_active)")
    .eq("user_id", userId)
    .eq("is_active", true)
    .eq("teams.is_active", true)
    .order("joined_at", { ascending: false })
    .limit(1)
  if (error) return { ok: false, response: NextResponse.json({ error: "Couldn't find your team." }, { status: 500 }) }
  const teamId = (data?.[0] as { team_id?: string } | undefined)?.team_id
  if (!teamId) {
    return { ok: false, response: NextResponse.json({ error: "You are not on a team yet, so there is no team report to show. Ask an admin to add you to your team." }, { status: 404 }) }
  }
  return { ok: true, teamId, actor: { kind: "leader", userId, role: profile.role } }
}

export async function GET(req: NextRequest) {
  const own = await resolveOwnTeam()
  if (!own.ok) return own.response
  return reportGET(req, own.teamId, own.actor)
}

export async function POST(req: NextRequest) {
  const own = await resolveOwnTeam()
  if (!own.ok) return own.response
  return reportPOST(req, own.teamId, own.actor)
}
