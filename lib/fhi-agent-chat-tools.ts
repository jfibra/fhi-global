import "server-only"

import { createAdminSupabase } from "@/lib/admin-supabase"
import { ROLES_SALE_AGENT_PROFILES } from "@/lib/app-roles"
import { SITE_URL } from "@/lib/seo"
import { eventIsPast, eventWhenLabel } from "@/lib/events/dates"
import { computeTeamSales } from "@/lib/team-sales-period"
import { RECOMMEND_LABELS, type RecommendValue } from "@/lib/feedback-service"
import { BUYER_LEAD_COLUMNS, LEAD_GRADES, answerLabel, budgetLabel, leadGrade, sellerAnswerLabel, type BuyerLead, type LeadGrade } from "@/lib/buyer-links"
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
  sharesChart,
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
 * The agent-side FHI Assistant's toolbox (app/api/fhi-chat). Phase 1 (10/9):
 * own sales, the Top Sales board, projects, news. Phase 2 (same day): own
 * leads, listings, website, reviews, recruits, and for team leaders their
 * team (agentChatToolsFor picks the box by role). The rule that keeps admin
 * data out of reach is structural, not a prompt:
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

// ─── Phase 2: leads, listings, website, reviews, recruits ────────────────────

const base = () => SITE_URL.replace(/\/$/, "")
const count = <T,>(rows: T[], key: (r: T) => string | null | undefined, cap = 10) => {
  const m = new Map<string, number>()
  for (const r of rows) m.set(key(r) ?? "Not given", (m.get(key(r) ?? "Not given") ?? 0) + 1)
  return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, cap).map(([name, n]) => ({ name, count: n }))
}
const sinceArgs = (args: { from_date?: string; to_date?: string; days?: number }, defaultDays: number) => {
  let from = args.from_date?.trim() || ""
  if (!from) {
    const d = new Date()
    d.setUTCDate(d.getUTCDate() - Math.min(Math.max(args.days ?? defaultDays, 1), 3650))
    from = d.toISOString().slice(0, 10)
  }
  return { from, to: args.to_date?.trim() || null }
}

type MyLeadsArgs = { from_date?: string; to_date?: string; days?: number; kind?: "buyer" | "seller" | "all"; grade?: string; limit?: number }

/** The briefs that came through the caller's own Buyers Link / Sellers Link —
 *  exactly the list on their Buyers Link page, graded the same way. */
async function myLeads(admin: Admin, caller: AgentChatCaller, args: MyLeadsArgs) {
  const { from, to } = sinceArgs(args, 30)
  const limit = Math.min(Math.max(args.limit ?? 15, 1), 60)
  let q = admin.from("buyer_link_leads").select(BUYER_LEAD_COLUMNS).eq("agent_id", caller.userId).gte("created_at", from).order("created_at", { ascending: false }).limit(1000)
  if (to) q = q.lt("created_at", to)
  const { data, error } = await q
  if (error) throw new Error(error.message)
  let rows = (data ?? []) as BuyerLead[]
  if (args.kind && args.kind !== "all") rows = rows.filter((b) => (b.kind === "seller" ? "seller" : "buyer") === args.kind)
  const gradeOf = (b: BuyerLead): LeadGrade | null => (b.kind === "seller" ? null : leadGrade(b))
  if (args.grade?.trim()) {
    const g = args.grade.trim().toLowerCase()
    rows = rows.filter((b) => (gradeOf(b) ?? "") === g)
  }
  const prof = (b: BuyerLead) => (b.profile ?? {}) as Record<string, string | string[] | undefined>
  const label = (b: BuyerLead, key: string) => {
    const v = prof(b)[key]
    return b.kind === "seller" ? sellerAnswerLabel(key as Parameters<typeof sellerAnswerLabel>[0], v) : answerLabel(key as Parameters<typeof answerLabel>[0], v)
  }
  const buyers = rows.filter((b) => b.kind !== "seller")
  const priority = buyers.filter((b) => gradeOf(b) === "priority").length
  return {
    agent: caller.name,
    period: { from, to: to ?? "today" },
    note: "Briefs that came through your own Buyers Link and Sellers Link. Grades: " + Object.values(LEAD_GRADES).map((g) => `${g.label} = ${g.why}`).join("; "),
    total: rows.length,
    buyers: buyers.length,
    sellers: rows.length - buyers.length,
    by_grade_buyers_only: count(buyers, (b) => LEAD_GRADES[gradeOf(b)!].label),
    by_budget: count(buyers, (b) => budgetLabel(b.budget)),
    by_goal: count(buyers, (b) => label(b, "goal")),
    _stats: [
      stat("Briefs", rows.length, null, `since ${from}`),
      stat("Priority buyers", priority),
      stat("Buyers", buyers.length, null, `${rows.length - buyers.length} seller${rows.length - buyers.length === 1 ? "" : "s"}`),
    ],
    _charts: [
      ...pieChart("Your buyer briefs by grade", count(buyers, (b) => LEAD_GRADES[gradeOf(b)!].label)),
      ...sharesChart("Your buyer briefs by budget", count(buyers, (b) => budgetLabel(b.budget))),
    ],
    leads: rows.slice(0, limit).map((b) => ({
      when: b.created_at.slice(0, 16).replace("T", " "),
      kind: b.kind === "seller" ? "seller" : "buyer",
      grade: gradeOf(b) ? LEAD_GRADES[gradeOf(b)!].label : null,
      name: b.name,
      whatsapp: b.whatsapp ? `${b.whatsapp_code ?? ""} ${b.whatsapp}`.trim() : null,
      email: b.email,
      budget: budgetLabel(b.budget),
      ...(b.kind === "seller"
        ? { property: label(b, "property_type"), completion: label(b, "completion"), sell_timeline: label(b, "sell_timeline") }
        : { goal: label(b, "goal"), timeline: label(b, "buy_timeline"), readiness: label(b, "readiness"), reach_by: label(b, "contact_channel") }),
      message: b.message ? b.message.slice(0, 240) : null,
    })),
    where_in_dashboard: "Agent Resource → Buyers Link",
  }
}

