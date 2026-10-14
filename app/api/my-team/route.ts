import { NextResponse } from "next/server"
import { requireActiveSession } from "@/lib/auth-guard"
import { invitableRolesFor } from "@/lib/app-roles"
import { createAdminSupabase } from "@/lib/admin-supabase"
import { buildMyTeam } from "@/lib/my-team"

export type { MyTeamResponse, TeamMember, TeamSale } from "@/lib/my-team"

/**
 * My Team (boss via Juliecor, 2026-10-14) — strictly session-scoped: the root
 * is always the signed-in account. See lib/my-team.ts.
 */
export async function GET() {
  const session = await requireActiveSession()
  if (!session.ok) return session.response
  const { userId, profile } = session.context
  if (invitableRolesFor(profile.role).length === 0) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  try {
    const team = await buildMyTeam(createAdminSupabase(), userId, { name: profile.fullname, photo: profile.profile_url, role: profile.role })
    return NextResponse.json(team, { headers: { "Cache-Control": "no-store" } })
  } catch {
    return NextResponse.json({ error: "Couldn't load your team." }, { status: 500 })
  }
}
