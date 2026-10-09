import "server-only"

import { createAdminSupabase } from "@/lib/admin-supabase"
import { ROLES_SALE_AGENT_PROFILES } from "@/lib/app-roles"
import {
  AED,
  FHI_CHAT_TOOLS,
  barsChart,
  businessDate,
  fetchAllSales,
  findProjects,
  inRange,
  monthLabel,
  nameMaps,
  newsOverview,
  normScope,
  pctChange,
  periodRange,
  pieChart,
  previousWindow,
  projectDetails,
  saleCredits,
  stat,
  type FhiChatCard,
  type FhiChatChart,
  type FhiChatStat,
  type FindProjectsArgs,
  type SaleRow,
} from "@/lib/fhi-chat-tools"

/**
 * The agent-side FHI Assistant's toolbox (app/api/fhi-chat). Five tools, and
 * the rule that keeps admin data out of reach is structural, not a prompt:
 *
 *  - IDENTITY IS BOUND ON THE SERVER. my_sales and top_sales_board take the
 *    caller from the session; there is no "name" argument, so "show Michelle's
 *    sales" still returns the asker's own record.
 *  - RESULTS ARE TRIMMED BEFORE THE MODEL SEES THEM. project_details drops the
 *    developer's contact people, the project's sales contact and FHI's sales
 *    on it; the leaderboard shows rank + deal count only (the Top Sales board
 *    hides AED values from agents too — see app/api/sales/top-sellers).
 *  - The admin toolbox (lib/fhi-chat-tools.ts) is never handed to this model.
 *
 * Everything here is data the caller already sees in their own dashboard.
 */

type Admin = ReturnType<typeof createAdminSupabase>

export type AgentChatCaller = { userId: string; name: string | null; role: string | null }

const mine = (s: SaleRow, userId: string) => saleCredits(s).find((c) => c.agentId === userId)

// ─── my_sales ────────────────────────────────────────────────────────────────

type MySalesArgs = { from_date?: string; to_date?: string; status?: "validated" | "pending" | "rejected" | "all" }

/**
 * The caller's own sales: totals by status (their share of shared deals),
 * the previous-period comparison when a period was given, a month-by-month
 * picture and the newest deals. Same figures as their Sales Reports page.
 */