type MyListingsArgs = { kind?: "sale" | "rent"; status?: string; limit?: number }

/** The caller's own listings (Listings page): live, draft, prices, links. */
async function myListings(admin: Admin, caller: AgentChatCaller, args: MyListingsArgs) {
  const limit = Math.min(Math.max(args.limit ?? 20, 1), 100)
  let q = admin
    .from("agent_listings")
    .select("id, project_id, title, listing_kind, price, currency, status, unit_type, slug, is_featured, created_at, updated_at, projects(name, community, city)")
    .eq("agent_id", caller.userId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(500)
  if (args.kind) q = q.eq("listing_kind", args.kind)
  const status = (args.status ?? "all").trim()
  if (status !== "all") q = q.eq("status", status)
  const { data, error } = await q
  if (error) throw new Error(error.message)
  type L = { id: string; title: string | null; listing_kind: string; price: number | string | null; currency: string | null; status: string; unit_type: string | null; slug: string | null; is_featured: boolean | null; created_at: string; updated_at: string | null; projects: { name: string; community: string | null; city: string | null } | { name: string; community: string | null; city: string | null }[] | null }
  const rows = (data ?? []) as unknown as L[]
  const proj = (l: L) => (Array.isArray(l.projects) ? l.projects[0] ?? null : l.projects)
  const price = (l: L) => Number(l.price ?? 0) || null
  return {
    agent: caller.name,
    total: rows.length,
    by_status: count(rows, (l) => l.status),
    by_kind: count(rows, (l) => l.listing_kind),
    _stats: [
      stat("Listings", rows.length),
      stat("Published", rows.filter((l) => l.status === "published").length, null, `${rows.filter((l) => l.status === "draft").length} draft`),
      stat("For sale", rows.filter((l) => l.listing_kind === "sale").length),
      stat("For rent", rows.filter((l) => l.listing_kind === "rent").length),
    ],
    _charts: [...pieChart("Your listings by status", count(rows, (l) => l.status)), ...pieChart("Sale vs rent", count(rows, (l) => l.listing_kind))],
    listings: rows.slice(0, limit).map((l) => ({
      title: l.title,
      kind: l.listing_kind,
      status: l.status,
      price_label: price(l) != null ? `${l.currency ?? "AED"} ${price(l)!.toLocaleString("en-AE")}${l.listing_kind === "rent" ? " / year" : ""}` : "no price",
      unit_type: l.unit_type,
      project: proj(l)?.name ?? null,
      area: [proj(l)?.community, proj(l)?.city].filter(Boolean).join(", ") || null,
      featured: Boolean(l.is_featured),
      url: l.status === "published" ? `${base()}/listings/${l.slug ?? l.id}` : null,
      created: l.created_at.slice(0, 10),
    })),
    where_in_dashboard: "My listings",
  }
}

/** The caller's Website Builder site and the events they run on it. */
async function myWebsite(admin: Admin, caller: AgentChatCaller) {
  const [{ data: site, error }, { data: events }] = await Promise.all([
    admin.from("website_builder").select("title, slug, is_published, created_at, updated_at, show_reviews").eq("agent_id", caller.userId).order("updated_at", { ascending: false }).limit(1).maybeSingle(),
    admin.from("events").select("title, slug, event_date, status, show_on_main, show_on_website").eq("agent_id", caller.userId).is("deleted_at", null).order("event_date", { ascending: false }).limit(20),
  ])
  if (error) throw new Error(error.message)
  if (!site) return { agent: caller.name, has_website: false, note: "No website yet — it can be built under Agent Resource → Website Builder.", _stats: [stat("Website", "none")] }
  const url = site.slug ? `${base()}/website/${site.slug}` : null
  return {
    agent: caller.name,
    has_website: true,
    title: site.title,
    live: Boolean(site.is_published),
    url,
    reviews_shown_on_site: Boolean(site.show_reviews),
    created: site.created_at?.slice(0, 10) ?? null,
    last_updated: site.updated_at?.slice(0, 10) ?? null,
    events: (events ?? []).map((e) => ({ title: e.title, date: e.event_date?.slice(0, 10) ?? null, status: e.status, on_fhiglobal: Boolean(e.show_on_main), on_website: Boolean(e.show_on_website), url: e.slug ? `${base()}/events/${e.slug}` : null })),
    _stats: [stat("Website", site.is_published ? "Live" : "Draft", null, url), stat("Your events", (events ?? []).length), stat("Last updated", site.updated_at?.slice(0, 10) ?? "–")],
    where_in_dashboard: "Agent Resource → Website Builder (My Website shows the link)",
  }
}

type ReviewRow = { id: string; client_name: string | null; property_ref: string | null; transaction_type: string | null; transaction_date: string | null; overall_rating: number | null; score_communication: number | null; score_market: number | null; score_understanding: number | null; score_professionalism: number | null; score_negotiation: number | null; score_process: number | null; score_experience: number | null; recommend: string | null; did_well: string | null; to_improve: string | null; other_comments: string | null; status: string | null; created_at: string }
const SCORE_LABELS: Array<[keyof ReviewRow, string]> = [
  ["score_communication", "Communication"], ["score_market", "Market knowledge"], ["score_understanding", "Understanding needs"],
  ["score_professionalism", "Professionalism"], ["score_negotiation", "Negotiation"], ["score_process", "Process handling"], ["score_experience", "Overall experience"],
]

/** The client reviews written about the caller (Customer Feedback page). */
async function myReviews(admin: Admin, caller: AgentChatCaller, args: { status?: string; limit?: number }) {
  const limit = Math.min(Math.max(args.limit ?? 10, 1), 50)
  let q = admin
    .from("agent_feedback")
    .select("id, client_name, property_ref, transaction_type, transaction_date, overall_rating, score_communication, score_market, score_understanding, score_professionalism, score_negotiation, score_process, score_experience, recommend, did_well, to_improve, other_comments, status, created_at")
    .eq("agent_id", caller.userId)
    .order("created_at", { ascending: false })
    .limit(500)
  const status = (args.status ?? "all").trim()
  if (status !== "all") q = q.eq("status", status)
  const { data, error } = await q
  if (error) throw new Error(error.message)
  const rows = (data ?? []) as ReviewRow[]
  const rated = rows.filter((r) => r.status !== "hidden")
  const avg = (ns: Array<number | null>) => {
    const v = ns.filter((n): n is number => typeof n === "number" && Number.isFinite(n))
    return v.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 100) / 100 : null
  }
  const recommendLabel = (v: string | null) => (v && v in RECOMMEND_LABELS ? RECOMMEND_LABELS[v as RecommendValue] : v ?? "Not answered")
  const wouldRecommend = (r: ReviewRow) => r.recommend === "definitely_yes" || r.recommend === "very_likely" || r.recommend === "likely"
  const average = avg(rated.map((r) => r.overall_rating))
  return {
    agent: caller.name,
    totals: {
      reviews: rows.length,
      approved_shown_on_website: rows.filter((r) => r.status === "approved").length,
      waiting_for_admin_approval: rows.filter((r) => r.status === "new").length,
      average_rating: average,
      would_recommend_percent: rated.length ? Math.round((100 * rated.filter(wouldRecommend).length) / rated.length) : null,
    },
    average_scores_out_of_5: Object.fromEntries(SCORE_LABELS.map(([key, label]) => [label, avg(rated.map((r) => r[key] as number | null))])),
    _stats: [
      stat("Your reviews", rows.length),
      stat("Average rating", average != null ? `${average} / 5` : "–"),
      stat("Would recommend", rated.length ? `${Math.round((100 * rated.filter(wouldRecommend).length) / rated.length)}%` : "–"),
      stat("Waiting for approval", rows.filter((r) => r.status === "new").length),
    ],
    _charts: [
      ...barsChart("Ratings you received", [1, 2, 3, 4, 5].map((star) => ({ label: `${star} ★`, value: rated.filter((r) => r.overall_rating === star).length, display: String(rated.filter((r) => r.overall_rating === star).length) }))),
      ...barsChart("Your average score by area (out of 5)", SCORE_LABELS.map(([key, label]) => ({ label, value: avg(rated.map((r) => r[key] as number | null)) ?? 0, display: String(avg(rated.map((r) => r[key] as number | null)) ?? "–") }))),
    ],
    reviews: rows.slice(0, limit).map((r) => ({
      client: r.client_name,
      rating: r.overall_rating,
      recommend: recommendLabel(r.recommend),
      property: r.property_ref,
      transaction: [r.transaction_type, r.transaction_date].filter(Boolean).join(" · ") || null,
      did_well: r.did_well,
      to_improve: r.to_improve,
      status: r.status,
      submitted: r.created_at.slice(0, 10),
    })),
    where_in_dashboard: "Customer Feedback (admins approve each review; approved ones show on your website)",
  }
}

