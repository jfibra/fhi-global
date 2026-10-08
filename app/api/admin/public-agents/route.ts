import { NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import { requireRole } from "@/lib/auth-guard"
import { ROLES_ADMIN_STAFF, ROLES_PUBLIC_AGENTS } from "@/lib/app-roles"
import { createAdminSupabase } from "@/lib/admin-supabase"
import { titleCaseName } from "@/lib/public-profile"
import { fetchAllSales, saleCredits } from "@/lib/fhi-chat-tools"

/** One agent as Accounts & Invites → Public Agents lists them. */
export type PublicAgentRow = {
  id: string
  /** "" when the profile has no name — the public page skips unnamed cards. */
  name: string
  photo: string | null
  leader: boolean
  /** On /agents and among the About page's faces (profiles.show_on_agents_page). */
  shown: boolean
  /** Their published Website Builder slug, if any. */
  website: string | null
  /** Validated sales credited to them — a shared sale counts for each agent on it (saleCredits); null if sales couldn't be read. */
  sales: number | null
  joinedAt: string | null
}

const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null)
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Every active agent and team leader with whether the public site shows them —
 * the same people /agents can list. Admin staff only.
 */
export async function GET() {
  const guard = await requireRole([...ROLES_ADMIN_STAFF])
  if (!guard.ok) return guard.response

  const admin = createAdminSupabase()
  const [profiles, sites, allSales] = await Promise.all([
    admin
      .from("profiles")
      .select("id, fullname, fname, lname, role, profile_url, joined_at, show_on_agents_page")
      .in("role", [...ROLES_PUBLIC_AGENTS])
      .eq("status", "active")
      .not("is_deleted", "is", true)
      .order("fullname", { ascending: true }),
    admin.from("website_builder").select("agent_id, slug").eq("is_published", true).not("slug", "is", null),
    fetchAllSales(admin).catch(() => null),
  ])
  if (profiles.error) return NextResponse.json({ error: "Couldn't load the agents." }, { status: 500 })

  const siteOf = new Map((sites.data ?? []).map((s) => [String(s.agent_id), String(s.slug)]))
  // Same count as the leaderboards: validated sales only.
  const salesOf = new Map<string, number>()
  for (const sale of allSales ?? []) {
    if (sale.validation_status !== "validated") continue
    for (const c of saleCredits(sale)) salesOf.set(c.agentId, (salesOf.get(c.agentId) ?? 0) + 1)
  }
  const agents: PublicAgentRow[] = ((profiles.data ?? []) as Record<string, unknown>[]).map((p) => ({
    id: String(p.id),
    name: titleCaseName(str(p.fullname) ?? [p.fname, p.lname].filter((v) => typeof v === "string" && v).join(" ")),
    photo: str(p.profile_url),
    leader: p.role === "team_leader",
    shown: p.show_on_agents_page === true,
    website: siteOf.get(String(p.id)) ?? null,
    sales: allSales ? (salesOf.get(String(p.id)) ?? 0) : null,
    joinedAt: str(p.joined_at),
  }))

  return NextResponse.json({ agents }, { headers: { "Cache-Control": "no-store" } })
}

/**
 * Show or hide agents on the public site: { ids: string[], show: boolean }.
 * Only agents and team leaders change; the public pages refresh right away
 * instead of waiting out their cache.
 */
export async function PATCH(request: Request) {
  const guard = await requireRole([...ROLES_ADMIN_STAFF])
  if (!guard.ok) return guard.response

  const body = (await request.json().catch(() => null)) as { ids?: unknown; show?: unknown } | null
  const ids = Array.isArray(body?.ids) ? body.ids.filter((v): v is string => typeof v === "string" && UUID.test(v)) : []
  if (!ids.length || ids.length > 500 || typeof body?.show !== "boolean") {
    return NextResponse.json({ error: "Send ids (1–500) and show (true or false)." }, { status: 400 })
  }

  const admin = createAdminSupabase()
  const { data, error } = await admin
    .from("profiles")
    .update({ show_on_agents_page: body.show })
    .in("id", ids)
    .in("role", [...ROLES_PUBLIC_AGENTS])
    .select("id")
  if (error) return NextResponse.json({ error: "Couldn't save the change." }, { status: 500 })

  revalidatePath("/agents")
  revalidatePath("/about")
  return NextResponse.json({ updated: (data ?? []).map((r) => String(r.id)), show: body.show })
}
