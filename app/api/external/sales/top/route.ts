import { NextRequest, NextResponse } from "next/server"
import { createAdminSupabase } from "@/lib/admin-supabase"
import { ISO_DAY, UUID_RE, requireExternalKey } from "@/lib/external-api"
import { TOP_BY, rankSales, type TopBy } from "@/lib/sales-top"

/**
 * GET /api/external/sales/top — the leaderboards, as the dashboards show them
 * (lib/sales-top.ts: validated sales, shared deals by share, teams with their
 * subteams). Keyed. Read-only.
 *
 *   ?by=agents|developers|projects|teams   default agents
 *   ?from=YYYY-MM-DD&to=YYYY-MM-DD         inclusive, by business date; omit both for all time
 *   ?developer=<id or slug>                 narrow the agents / projects boards to one developer
 *   ?project=<id or slug>                   narrow the agents board to one project
 *   ?limit=10                               up to 100
 *
 * → { success, by, period, data: row[], subteams?: row[], meta: { sales_counted, rules } }
 */

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  const denied = requireExternalKey(req)
  if (denied) return denied

  const q = req.nextUrl.searchParams
  const admin = createAdminSupabase()
  const by = (q.get("by") ?? "agents").toLowerCase() as TopBy
  if (!TOP_BY.includes(by)) return NextResponse.json({ error: `by must be one of ${TOP_BY.join(", ")}.` }, { status: 400 })
  const from = q.get("from") ?? ""
  const to = q.get("to") ?? ""
  if ((from && !ISO_DAY.test(from)) || (to && !ISO_DAY.test(to))) return NextResponse.json({ error: "from and to must be YYYY-MM-DD." }, { status: 400 })
  const limit = Math.min(100, Math.max(1, Math.floor(Number(q.get("limit")) || 10)))

  let developerId: string | null = null
  const developer = (q.get("developer") ?? "").trim()
  if (developer) {
    if (UUID_RE.test(developer)) developerId = developer
    else {
      const { data } = await admin.from("developers").select("id").eq("slug", developer).maybeSingle()
      developerId = (data?.id as string | undefined) ?? "none"
    }
  }
  let projectId: number | null = null
  const project = (q.get("project") ?? "").trim()
  if (project) {
    if (/^\d+$/.test(project)) projectId = Number(project)
    else {
      const { data } = await admin.from("projects").select("id").eq("slug", project).maybeSingle()
      projectId = (data?.id as number | undefined) ?? -1
    }
  }

  try {
    const result = await rankSales(admin, { by, from: from || null, to: to || null, developerId, projectId, limit })
    return NextResponse.json(
      {
        success: true,
        by,
        period: { from: from || null, to: to || null },
        data: result.rows.map((r) => ({ ...r, currency: "AED" })),
        ...(result.subteams ? { subteams: result.subteams.map((s) => ({ ...s, currency: "AED" })) } : {}),
        meta: {
          sales_counted: result.sales_counted,
          filters: { developer: developerId, project: projectId },
          rules:
            by === "agents"
              ? "Validated sales only; a shared deal credits each agent their share of the price."
              : by === "teams"
                ? "Validated sales only; a team is its members plus its subteams; each team is credited its members' shares and a deal shared inside one team counts once; subteams are listed apart and are already inside their parent's figure."
                : "Validated sales only; every sale counts once, in full.",
        },
      },
      { headers: { "cache-control": "no-store" } },
    )
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Couldn't build the board." }, { status: 500 })
  }
}