/** The people who registered through the caller's invite link (Invite page),
 *  with how many validated deals each has — counts only, no amounts. */
async function myRecruits(admin: Admin, caller: AgentChatCaller, args: { from_date?: string; to_date?: string; days?: number; limit?: number }) {
  const limit = Math.min(Math.max(args.limit ?? 30, 1), 100)
  let q = admin
    .from("profiles")
    .select("id, fullname, role, status, joined_at, profile_url")
    .eq("metadata->>invited_by", caller.userId)
    .is("metadata->>developer_invite_id", null)
    .not("is_deleted", "is", true)
    .order("joined_at", { ascending: false })
    .limit(500)
  const from = args.from_date?.trim() || (args.days != null ? sinceArgs(args, 30).from : "")
  if (from) q = q.gte("joined_at", from)
  if (args.to_date?.trim()) q = q.lt("joined_at", args.to_date.trim())
  const { data, error } = await q
  if (error) throw new Error(error.message)
  const rows = (data ?? []) as { id: string; fullname: string | null; role: string | null; status: string | null; joined_at: string | null; profile_url: string | null }[]
  const deals = new Map<string, number>()
  for (const s of await fetchAllSales(admin)) {
    if (s.validation_status !== "validated") continue
    for (const c of saleCredits(s)) deals.set(c.agentId, (deals.get(c.agentId) ?? 0) + 1)
  }
  const enriched = rows.map((r) => ({ ...r, deals: deals.get(r.id) ?? 0 }))
  const selling = enriched.filter((r) => r.deals > 0)
  return {
    agent: caller.name,
    period: { joined_from: from || "all time", joined_to: args.to_date?.trim() || "today" },
    recruits_total: rows.length,
    by_status: count(rows, (r) => r.status),
    by_role: count(rows, (r) => r.role),
    recruits_with_validated_sales: selling.length,
    _stats: [
      stat("Your recruits", rows.length),
      stat("Active", rows.filter((r) => r.status === "active").length, null, `${rows.filter((r) => r.status === "pending").length} waiting for approval`),
      stat("Selling", selling.length, null, `${selling.reduce((a, r) => a + r.deals, 0)} validated deals between them`),
    ],
    _charts: [...pieChart("Your recruits by status", count(rows, (r) => r.status)), ...pieChart("Your recruits by role", count(rows, (r) => r.role))],
    recruits: [...selling.sort((a, b) => b.deals - a.deals), ...enriched.filter((r) => r.deals === 0)].slice(0, limit).map((r) => ({
      name: r.fullname,
      role: r.role,
      status: r.status,
      joined: r.joined_at ? String(r.joined_at).slice(0, 10) : null,
      validated_deals: r.deals,
    })),
    _cards: enriched.slice(0, 8).map((r): FhiChatCard => ({ kind: "agent", title: r.fullname ?? "Member", subtitle: r.deals > 0 ? `${r.deals} validated deal${r.deals === 1 ? "" : "s"}` : [r.role, r.status].filter(Boolean).join(" · "), image: r.profile_url })),
    _names: enriched.map((r) => r.fullname).filter((n): n is string => Boolean(n)),
    where_in_dashboard: "Invite",
  }
}

