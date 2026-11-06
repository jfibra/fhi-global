import { NextResponse } from "next/server"
import { requireActiveSession } from "@/lib/auth-guard"
import { createAdminSupabase } from "@/lib/admin-supabase"
import { normalizeAppRole } from "@/lib/app-roles"
import { titleCaseName } from "@/lib/public-profile"
import { leaderScope } from "@/lib/team-sales-review"
import type { SaleType, TeamSalesAccess } from "@/lib/sales-rules"

/**
 * What the signed-in team leader may do with their team's sales (migration
 * 084): whether they lead a team, what its switches allow, and the members
 * those switches cover — subteams included, the leader too — with names, for
 * the Sales Report's "My team" view and its member filter.
 *
 * Always the CALLER's own teams; nothing in the request can point it at
 * another. Anyone who isn't a team leader gets { leads: false }. Every member
 * is listed whatever the switches — a leader always has the team view; each
 * member's canEdit / canConfirm only decides which buttons their rows get.
 */

export const runtime = "nodejs"

const NONE: TeamSalesAccess = {
  leads: false,
  teamNames: [],
  canEdit: false,
  canConfirm: false,
  members: [],
  waitingToConfirm: { project: 0, brokerage: 0, rental: 0 },
}
const ID_CHUNK = 100 // keeps each .in() URL well under the gateway's limit

const chunked = (ids: string[]) => {
  const out: string[][] = []
  for (let i = 0; i < ids.length; i += ID_CHUNK) out.push(ids.slice(i, i + ID_CHUNK))
  return out
}

export async function GET() {
  const session = await requireActiveSession()
  if (!session.ok) return session.response
  const { userId, profile } = session.context
  if (normalizeAppRole(profile.role) !== "team_leader") {
    return NextResponse.json(NONE, { headers: { "Cache-Control": "private, no-store" } })
  }

  const admin = createAdminSupabase()
  try {
    const scope = await leaderScope(admin, userId)

    const names = new Map<string, string>()
    const results = await Promise.all(
      chunked(scope.map((m) => m.memberId)).map((chunk) => admin.from("profiles").select("id, fullname, fname, lname").in("id", chunk)),
    )
    for (const res of results) {
      if (res.error) throw new Error(res.error.message)
      for (const p of res.data ?? []) {
        const name =
          titleCaseName(String(p.fullname ?? "").replace(/\s+/g, " ").trim()) ||
          [p.fname, p.lname].filter(Boolean).join(" ").trim()
        names.set(String(p.id), name || "Unnamed account")
      }
    }

    // Sales the leader can still confirm: a member's (never their own) that the
    // admin hasn't decided on yet, with no confirmation so far.
    const waitingToConfirm = { ...NONE.waitingToConfirm }
    const confirmIds = scope.filter((m) => m.canConfirm && m.memberId !== userId).map((m) => m.memberId)
    const waiting = await Promise.all(
      chunked(confirmIds).map((chunk) =>
        admin
          .from("sales_reports")
          .select("sale_type")
          .in("agent_id", chunk)
          .in("validation_status", ["pending", "under_review"])
          .is("leader_confirmed_at", null),
      ),
    )
    for (const res of waiting) {
      if (res.error) throw new Error(res.error.message)
      for (const row of res.data ?? []) {
        const type = String(row.sale_type)
        const t: SaleType = type === "brokerage" || type === "rental" ? type : "project"
        waitingToConfirm[t] += 1
      }
    }

    const body: TeamSalesAccess = {
      leads: scope.length > 0,
      teamNames: [...new Set(scope.map((m) => m.teamName).filter(Boolean))],
      canEdit: scope.some((m) => m.canEdit),
      canConfirm: scope.some((m) => m.canConfirm),
      members: scope
        .map((m) => ({ id: m.memberId, name: names.get(m.memberId) ?? "Unnamed account", canEdit: m.canEdit, canConfirm: m.canConfirm }))
        .sort((a, b) => a.name.localeCompare(b.name)),
      waitingToConfirm,
    }
    return NextResponse.json(body, { headers: { "Cache-Control": "private, no-store" } })
  } catch (e) {
    console.error("[team/sales-access]", e instanceof Error ? e.message : e)
    return NextResponse.json({ error: "Couldn't load your team." }, { status: 500 })
  }
}
