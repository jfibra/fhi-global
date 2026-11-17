import { NextRequest, NextResponse } from "next/server"
import { createAdminSupabase } from "@/lib/admin-supabase"
import { EMAIL_RE, ISO_DAY, UUID_RE, requireExternalKey } from "@/lib/external-api"
import { businessDate, fetchAllSales, inRange, pctChange, previousWindow, saleCredits, type SaleRow } from "@/lib/fhi-chat-tools"

/**
 * GET /api/external/sales/summary — the period figures the boss's reports and
 * FHI Assistant's sales_summary give: validated and pending deals and value,
 * the equal-length period before and the change, and the month-by-month (or
 * quarter / year) picture. Keyed. Read-only.
 *
 *   ?from=YYYY-MM-DD&to=YYYY-MM-DD   inclusive, by business date; omit both for all time
 *   ?group=month|quarter|year        the breakdown (default month)
 *   ?developer=<id or slug>  ?project=<id or slug>   narrow to one developer / project
 *   ?agent=<id or email>             one agent's figures — then values are THEIR SHARE of each deal
 *
 * Company-level figures count every sale once, in full (shared or not).
 */

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const DAY_MS = 86400e3
const shiftDay = (iso: string, days: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10)
const GROUPS = ["month", "quarter", "year"] as const
type Group = (typeof GROUPS)[number]

const bucketKey = (day: string, group: Group) => {
  if (group === "year") return day.slice(0, 4)
  if (group === "quarter") return `${day.slice(0, 4)}-Q${Math.floor((Number(day.slice(5, 7)) - 1) / 3) + 1}`
  return day.slice(0, 7)
}

export async function GET(req: NextRequest) {
  const denied = requireExternalKey(req)
  if (denied) return denied

  const q = req.nextUrl.searchParams
  const admin = createAdminSupabase()
  const from = q.get("from") ?? ""
  const to = q.get("to") ?? ""
  if ((from && !ISO_DAY.test(from)) || (to && !ISO_DAY.test(to))) return NextResponse.json({ error: "from and to must be YYYY-MM-DD." }, { status: 400 })
  const group = ((q.get("group") ?? "month").toLowerCase() as Group)
  if (!GROUPS.includes(group)) return NextResponse.json({ error: "group must be month, quarter or year." }, { status: 400 })

  // Narrowing.
  let developerId: string | null = null
  const developer = (q.get("developer") ?? "").trim()
  if (developer) {
    if (UUID_RE.test(developer)) developerId = developer
    else developerId = ((await admin.from("developers").select("id").eq("slug", developer).maybeSingle()).data?.id as string | undefined) ?? "none"
  }
  let projectId: number | null = null
  const project = (q.get("project") ?? "").trim()
  if (project) {
    if (/^\d+$/.test(project)) projectId = Number(project)
    else projectId = ((await admin.from("projects").select("id").eq("slug", project).maybeSingle()).data?.id as number | undefined) ?? -1
  }
  let agentId: string | null = null
  const agent = (q.get("agent") ?? "").trim()
  if (agent) {
    if (UUID_RE.test(agent)) agentId = agent
    else if (EMAIL_RE.test(agent)) {
      for (let p = 1; p <= 25 && !agentId; p++) {
        const { data, error } = await admin.auth.admin.listUsers({ page: p, perPage: 200 })
        if (error) return NextResponse.json({ error: "Couldn't look the agent up." }, { status: 500 })
        agentId = data.users.find((u) => u.email?.toLowerCase() === agent.toLowerCase())?.id ?? null
        if (data.users.length < 200) break
      }
      agentId = agentId ?? "none"
    } else return NextResponse.json({ error: "agent must be a profile id or an email." }, { status: 400 })
  }

  let all = await fetchAllSales(admin)
  if (developerId) all = all.filter((s) => s.developer_id === developerId)
  if (projectId !== null) all = all.filter((s) => Number(s.project_id) === projectId)
  if (agentId) all = all.filter((s) => saleCredits(s).some((c) => c.agentId === agentId))
  // A company figure counts the whole sale; an agent's figure counts their share.
  const valueOf = (s: SaleRow) => (agentId ? saleCredits(s).find((c) => c.agentId === agentId)?.value ?? 0 : Number(s.contract_price ?? 0))
  const statusOf = (s: SaleRow) => (s.validation_status ?? "pending").toLowerCase()

  const toExclusive = to ? shiftDay(to, 1) : null
  const sales = all.filter((s) => inRange(s, from || null, toExclusive))
  const bucket = (rows: SaleRow[], status: string) => {
    const b = rows.filter((s) => statusOf(s) === status)
    return { deals: b.length, value: Math.round(b.reduce((a, s) => a + valueOf(s), 0)) }
  }
  const statuses = new Map<string, number>()
  for (const s of sales) statuses.set(statusOf(s), (statuses.get(statusOf(s)) ?? 0) + 1)
  const validated = bucket(sales, "validated")
  const pending = bucket(sales, "pending")

  let previous: Record<string, unknown> | null = null
  if (from) {
    const prev = previousWindow(from, toExclusive)
    const prevSales = all.filter((s) => inRange(s, prev.from, prev.to))
    const pv = bucket(prevSales, "validated")
    previous = {
      from: prev.from,
      to: shiftDay(prev.to, -1),
      validated: pv,
      pending: bucket(prevSales, "pending"),
      change: { validated_deals: pctChange(validated.deals, pv.deals), validated_value: pctChange(validated.value, pv.value) },
    }
  }

  // The breakdown over the span, or the last 12 months when no span was given.
  const source = from || to ? sales : all.filter((s) => businessDate(s) >= shiftDay(new Date().toISOString().slice(0, 10), -365))
  const byPeriod = new Map<string, { validated_deals: number; validated_value: number; pending_deals: number; pending_value: number }>()
  for (const s of source) {
    const k = bucketKey(businessDate(s), group)
    const b = byPeriod.get(k) ?? { validated_deals: 0, validated_value: 0, pending_deals: 0, pending_value: 0 }
    const st = statusOf(s)
    if (st === "validated") { b.validated_deals++; b.validated_value += valueOf(s) }
    else if (st === "pending") { b.pending_deals++; b.pending_value += valueOf(s) }
    byPeriod.set(k, b)
  }
  const breakdown = [...byPeriod.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([period, b]) => ({ period, ...b, validated_value: Math.round(b.validated_value), pending_value: Math.round(b.pending_value) }))

  return NextResponse.json(
    {
      success: true,
      period: { from: from || null, to: to || null },
      currency: "AED",
      validated,
      pending,
      other_statuses: Object.fromEntries([...statuses.entries()].filter(([k]) => k !== "validated" && k !== "pending")),
      all_statuses_count: sales.length,
      previous_period: previous,
      breakdown: { group, rows: breakdown },
      meta: {
        filters: { developer: developerId, project: projectId, agent: agentId },
        rules: agentId
          ? "This agent's figures: validated by default, each deal counted at their share of the contract price; a sale's date is its reservation date, else the day it was recorded."
          : "Company figures: every sale counts once, in full; validated is the headline, pending beside it; a sale's date is its reservation date, else the day it was recorded. previous_period is the equal-length span just before.",
      },
    },
    { headers: { "cache-control": "no-store" } },
  )
}