async function mySales(admin: Admin, caller: AgentChatCaller, args: MySalesArgs) {
  const from = args.from_date?.trim() || null
  const to = args.to_date?.trim() || null
  const all = (await fetchAllSales(admin)).filter((s) => mine(s, caller.userId))
  const inWindow = all.filter((s) => inRange(s, from, to))
  const statusOf = (s: SaleRow) => s.validation_status ?? "pending"
  const bucket = (rows: SaleRow[], status: string) => {
    const b = rows.filter((s) => statusOf(s) === status)
    const value = b.reduce((a, s) => a + (mine(s, caller.userId)?.value ?? 0), 0)
    return { count: b.length, total: AED(value), raw: value }
  }
  const cur = { validated: bucket(inWindow, "validated"), pending: bucket(inWindow, "pending"), rejected: bucket(inWindow, "rejected") }

  let comparison: Record<string, unknown> = {}
  if (from) {
    const prev = previousWindow(from, to)
    const pv = bucket(all.filter((s) => inRange(s, prev.from, prev.to)), "validated")
    comparison = {
      previous_period: { from: prev.from, to: prev.to, validated: { count: pv.count, total: pv.total } },
      change_vs_previous: { validated_deals: pctChange(cur.validated.count, pv.count), validated_value: pctChange(cur.validated.raw, pv.raw) },
    }
  }

  // Month by month over the window, or the last 12 months.
  const months: string[] = []
  {
    const lastDay = to ? new Date(Date.parse(`${to}T00:00:00Z`) - 86400e3) : new Date()
    const first = from ? new Date(`${from}T00:00:00Z`) : new Date(Date.UTC(lastDay.getUTCFullYear(), lastDay.getUTCMonth() - 11, 1))
    const cursor = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), 1))
    while (cursor <= lastDay && months.length < 36) {
      months.push(cursor.toISOString().slice(0, 7))
      cursor.setUTCMonth(cursor.getUTCMonth() + 1)
    }
  }
  const monthSource = from ? inWindow : all
  const byMonth = months.map((ym) => {
    const rows = monthSource.filter((s) => statusOf(s) === "validated" && businessDate(s).startsWith(ym))
    return { month: ym, validated_deals: rows.length, validated_value: rows.reduce((a, s) => a + (mine(s, caller.userId)?.value ?? 0), 0) }
  })

  const wanted = args.status && args.status !== "all" ? args.status : null
  const list = inWindow
    .filter((s) => !wanted || statusOf(s) === wanted)
    .sort((a, b) => businessDate(b).localeCompare(businessDate(a)))
    .slice(0, 30)
  const names = await nameMaps(admin, list)
  const shared = all.some((s) => saleCredits(s).length > 1)
  const seenProj = new Set<number>()

  return {
    agent: caller.name,
    period: { from: from ?? "beginning", to: to ?? "no upper bound" },
    note: shared
      ? "Totals count your share of shared (partnership) deals; each listed deal shows its full contract price and your share."
      : "Validated sales are the ones that count on the leaderboards; pending ones are waiting for the office to validate.",
    _stats: [
      stat("Validated deals", cur.validated.count, (comparison.change_vs_previous as Record<string, string> | undefined)?.validated_deals, from ? `vs ${(comparison.previous_period as { validated?: { count?: number } } | undefined)?.validated?.count ?? 0} before` : "all time"),
      stat("Validated value", cur.validated.total, (comparison.change_vs_previous as Record<string, string> | undefined)?.validated_value, from ? `vs ${(comparison.previous_period as { validated?: { total?: string } } | undefined)?.validated?.total ?? "AED 0"} before` : "all time"),
      stat("Pending", cur.pending.count, null, cur.pending.count ? cur.pending.total : "nothing waiting"),
      ...(cur.rejected.count ? [stat("Rejected", cur.rejected.count)] : []),
    ],
    validated: { count: cur.validated.count, total: cur.validated.total },
    pending: { count: cur.pending.count, total: cur.pending.total },
    rejected: { count: cur.rejected.count, total: cur.rejected.total },
    ...comparison,
    ...(months.length >= 2 ? { by_month: byMonth.map((m) => ({ month: m.month, validated_deals: m.validated_deals, validated_value: AED(m.validated_value) })) } : {}),
    sales_listed: list.length,
    sales: list.map((s) => {
      const credits = saleCredits(s)
      const me = mine(s, caller.userId)
      return {
        date: businessDate(s),
        project: names.proj.get(s.project_id)?.name ?? "?",
        developer: names.dev.get(String(s.developer_id))?.name ?? "?",
        contract_price: AED(Number(s.contract_price ?? 0)),
        status: statusOf(s),
        ...(credits.length > 1
          ? {
              shared: `your ${me?.share ?? 0}% share (${AED(me?.value ?? 0)}) with ${credits
                .filter((c) => c.agentId !== caller.userId)
                .map((c) => `${names.agent.get(c.agentId)?.name ?? "a partner agent"} ${c.share}%`)
                .join(", ")}`,
            }
          : {}),
      }
    }),
    _charts: [
      ...(months.length >= 2 ? barsChart("Your validated sales by month", byMonth.map((m) => ({ label: monthLabel(m.month), value: m.validated_value, display: m.validated_value ? `${(m.validated_value / 1e6).toFixed(2)}M` : "0" }))) : []),
      ...pieChart("Your sales by status", [
        { name: "validated", count: cur.validated.count },
        { name: "pending", count: cur.pending.count },
        { name: "rejected", count: cur.rejected.count },
      ]),
    ],
    _cards: list
      .filter((s) => {
        if (seenProj.has(s.project_id) || !names.proj.get(s.project_id)?.image) return false
        seenProj.add(s.project_id)
        return true
      })
      .slice(0, 6)
      .map((s): FhiChatCard => ({
        kind: "project",
        title: names.proj.get(s.project_id)?.name ?? "Project",
        subtitle: `${AED(Number(s.contract_price ?? 0))} · ${businessDate(s)} · ${statusOf(s)}`,
        image: names.proj.get(s.project_id)?.image ?? null,
      })),
  }
}

// ─── top_sales_board ─────────────────────────────────────────────────────────

type BoardArgs = { scope?: string; year?: number; month?: number; from_date?: string; to_date?: string; limit?: number }

/**
 * The company Top Sales board as agents see it: rank and deal count per
 * agent, AED values withheld (app/api/sales/top-sellers shows values to admin
 * staff only). The caller gets their own rank, deals and value.
 */
