import { NextRequest, NextResponse } from "next/server"
import { requireActiveSession } from "@/lib/auth-guard"
import { canManageDeveloperContent, canManageEvents } from "@/lib/app-roles"
import { createAdminSupabase } from "@/lib/admin-supabase"

// Self-scoped activity for content editors: audit_logs rows where the caller is
// the actor. audit_logs RLS only allows admin SELECT, so this runs on the
// service-role client — every query filters actor_id = the session user, which
// keeps the route safe to expose to non-admin roles.

export const runtime = "nodejs"

const CATEGORIES = ["developers", "projects", "events"] as const

type MonthStats = { created: number; updated: number; deleted: number; total: number }


export async function GET(req: NextRequest) {
  const session = await requireActiveSession()
  if (!session.ok) return session.response
  const role = session.context.profile.role
  if (!canManageDeveloperContent(role) && !canManageEvents(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const userId = session.context.userId
  const rawLimit = Number(req.nextUrl.searchParams.get("limit") ?? 15)
  const limit = Math.min(50, Math.max(1, Number.isFinite(rawLimit) ? Math.floor(rawLimit) : 15))

  const now = new Date()
  const monthStartISO = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString()

  const admin = createAdminSupabase()
  const [feedRes, monthRes, allTimeRes] = await Promise.all([
    admin
      .from("audit_logs")
      .select("id, occurred_at, category, event, subject_type, subject_id, subject_label, description")
      .eq("actor_id", userId)
      .in("category", [...CATEGORIES])
      .order("occurred_at", { ascending: false })
      .limit(limit),
    admin
      .from("audit_logs")
      .select("category, event")
      .eq("actor_id", userId)
      .in("category", [...CATEGORIES])
      .gte("occurred_at", monthStartISO),
    admin
      .from("audit_logs")
      .select("id", { count: "exact", head: true })
      .eq("actor_id", userId)
      .in("category", [...CATEGORIES]),
  ])

  if (feedRes.error || monthRes.error || allTimeRes.error) {
    return NextResponse.json({ error: "Failed to load activity" }, { status: 500 })
  }

  const month: MonthStats = { created: 0, updated: 0, deleted: 0, total: 0 }
  const byCategory: Record<string, number> = { developers: 0, projects: 0, events: 0 }
  for (const row of monthRes.data ?? []) {
    month.total += 1
    if (row.event === "created") month.created += 1
    // Restores put content back, so they count with edits rather than vanishing.
    else if (row.event === "updated" || row.event === "restored") month.updated += 1
    else if (row.event === "deleted") month.deleted += 1
    if (row.category in byCategory) byCategory[row.category] += 1
  }

  const feed = (feedRes.data ?? []).map((row) => ({
    id: row.id as string,
    occurredAt: row.occurred_at as string,
    category: row.category as string,
    event: row.event as string,
    subjectType: (row.subject_type as string | null) ?? null,
    subjectId: (row.subject_id as string | null) ?? null,
    subjectLabel: (row.subject_label as string | null) ?? null,
    description: (row.description as string | null) ?? null,
  }))

  return NextResponse.json({
    stats: { month, byCategory, allTimeTotal: allTimeRes.count ?? 0 },
    feed,
  })
}