// ─── my_events ───────────────────────────────────────────────────────────────

type MyEventsArgs = { event_title?: string; from_date?: string; to_date?: string; days?: number; limit?: number; attendees?: number }

/**
 * The events the caller runs (their Events page): registrations — total, new
 * today, new in a period, by day — seats per day against the pax limit,
 * certificates sent and downloaded, page views and QR scans, and the
 * registrants themselves (name, email, WhatsApp, chosen days), newest first.
 */
async function myEvents(admin: Admin, caller: AgentChatCaller, args: MyEventsArgs) {
  const limit = Math.min(Math.max(args.limit ?? 10, 1), 30)
  const attendeesCap = Math.min(Math.max(args.attendees ?? 40, 0), 200)
  let q = admin
    .from("events")
    .select("id, title, slug, event_date, event_days, day_pax, venue, status, show_on_main, show_on_website, registration_open, certificate, view_count, qr_scan_count, created_at, image_url")
    .eq("agent_id", caller.userId)
    .is("deleted_at", null)
    .order("event_date", { ascending: false })
    .limit(100)
  if (args.event_title?.trim()) q = q.ilike("title", `%${args.event_title.trim().replace(/[%_]/g, "")}%`)
  const { data, error } = await q
  if (error) throw new Error(error.message)
  type Ev = { id: string; title: string; slug: string | null; event_date: string | null; event_days: number | null; day_pax: unknown; venue: string | null; status: string | null; show_on_main: boolean | null; show_on_website: boolean | null; registration_open: boolean | null; certificate: unknown; view_count: number | null; qr_scan_count: number | null; created_at: string; image_url: string | null }
  const events = (data ?? []) as Ev[]
  if (!events.length) return { agent: caller.name, events: 0, note: args.event_title ? `None of your events matches "${args.event_title}"` : "You haven't created any events yet — Events in the dashboard creates one (it goes on fhiglobal.ae/events and/or your website).", _stats: [stat("Your events", 0)] }
  const ids = events.map((e) => e.id)
  const [{ data: regs }, { data: downloads }] = await Promise.all([
    admin.from("event_registrations").select("id, event_id, full_name, email, whatsapp, invited_by, days, certificate_sent_at, created_at").in("event_id", ids).order("created_at", { ascending: false }).limit(10000),
    admin.from("event_certificate_downloads").select("event_id, registration_id, email, full_name, ip").in("event_id", ids).limit(10000),
  ])
  type Reg = { id: string; event_id: string; full_name: string | null; email: string | null; whatsapp: string | null; invited_by: string | null; days: number[] | null; certificate_sent_at: string | null; created_at: string }
  const R = (regs ?? []) as Reg[]
  const D = (downloads ?? []) as { event_id: string; registration_id: string | null; email: string | null; full_name: string | null; ip: string | null }[]
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Dubai" })
  const dubaiDay = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: "Asia/Dubai" })
  const win = args.from_date?.trim() || args.days != null ? sinceArgs(args, 7) : null
  const inWin = (r: Reg) => !win || (r.created_at.slice(0, 10) >= win.from && (!win.to || r.created_at.slice(0, 10) < win.to))
  const now = Date.now()
  const list = events.slice(0, limit).map((e) => {
    const r = R.filter((x) => x.event_id === e.id)
    const d = D.filter((x) => x.event_id === e.id)
    const uniqDl = new Set(d.map((x) => x.registration_id ?? x.email?.toLowerCase() ?? x.full_name?.trim().toLowerCase() ?? x.ip ?? "")).size
    const byDay = [...r.reduce((m, x) => m.set(dubaiDay(x.created_at), (m.get(dubaiDay(x.created_at)) ?? 0) + 1), new Map<string, number>()).entries()].sort((a, b) => a[0].localeCompare(b[0]))
    const nDays = Math.max(1, e.event_days ?? 1)
    const pax = Array.isArray(e.day_pax) ? (e.day_pax as Array<number | null>) : []
    const seats = Array.from({ length: nDays }, (_, i) => {
      const day = i + 1
      const taken = r.filter((x) => !x.days || x.days.includes(day)).length
      const cap = typeof pax[i] === "number" ? (pax[i] as number) : null
      return { day, registered: taken, limit: cap, seats_left: cap != null ? Math.max(0, cap - taken) : null }
    })
    const cert = (e.certificate ?? null) as { design?: string; selfService?: string } | null
    return {
      _image: e.image_url,
      event: e.title,
      when: eventWhenLabel(e.event_date, e.event_days, "short"),
      date: e.event_date?.slice(0, 10) ?? null,
      days: nDays,
      venue: e.venue,
      status: e.status,
      past: e.event_date ? eventIsPast(e.event_date, e.event_days, now) : null,
      registration_open: Boolean(e.registration_open),
      shown_on: [e.show_on_main ? "fhiglobal.ae/events" : null, e.show_on_website !== false ? "your website" : null].filter(Boolean),
      page: e.slug ? `${base()}/events/${e.slug}` : null,
      registrations_total: r.length,
      registered_today: r.filter((x) => dubaiDay(x.created_at) === today).length,
      ...(win ? { registered_in_period: r.filter(inWin).length } : {}),
      registrations_by_day: byDay.slice(-14).map(([day, n]) => ({ day, registrations: n })),
      ...(nDays > 1 || seats[0].limit != null ? { seats_per_day: seats } : {}),
      certificates: { design: cert?.design ?? "classic", sent_by_email: r.filter((x) => x.certificate_sent_at).length, downloads: d.length, people_who_downloaded: uniqDl },
      page_views: e.view_count ?? 0,
      qr_scans: e.qr_scan_count ?? 0,
      top_inviters: count(r.filter((x) => x.invited_by?.trim()), (x) => x.invited_by, 5),
      attendees: (win ? r.filter(inWin) : r).slice(0, attendeesCap).map((x) => ({
        name: x.full_name, email: x.email, whatsapp: x.whatsapp || null,
        ...(nDays > 1 ? { days: x.days ? x.days.join(", ") : "every day" } : {}),
        registered: x.created_at.slice(0, 16).replace("T", " "),
        certificate_sent: Boolean(x.certificate_sent_at),
      })),
    }
  })
  const totalRegs = R.length
  const todayRegs = R.filter((x) => dubaiDay(x.created_at) === today).length
  const one = list.length === 1 ? list[0] : null
  return {
    agent: caller.name,
    events: events.length,
    ...(win ? { period: { from: win.from, to: win.to ?? "today" } } : {}),
    totals: { registrations: totalRegs, registered_today: todayRegs, ...(win ? { registered_in_period: R.filter(inWin).length } : {}), page_views: events.reduce((a, e) => a + (e.view_count ?? 0), 0), qr_scans: events.reduce((a, e) => a + (e.qr_scan_count ?? 0), 0) },
    _stats: one
      ? [stat("Registrations", one.registrations_total, null, `${one.registered_today} today`), stat("Page views", one.page_views), stat("QR scans", one.qr_scans), stat("Certificates downloaded", one.certificates.people_who_downloaded, null, `${one.certificates.sent_by_email} sent by email`)]
      : [stat("Your events", events.length), stat("Registrations", totalRegs, null, `${todayRegs} today`), stat("Page views", events.reduce((a, e) => a + (e.view_count ?? 0), 0)), stat("QR scans", events.reduce((a, e) => a + (e.qr_scan_count ?? 0), 0))],
    _charts: [
      ...(one ? barsChart("Registrations by day", one.registrations_by_day.map((d) => ({ label: new Date(`${d.day}T00:00:00Z`).toLocaleDateString("en-AE", { month: "short", day: "numeric", timeZone: "UTC" }), value: d.registrations, display: String(d.registrations) }))) : []),
      ...(!one ? sharesChart("Registrations by event", list.map((e) => ({ name: e.event, count: e.registrations_total }))) : []),
      ...(one && one.seats_per_day ? barsChart("Registered per event day", one.seats_per_day.map((d) => ({ label: `Day ${d.day}`, value: d.registered, display: d.limit != null ? `${d.registered}/${d.limit}` : String(d.registered) }))) : []),
    ],
    _names: list.flatMap((e) => e.attendees.map((a) => a.name)).filter((n): n is string => Boolean(n)),
    _cards: list.slice(0, 6).map((e): FhiChatCard => {
      const seats = e.seats_per_day?.filter((d) => d.seats_left != null)
      const left = seats?.length ? seats.reduce((a, d) => a + (d.seats_left ?? 0), 0) : null
      return {
        kind: "event",
        title: e.event,
        subtitle: [e.when, e.venue].filter(Boolean).join(" · "),
        image: e._image,
        href: e.page,
        facts: [
          `${e.registrations_total} registered`,
          ...(e.registered_today ? [`${e.registered_today} today`] : []),
          ...(left != null ? [`${left} seat${left === 1 ? "" : "s"} left`] : []),
          ...(e.page_views ? [`${e.page_views.toLocaleString("en-AE")} views`] : []),
          ...(e.past ? ["past"] : e.registration_open ? ["registration open"] : ["registration closed"]),
        ],
      }
    }),
    event_list: list.map(({ _image: _i, ...rest }) => { void _i; return rest }),
    where_in_dashboard: "Events (registrations, Change days, certificates)",
  }
}