async function topSalesBoard(admin: Admin, caller: AgentChatCaller, args: BoardArgs) {
  const now = new Date()
  const scope = normScope(args.scope)
  let { from, to } = periodRange(scope, args.year ?? now.getUTCFullYear(), args.month ?? now.getUTCMonth() + 1)
  if (args.from_date?.trim()) from = args.from_date.trim()
  if (args.to_date?.trim()) to = args.to_date.trim()
  const sales = (await fetchAllSales(admin)).filter((s) => s.validation_status === "validated" && inRange(s, from, to))
  const byAgent = new Map<string, { deals: number; value: number }>()
  for (const s of sales) {
    for (const c of saleCredits(s)) {
      const t = byAgent.get(c.agentId) ?? { deals: 0, value: 0 }
      t.deals += 1
      t.value += c.value
      byAgent.set(c.agentId, t)
    }
  }
  // Same roster rule as the board: active accounts in a selling role.
  const { data: profiles } = await admin
    .from("profiles")
    .select("id, fullname, profile_url")
    .in("id", [...byAgent.keys()])
    .in("role", [...ROLES_SALE_AGENT_PROFILES])
    .eq("status", "active")
    .not("is_deleted", "is", true)
  const roster = new Map((profiles ?? []).map((p) => [String(p.id), { name: (p.fullname as string | null) ?? "Agent", image: (p.profile_url as string | null) ?? null }]))
  const ranked = [...byAgent.entries()]
    .filter(([id]) => roster.has(id) || id === caller.userId)
    .map(([id, t]) => ({ id, ...t }))
    .sort((a, b) => b.value - a.value || b.deals - a.deals)
  const myIndex = ranked.findIndex((r) => r.id === caller.userId)
  const limit = Math.min(Math.max(args.limit ?? 10, 1), 25)
  const top = ranked.slice(0, limit)
  const me = myIndex >= 0 ? ranked[myIndex] : null
  return {
    period: { scope, from, to },
    note: "Validated sales only, ranked by value; the board shows each agent's rank and number of deals — amounts are shown for your own sales only.",
    agents_on_board: ranked.length,
    you: me
      ? { rank: myIndex + 1, deals: me.deals, value: AED(me.value) }
      : { rank: null, deals: 0, note: "No validated sale of yours in this period, so you are not on the board yet." },
    leaders: top.map((l, i) => ({ rank: i + 1, agent: l.id === caller.userId ? `${roster.get(l.id)?.name ?? caller.name ?? "You"} (you)` : roster.get(l.id)?.name ?? "Agent", deals: l.deals })),
    _stats: [
      stat("Your rank", me ? `#${myIndex + 1}` : "–", null, me ? `of ${ranked.length} on the board` : "no validated sale this period"),
      stat("Your deals", me?.deals ?? 0, null, me ? AED(me.value) : null),
      stat("Agents on the board", ranked.length),
    ],
    _cards: top.slice(0, 8).map((l, i): FhiChatCard => ({
      kind: "agent",
      rank: i + 1,
      title: roster.get(l.id)?.name ?? caller.name ?? "Agent",
      subtitle: `${l.deals} deal${l.deals === 1 ? "" : "s"}`,
      image: roster.get(l.id)?.image ?? null,
    })),
    _charts: barsChart("Deals by agent", top.slice(0, 10).map((l) => ({ label: roster.get(l.id)?.name ?? "Agent", value: l.deals, display: String(l.deals) }))),
  }
}

// ─── project_details, trimmed ────────────────────────────────────────────────

/** The admin tool's answer minus what an agent doesn't get: the developer's
 *  contact people, the project's sales contact and FHI's own sales on it. */
async function projectDetailsForAgent(admin: Admin, args: { name?: string }) {
  const full = (await projectDetails(admin, args)) as Record<string, unknown> & { _stats?: FhiChatStat[] }
  if ("error" in full) return full
  const { sales_contact: _sc, fhi_sales: _fs, developer, _stats, ...rest } = full as typeof full & { developer?: Record<string, unknown> | null }
  void _sc
  void _fs
  const dev = developer ? { name: developer.name, verified: developer.verified, website: developer.website } : null
  return {
    ...rest,
    developer: dev,
    _stats: (_stats ?? []).filter((s) => s.label !== "FHI validated deals"),
  }
}

// ─── Tool definitions handed to the model ────────────────────────────────────

