import "server-only"

import { createAdminSupabase } from "@/lib/admin-supabase"
import { BUYER_LEAD_COLUMNS, leadGrade, type BuyerLead } from "@/lib/buyer-links"
import { fetchAllSales, inRange, saleCredits, type SaleRow } from "@/lib/fhi-chat-tools"
import { ownTestBrief, topSalesBoard, type AgentChatCaller } from "@/lib/fhi-agent-chat-tools"

/**
 * "Today at a glance" — the tiles on FHI Assistant's welcome screen (boss via
 * Juliecor, 2026-10-20). What needs attention this morning without typing a
 * question: counts read straight from the database (no model, no tokens),
 * each tile carrying the question that opens it in the chat. Every tile is
 * computed on its own; one failing never hides the others.
 */

type Admin = ReturnType<typeof createAdminSupabase>

export type BriefingItem = {
  key: string
  label: string
  value: string
  note: string | null
  /** attention = something to act on; good = all clear; quiet = information. */
  tone: "attention" | "good" | "quiet"
  /** The question the tile asks when tapped; null = information only. */
  ask: string | null
}

const dubaiToday = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Dubai" })
const addDays = (iso: string, n: number) => {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}
/** Midnight in Dubai, as an instant timestamp columns can be compared with. */
const dubaiMidnight = (iso: string) => `${iso}T00:00:00+04:00`
const weekStart = (today: string) => addDays(today, -((new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7))

const aedShort = (n: number) => (n >= 1e6 ? `AED ${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `AED ${Math.round(n / 1e3)}K` : `AED ${Math.round(n)}`)
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`
const isPending = (s: SaleRow) => (s.validation_status ?? "pending") === "pending"
const firstName = (p: { fname?: string | null; fullname?: string | null }) => ((p.fname ?? p.fullname ?? "").trim().split(/\s+/)[0] ?? "").trim()

async function settle(jobs: Array<Promise<BriefingItem | null>>): Promise<BriefingItem[]> {
  const out = await Promise.allSettled(jobs)
  return out.flatMap((r) => (r.status === "fulfilled" && r.value ? [r.value] : []))
}

type Person = { id: string; fname: string | null; fullname: string | null; birthday: string | null; joined_at: string | null; status: string | null; is_deleted: boolean | null }

/** The team the person belongs to with its subteams (any depth): members and when each joined it. */
async function teamOf(admin: Admin, userId: string): Promise<Array<{ joinedTeam: string | null; p: Person }> | null> {
  const { data: m } = await admin.from("team_memberships").select("team_id").eq("user_id", userId).eq("is_active", true).order("joined_at", { ascending: false }).limit(1)
  const teamId = m?.[0]?.team_id as string | undefined
  if (!teamId) return null
  const { data: teams } = await admin.from("teams").select("id, parent_id").limit(2000)
  const ids = new Set([teamId])
  for (let grew = true; grew; ) {
    grew = false
    for (const t of teams ?? []) if (t.parent_id && ids.has(t.parent_id) && !ids.has(t.id)) { ids.add(t.id); grew = true }
  }
  const rows: Array<{ joined_at: string | null; profiles: Person | null }> = []
  for (let page = 0; page < 5; page++) {
    const { data } = await admin
      .from("team_memberships")
      .select("joined_at, profiles!inner(id, fname, fullname, birthday, joined_at, status, is_deleted)")
      .in("team_id", [...ids])
      .is("left_at", null)
      .range(page * 1000, page * 1000 + 999)
    rows.push(...((data ?? []) as unknown as typeof rows))
    if (!data || data.length < 1000) break
  }
  return rows.filter((r) => r.profiles && r.profiles.is_deleted !== true).map((r) => ({ joinedTeam: r.joined_at, p: r.profiles! }))
}

function birthdayTile(people: Person[], today: string, ask: string | null, who: string): BriefingItem | null {
  const md = today.slice(5)
  const cel = people.filter((p) => p.status === "active" && String(p.birthday ?? "").slice(5, 10) === md)
  if (!cel.length) return null
  const names = cel.map(firstName).filter(Boolean)
  return {
    key: "birthdays",
    label: `Birthdays ${who}`,
    value: String(cel.length),
    note: names.slice(0, 3).join(", ") + (names.length > 3 ? ` +${names.length - 3}` : "") + " 🎂",
    tone: "quiet",
    ask,
  }
}

// ─── Agents and team leaders ─────────────────────────────────────────────────

export async function agentBriefing(caller: AgentChatCaller): Promise<BriefingItem[]> {
  const admin = createAdminSupabase()
  const today = dubaiToday()
  const tomorrow = addDays(today, 1)
  const teamLeader = caller.role === "team_leader"
  const sales = fetchAllSales(admin)
  const team = teamLeader ? teamOf(admin, caller.userId) : Promise.resolve(null)

  const leads = (async (): Promise<BriefingItem> => {
    const { data, error } = await admin.from("buyer_link_leads").select(BUYER_LEAD_COLUMNS).eq("agent_id", caller.userId).gte("created_at", dubaiMidnight(addDays(today, -1)))
    if (error) throw new Error(error.message)
    const isOwnTest = await ownTestBrief(admin, caller)
    const rows = ((data ?? []) as unknown as BuyerLead[]).filter((b) => !isOwnTest(b))
    const priority = rows.filter((b) => b.kind !== "seller" && leadGrade(b) === "priority").length
    return {
      key: "leads",
      label: "New leads",
      value: String(rows.length),
      note: rows.length ? (priority ? `${priority} priority · since yesterday` : "since yesterday") : "none since yesterday",
      tone: rows.length ? "attention" : "quiet",
      ask: rows.length ? "Show my leads from yesterday and today — who should I call first?" : "How do I get more leads?",
    }
  })()

  const mine = (async (): Promise<BriefingItem> => {
    const n = (await sales).filter((s) => isPending(s) && saleCredits(s).some((c) => c.agentId === caller.userId)).length
    return {
      key: "pending",
      label: "Waiting for validation",
      value: String(n),
      note: n ? "the office is checking" : "nothing waiting",
      tone: n ? "attention" : "good",
      ask: "Anything of mine waiting for validation?",
    }
  })()

  const rank = (async (): Promise<BriefingItem> => {
    const board = await topSalesBoard(admin, caller, { from_date: `${today.slice(0, 7)}-01`, to_date: tomorrow })
    const you = board.you as { rank: number | null; deals: number }
    return {
      key: "rank",
      label: "Your rank this month",
      value: you.rank ? `#${you.rank}` : "–",
      note: you.rank ? `of ${board.agents_on_board} · ${plural(you.deals, "deal")}` : "no validated sale yet",
      tone: you.rank ? "good" : "quiet",
      ask: "Who are the top sellers this month, and where do I rank?",
    }
  })()

  const teamPending = (async (): Promise<BriefingItem | null> => {
    const members = await team
    if (!members) return null
    const ids = new Set(members.map((m) => m.p.id))
    const n = (await sales).filter((s) => isPending(s) && saleCredits(s).some((c) => ids.has(c.agentId))).length
    return {
      key: "team-pending",
      label: "Team deals waiting",
      value: String(n),
      note: n ? "for validation" : "nothing waiting",
      tone: n ? "attention" : "good",
      ask: "Anything of my team waiting for validation?",
    }
  })()

  const joiners = (async (): Promise<BriefingItem | null> => {
    const members = await team
    if (!members) return null
    const from = weekStart(today)
    // Joined FHI and the team this week — a team created in bulk doesn't make everyone new.
    const n = members.filter((m) => (m.joinedTeam ?? "").slice(0, 10) >= from && (m.p.joined_at ?? "").slice(0, 10) >= from).length
    return {
      key: "joiners",
      label: "Joined your team",
      value: String(n),
      note: "this week",
      tone: n ? "good" : "quiet",
      ask: "Who joined my team this week?",
    }
  })()

  // Birthdays among the people they look after: the team for a leader, their recruits otherwise.
  const birthdays = (async (): Promise<BriefingItem | null> => {
    const members = await team
    if (members) return birthdayTile(members.map((m) => m.p).filter((p) => p.id !== caller.userId), today, null, "in your team")
    const { data } = await admin.from("profiles").select("id, fname, fullname, birthday, joined_at, status, is_deleted").eq("metadata->>invited_by", caller.userId).not("is_deleted", "is", true).not("birthday", "is", null).limit(1000)
    return birthdayTile((data ?? []) as Person[], today, null, "among your recruits")
  })()

  return settle([leads, mine, rank, teamPending, joiners, birthdays])
}

// ─── Admins ──────────────────────────────────────────────────────────────────

export async function adminBriefing(): Promise<BriefingItem[]> {
  const admin = createAdminSupabase()
  const today = dubaiToday()
  const tomorrow = addDays(today, 1)
  const since = dubaiMidnight(addDays(today, -1))
  const sales = fetchAllSales(admin)

  const month = (async (): Promise<BriefingItem> => {
    const rows = (await sales).filter((s) => s.validation_status === "validated" && inRange(s, `${today.slice(0, 7)}-01`, tomorrow))
    const value = rows.reduce((a, s) => a + Number(s.contract_price ?? 0), 0)
    return {
      key: "sales",
      label: "Sales this month",
      value: plural(rows.length, "deal"),
      note: rows.length ? `${aedShort(value)} validated` : "no validated sale yet",
      tone: rows.length ? "good" : "quiet",
      ask: "How are our sales this month?",
    }
  })()

  const pending = (async (): Promise<BriefingItem> => {
    const n = (await sales).filter(isPending).length
    return { key: "pending", label: "Waiting for validation", value: String(n), note: n ? "sales to check" : "nothing waiting", tone: n ? "attention" : "good", ask: "Anything waiting for validation?" }
  })()

  const approvals = (async (): Promise<BriefingItem> => {
    const { count, error } = await admin.from("profiles").select("id", { count: "exact", head: true }).eq("status", "pending").not("is_deleted", "is", true)
    if (error) throw new Error(error.message)
    const n = count ?? 0
    return { key: "approvals", label: "Waiting for approval", value: String(n), note: n ? "new accounts" : "all approved", tone: n ? "attention" : "good", ask: "Who is waiting for approval?" }
  })()

  const leads = (async (): Promise<BriefingItem> => {
    const [inq, contact] = await Promise.all([
      admin.from("inquiries").select("id", { count: "exact", head: true }).is("deleted_at", null).gte("created_at", since),
      admin.from("contact_submissions").select("id", { count: "exact", head: true }).is("deleted_at", null).gte("created_at", since),
    ])
    if (inq.error) throw new Error(inq.error.message)
    const n = (inq.count ?? 0) + (contact.error ? 0 : contact.count ?? 0)
    return { key: "leads", label: "New leads", value: String(n), note: "website, since yesterday", tone: n ? "attention" : "quiet", ask: "Any new leads since yesterday?" }
  })()

  const tickets = (async (): Promise<BriefingItem> => {
    const { count, error } = await admin.from("support_tickets").select("id", { count: "exact", head: true }).in("status", ["open", "in_progress", "waiting_user"])
    if (error) throw new Error(error.message)
    const n = count ?? 0
    return { key: "tickets", label: "Open support tickets", value: String(n), note: n ? "not resolved yet" : "all resolved", tone: n ? "attention" : "good", ask: "Which support tickets are open?" }
  })()

  const birthdays = (async (): Promise<BriefingItem | null> => {
    const { data, error } = await admin.from("profiles").select("id, fname, fullname, birthday, joined_at, status, is_deleted").eq("status", "active").not("is_deleted", "is", true).not("birthday", "is", null).limit(5000)
    if (error) throw new Error(error.message)
    return birthdayTile((data ?? []) as Person[], today, "Make a birthday poster for today's celebrants", "today")
  })()

  return settle([month, pending, approvals, leads, tickets, birthdays])
}