// ─── Team leaders: my_team ───────────────────────────────────────────────────

type MyTeamArgs = { from_date?: string; to_date?: string; limit?: number }
type TeamSalesOk = Extract<Awaited<ReturnType<typeof computeTeamSales>>, { sellers: unknown[] }>

/**
 * The caller's team as Team Sales shows it: the team they are in (with its
 * subteams at any depth), everyone's validated and pending sales for the
 * period (lib/team-sales-period rules, the same as the admin panel), who
 * hasn't sold, what waits for validation, who joined recently. Team leaders only.
 */
async function myTeam(admin: Admin, caller: AgentChatCaller, args: MyTeamArgs) {
  if (caller.role !== "team_leader") return { error: "Team figures are for team leaders." }
  const year = new Date().getUTCFullYear()
  const from = args.from_date?.trim() || `${year}-01-01`
  const to = args.to_date?.trim() || `${year + 1}-01-01`
  const limit = Math.min(Math.max(args.limit ?? 15, 1), 60)

  const { data: membership } = await admin.from("team_memberships").select("team_id").eq("user_id", caller.userId).eq("is_active", true).order("joined_at", { ascending: false }).limit(1)
  const teamId = membership?.[0]?.team_id as string | undefined
  if (!teamId) return { agent: caller.name, has_team: false, note: "You are not in a team yet. Your recruits are under my_recruits." }

  const result = await computeTeamSales(admin, teamId, from, to)
  if (result.status !== 200 || !("sellers" in result) || !result.sellers) return { error: ("error" in result && result.error) || "Couldn't total the team." }
  const team = result as TeamSalesOk

  // Roster (incl. subteams) for quiet members and new joiners.
  const { data: allTeams } = await admin.from("teams").select("id, name, parent_id").limit(2000)
  const teamIds = new Set<string>([teamId])
  for (let grew = true; grew; ) {
    grew = false
    for (const t of allTeams ?? []) if (t.parent_id && teamIds.has(t.parent_id) && !teamIds.has(t.id)) { teamIds.add(t.id); grew = true }
  }
  type M = { user_id: string; team_id: string; role_in_team: string | null; joined_at: string | null; profiles: { fullname: string | null; role: string | null; profile_url: string | null; is_deleted: boolean | null; joined_at: string | null } | null }
  const members: M[] = []
  for (let page = 0; page < 5; page++) {
    const { data } = await admin.from("team_memberships").select("user_id, team_id, role_in_team, joined_at, profiles!inner(fullname, role, profile_url, is_deleted, joined_at)").in("team_id", [...teamIds]).is("left_at", null).range(page * 1000, page * 1000 + 999)
    members.push(...((data ?? []) as unknown as M[]))
    if (!data || data.length < 1000) break
  }
  const live = members.filter((m) => m.profiles && m.profiles.is_deleted !== true)
  const soldIds = new Set(team.sellers.filter((s) => s.validated_deals > 0).map((s) => s.id))
  const quiet = live.filter((m) => !soldIds.has(m.user_id) && m.user_id !== caller.userId)
  // A new joiner registered in the period AND entered the team in it — a team
  // created in bulk (CMG Properties, 2026-10-02) must not make 350 people "new".
  const inPeriod = (d: string | null | undefined) => Boolean(d && d.slice(0, 10) >= from && d.slice(0, 10) < to)
  const joiners = live.filter((m) => inPeriod(m.joined_at) && inPeriod(m.profiles?.joined_at)).sort((a, b) => (b.profiles?.joined_at ?? "").localeCompare(a.profiles?.joined_at ?? ""))
  const pendingDeals = team.sellers.flatMap((s) => s.deals.filter((d) => d.status === "pending").map((d) => ({ agent: s.name, date: d.date, project: d.project, developer: d.developer, price: AED(d.price), ...(d.shared ? { share: `${d.share}%` } : {}) }))).sort((a, b) => a.date.localeCompare(b.date))
  const change = pctChange(team.totals.validated.value, team.previous.validated.value)
  const subteamName = (m: M) => (m.team_id !== teamId ? (allTeams ?? []).find((t) => t.id === m.team_id)?.name ?? null : null)

  return {
    team: { name: team.team.name, subteams: team.team.subteams, members: live.length },
    period: { from, to },
    note: "Validated sales are the headline (as on the boards); pending ones are waiting for the office. A shared deal credits each member their share; a deal shared inside the team counts once for the team.",
    totals: { validated: { deals: team.totals.validated.deals, value: AED(team.totals.validated.value) }, pending: { deals: team.totals.pending.deals, value: AED(team.totals.pending.value) }, rejected: team.totals.rejected.deals },
    previous_period: { validated: { deals: team.previous.validated.deals, value: AED(team.previous.validated.value) } },
    change_vs_previous: { validated_value: change, validated_deals: pctChange(team.totals.validated.deals, team.previous.validated.deals) },
    members_who_sold: team.members_who_sold,
    quiet_members: { count: quiet.length, note: "No validated sale in the period", names: quiet.slice(0, limit).map((m) => ({ name: m.profiles?.fullname, role: m.profiles?.role, subteam: subteamName(m), joined: m.joined_at?.slice(0, 10) ?? null })) },
    new_joiners: { count: joiners.length, note: "Registered with FHI and joined the team in the period", names: joiners.slice(0, limit).map((m) => ({ name: m.profiles?.fullname, role: m.profiles?.role, joined: m.profiles?.joined_at?.slice(0, 10) ?? null, subteam: subteamName(m) })) },
    waiting_for_validation: { count: pendingDeals.length, oldest_first: pendingDeals.slice(0, limit) },
    by_project: team.by_project.map((p) => ({ project: p.project, deals: p.deals, value: AED(p.value) })),
    members: team.sellers.slice(0, limit).map((s, i) => ({ rank: i + 1, name: s.name, role: s.role, subteam: s.subteam, validated_deals: s.validated_deals, validated_value: AED(s.validated_value), pending_deals: s.pending_deals, pending_value: s.pending_deals ? AED(s.pending_value) : undefined })),
    _stats: [
      stat("Team validated deals", team.totals.validated.deals, pctChange(team.totals.validated.deals, team.previous.validated.deals), `vs ${team.previous.validated.deals} before`),
      stat("Team validated value", AED(team.totals.validated.value), change, `vs ${AED(team.previous.validated.value)} before`),
      stat("Pending", team.totals.pending.deals, null, team.totals.pending.deals ? AED(team.totals.pending.value) : "nothing waiting"),
      stat("Members", live.length, null, `${team.members_who_sold} sold · ${quiet.length} quiet`),
    ],
    _charts: [
      ...barsChart("Team validated sales by month", team.months.map((m) => ({ label: monthLabel(m.month), value: m.value, display: m.value ? `${(m.value / 1e6).toFixed(2)}M` : "0" }))),
      ...sharesChart("Team sales by member", team.sellers.filter((s) => s.validated_value > 0).slice(0, 8).map((s) => ({ name: s.name, count: s.validated_value })), (n) => AED(n)),
      ...sharesChart("Team sales by project", team.by_project.slice(0, 8).map((p) => ({ name: p.project, count: p.value })), (n) => AED(n)),
    ],
    _cards: team.sellers.filter((s) => s.validated_deals > 0).slice(0, 8).map((s, i): FhiChatCard => ({ kind: "agent", rank: i + 1, title: s.name, subtitle: `${s.validated_deals} deal${s.validated_deals === 1 ? "" : "s"} · ${AED(s.validated_value)}`, image: s.profile_url })),
    _names: team.sellers.map((s) => s.name),
    where_in_dashboard: "Team Sales",
  }
}