const reuse = (name: string) => {
  const t = FHI_CHAT_TOOLS.find((x) => x.function.name === name)
  if (!t) throw new Error(`Admin tool ${name} not found`)
  return t
}

export const FHI_AGENT_CHAT_TOOLS = [
  {
    type: "function" as const,
    function: {
      name: "my_sales",
      description:
        "YOUR OWN sales record (the person asking — no name needed, it is always theirs): validated, pending and rejected totals, the previous-period comparison when a period is given, month-by-month validated sales and the newest deals with project, developer, contract price and status. Use for 'how are my sales this year', 'anything of mine waiting for validation', 'my sales month by month', 'did I sell anything in May'.",
      parameters: {
        type: "object",
        properties: {
          from_date: { type: "string", description: "YYYY-MM-DD inclusive" },
          to_date: { type: "string", description: "YYYY-MM-DD exclusive" },
          status: { type: "string", enum: ["validated", "pending", "rejected", "all"], description: "Only list deals with this status (totals are always all three)" },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "top_sales_board",
      description:
        "The company Top Sales board for a period — each agent's rank and number of validated deals (amounts are not shown for others) plus YOUR OWN rank, deals and value. Use for 'where do I rank', 'who are the top sellers this month', 'am I in the top 10 this year'.",
      parameters: {
        type: "object",
        properties: {
          scope: { type: "string", enum: ["month", "quarter", "year", "all"], description: "Period shape. Default year." },
          year: { type: "integer" },
          month: { type: "integer", description: "1-12, anchors month/quarter" },
          from_date: { type: "string", description: "YYYY-MM-DD inclusive — overrides scope" },
          to_date: { type: "string", description: "YYYY-MM-DD exclusive" },
          limit: { type: "integer", description: "Default 10, max 25" },
        },
      },
    },
  },
  reuse("find_projects"),
  {
    type: "function" as const,
    function: {
      name: "project_details",
      description:
        "EVERYTHING about ONE project by name: price range, every unit type with bedrooms/size/price, handover and dates, the payment plan (milestones + fees + the text as written), down payment, amenities, what's nearby, highlights, permit number, ownership, ROI/yield and the public page link. Use for 'tell me about Azizi Venice', 'payment plan of Samana Greenfield', 'what units does Rukan Tower have', 'handover of X'.",
      parameters: { type: "object", properties: { name: { type: "string", description: "Project name, partial ok" } }, required: ["name"] },
    },
  },
  reuse("news_overview"),
]

/** Runs one tool for the caller. Same contract as runFhiChatTool: cards,
 *  charts and stats go to the UI, never into the model context. */
export async function runAgentChatTool(
  name: string,
  args: Record<string, unknown>,
  caller: AgentChatCaller,
): Promise<{ forModel: string; cards: FhiChatCard[]; names: string[]; charts: FhiChatChart[]; stats: FhiChatStat[] }> {
  const admin = createAdminSupabase()
  try {
    let result: Record<string, unknown>
    switch (name) {
      case "my_sales": result = await mySales(admin, caller, args as MySalesArgs); break
      case "top_sales_board": result = await topSalesBoard(admin, caller, args as BoardArgs); break
      case "find_projects": result = await findProjects(admin, args as FindProjectsArgs); break
      case "project_details": result = await projectDetailsForAgent(admin, args as { name?: string }); break
      case "news_overview": result = await newsOverview(admin, args as { limit?: number; search?: string; category?: string }); break
      default: return { forModel: JSON.stringify({ error: `Unknown tool ${name}` }), cards: [], names: [], charts: [], stats: [] }
    }
    const { _cards, _names, _charts, _stats, _printCards: _pc, ...rest } = result as {
      _cards?: FhiChatCard[]; _names?: string[]; _charts?: FhiChatChart[]; _stats?: FhiChatStat[]; _printCards?: unknown
    } & Record<string, unknown>
    void _pc
    return {
      forModel: JSON.stringify(rest),
      cards: Array.isArray(_cards) ? _cards : [],
      names: Array.isArray(_names) ? _names : [],
      charts: Array.isArray(_charts) ? _charts : [],
      stats: Array.isArray(_stats) ? _stats : [],
    }
  } catch (e) {
    return { forModel: JSON.stringify({ error: e instanceof Error ? e.message : "Query failed" }), cards: [], names: [], charts: [], stats: [] }
  }
}