// ─── Tool definitions handed to the model ────────────────────────────────────

const reuse = (name: string) => {
  const t = FHI_CHAT_TOOLS.find((x) => x.function.name === name)
  if (!t) throw new Error(`Admin tool ${name} not found`)
  return t
}

const PHASE1_TOOLS = [
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

const PHASE2_TOOLS = [
  {
    type: "function" as const,
    function: {
      name: "my_leads",
      description: "YOUR OWN LEADS: the buyer and seller briefs that came through your Buyers Link / Sellers Link — graded Priority / Qualified / Nurture / Information, with name, WhatsApp, email, budget, goal, timeline and readiness. Default: last 30 days. Use for 'my leads', 'any priority buyers', 'who sent me a brief this week', 'seller leads'.",
      parameters: { type: "object", properties: { from_date: { type: "string", description: "YYYY-MM-DD inclusive" }, to_date: { type: "string", description: "YYYY-MM-DD exclusive" }, days: { type: "integer", description: "Last N days when from_date is omitted (default 30)" }, kind: { type: "string", enum: ["buyer", "seller", "all"] }, grade: { type: "string", enum: ["priority", "qualified", "nurture", "information"] }, limit: { type: "integer", description: "Default 15, max 60" } } },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "my_listings",
      description: "YOUR OWN LISTINGS (units you listed for sale or rent): live vs draft, prices, unit types, projects, links. Use for 'my listings', 'which of my listings are live', 'my rentals'.",
      parameters: { type: "object", properties: { kind: { type: "string", enum: ["sale", "rent"] }, status: { type: "string", description: "published | draft | all (default all)" }, limit: { type: "integer" } } },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "my_website",
      description: "YOUR OWN agent WEBSITE (Website Builder): whether it is live, its address, when it was last updated, whether reviews show on it, and the events you run on it. Use for 'my website', 'is my site live', 'my website link', 'my events'.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "my_reviews",
      description: "CLIENT REVIEWS written about YOU: how many, average rating, scores by area, would-recommend %, which wait for admin approval, and each review's did_well / to_improve. Use for 'my reviews', 'my rating', 'what do clients say about me'.",
      parameters: { type: "object", properties: { status: { type: "string", description: "approved | new | hidden | all (default all)" }, limit: { type: "integer" } } },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "my_recruits",
      description: "YOUR OWN RECRUITS: the people who registered through your invite link — role, status (active / waiting for approval), when they joined, and how many validated deals each has (counts, not amounts). Optionally only those who joined in a period. Use for 'my recruits', 'who joined under me this month', 'are my recruits selling'.",
      parameters: { type: "object", properties: { from_date: { type: "string", description: "YYYY-MM-DD inclusive — joined from" }, to_date: { type: "string", description: "YYYY-MM-DD exclusive" }, days: { type: "integer" }, limit: { type: "integer" } } },
    },
  },
]

const EVENTS_TOOL = {
  type: "function" as const,
  function: {
    name: "my_events",
    description: "YOUR OWN EVENTS (the ones you created): registrations — total, how many registered TODAY or in a period, by day — seats per day against your pax limit, certificates sent and downloaded, page views, QR scans, who invited the most, and the registrants themselves (name, email, WhatsApp, chosen days). Use for 'how many registered for my event', 'any new registrations today', 'who registered this week', 'seats left on day 2', 'how many downloaded their certificate'. Name the event for one event; omit for all of yours.",
    parameters: { type: "object", properties: { event_title: { type: "string", description: "Part of the event title (omit = all your events)" }, from_date: { type: "string", description: "YYYY-MM-DD — registrations from this day" }, to_date: { type: "string", description: "YYYY-MM-DD exclusive" }, days: { type: "integer", description: "Registrations in the last N days" }, limit: { type: "integer", description: "Events listed, default 10" }, attendees: { type: "integer", description: "Registrants listed per event, default 40, max 200" } } },
  },
}

const TEAM_LEADER_TOOLS = [
  {
    type: "function" as const,
    function: {
      name: "my_team",
      description: "YOUR TEAM (team leaders): the team you lead or belong to, subteams included — validated and pending sales for the period (default this year) with the previous-period comparison, each member's deals and value, who hasn't sold (quiet members), deals waiting for validation oldest-first, who joined in the period, and sales by project and by month. Use for 'how is my team doing', 'team sales this month', 'who in my team hasn't sold', 'anything of my team waiting for validation', 'who joined my team recently'.",
      parameters: { type: "object", properties: { from_date: { type: "string", description: "YYYY-MM-DD inclusive (default Jan 1 this year)" }, to_date: { type: "string", description: "YYYY-MM-DD exclusive (default Jan 1 next year)" }, limit: { type: "integer", description: "Names per list, default 15" } } },
    },
  },
]

/** The toolbox for a caller — team leaders get my_team on top; everyone else never sees it. */
export function agentChatToolsFor(role: string | null) {
  return role === "team_leader" ? [...PHASE1_TOOLS, ...PHASE2_TOOLS, EVENTS_TOOL, ...TEAM_LEADER_TOOLS] : [...PHASE1_TOOLS, ...PHASE2_TOOLS, EVENTS_TOOL]
}

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
      case "my_leads": result = await myLeads(admin, caller, args as MyLeadsArgs); break
      case "my_listings": result = await myListings(admin, caller, args as MyListingsArgs); break
      case "my_website": result = await myWebsite(admin, caller); break
      case "my_reviews": result = await myReviews(admin, caller, args as { status?: string; limit?: number }); break
      case "my_recruits": result = await myRecruits(admin, caller, args as Parameters<typeof myRecruits>[2]); break
      case "my_events": result = await myEvents(admin, caller, args as MyEventsArgs); break
      case "my_team": result = await myTeam(admin, caller, args as MyTeamArgs); break
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
