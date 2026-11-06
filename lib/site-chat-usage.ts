import "server-only"

import { createHash } from "node:crypto"
import type { createAdminSupabase } from "@/lib/admin-supabase"
import { costUsd, dubaiDayStart, dubaiMonthStart } from "@/lib/assistant-usage"

/**
 * The brakes and the log of the website chat (migration 083) — the public
 * FHI Assistant on fhiglobal.ae (lib/site-chat.ts, app/api/site-chat).
 *
 * A public endpoint that pays per question needs limits a script can't talk
 * its way around, so every one of these is checked on the server before a
 * word reaches the model, and all of them except the first are counted in
 * the database so they hold across Vercel instances:
 *
 *   · per IP, per minute   — in memory (lib/rate-limit.ts), the cheap first wall
 *   · per IP, per hour/day — a person asks a few questions; a script asks hundreds
 *   · per conversation     — one tab can't run forever
 *   · site-wide, per hour  — a botnet spread over many IPs still hits one ceiling
 *   · spend, per day/month — the hard money stop, whatever the traffic
 *
 * Over any of them the route answers 429 with a friendly line and the
 * company WhatsApp, and records the refusal (blocked = reason) so the admin
 * page shows it. Refused rows never count towards the limits.
 */

type Admin = ReturnType<typeof createAdminSupabase>

const num = (raw: string | undefined, fallback: number) => {
  const n = Number(raw)
  return Number.isFinite(n) && n > 0 ? n : fallback
}

export const SITE_CHAT_LIMITS = {
  /** In-memory, per instance: messages per IP per minute. */
  ipPerMinute: 8,
  ipPerHour: 30,
  ipPerDay: 80,
  /** Messages per conversation (one browser tab's session). */
  perSession: 40,
  /** Messages site-wide per hour — above this something is wrong, not busy. */
  sitePerHour: 500,
  dayCapUsd: () => num(process.env.SITE_CHAT_DAILY_CAP_USD, 5),
  monthCapUsd: () => num(process.env.SITE_CHAT_MONTHLY_CAP_USD, 30),
  /** The model never sees more than this of a visitor's message. */
  questionChars: 600,
  /** Turns of history the browser may send back. */
  historyTurns: 16,
}

export type BlockReason = "ip_minute" | "ip_hour" | "ip_day" | "session" | "site_hour" | "day_cap" | "month_cap"

/** What the visitor reads when refused — never the mechanism. */
export function blockMessage(reason: BlockReason): string {
  switch (reason) {
    case "ip_minute":
      return "You're sending messages very fast — give it a minute, or message us on WhatsApp."
    case "ip_hour":
    case "ip_day":
      return "You've reached today's limit for the chat. A consultant can carry on with you on WhatsApp."
    case "session":
      return "This conversation has reached its limit. Start a new one, or carry on with a consultant on WhatsApp."
    case "site_hour":
    case "day_cap":
    case "month_cap":
      return "The chat is taking a short break. Message us on WhatsApp and a consultant will answer you."
  }
}

/** A salted hash of the visitor's IP: enough to count by, never the address. */
export function ipHash(ip: string | null): string {
  const salt = process.env.SITE_CHAT_IP_SALT?.trim() || process.env.CRON_SECRET?.trim() || "fhi-site-chat"
  return createHash("sha256").update(`${salt}|${ip ?? "unknown"}`).digest("hex").slice(0, 32)
}

type Gate = { ip_hour: number; ip_day: number; session: number; site_hour: number; day_cost: number; month_cost: number }

export type GateVerdict = { ok: true; counts: Gate } | { ok: false; reason: BlockReason; counts: Gate }

/** One round trip: every count the brakes need (site_chat_gate, migration 083). */
export async function siteChatGate(admin: Admin, ip: string, session: string): Promise<GateVerdict> {
  const { data, error } = await admin.rpc("site_chat_gate", {
    p_ip_hash: ip,
    p_session: session,
    p_day_start: dubaiDayStart().toISOString(),
    p_month_start: dubaiMonthStart().toISOString(),
  })
  if (error) throw new Error(error.message)
  const raw = (data ?? {}) as Partial<Record<keyof Gate, number | string>>
  const counts: Gate = {
    ip_hour: Number(raw.ip_hour ?? 0),
    ip_day: Number(raw.ip_day ?? 0),
    session: Number(raw.session ?? 0),
    site_hour: Number(raw.site_hour ?? 0),
    day_cost: Number(raw.day_cost ?? 0),
    month_cost: Number(raw.month_cost ?? 0),
  }
  const L = SITE_CHAT_LIMITS
  // The money stops first: they protect the company whatever the traffic looks like.
  if (counts.month_cost >= L.monthCapUsd()) return { ok: false, reason: "month_cap", counts }
  if (counts.day_cost >= L.dayCapUsd()) return { ok: false, reason: "day_cap", counts }
  if (counts.site_hour >= L.sitePerHour) return { ok: false, reason: "site_hour", counts }
  if (counts.ip_hour >= L.ipPerHour) return { ok: false, reason: "ip_hour", counts }
  if (counts.ip_day >= L.ipPerDay) return { ok: false, reason: "ip_day", counts }
  if (counts.session >= L.perSession) return { ok: false, reason: "session", counts }
  return { ok: true, counts }
}

export type SiteChatRow = {
  session: string
  ipHash: string
  country: string | null
  page: string | null
  question: string
  answer?: string | null
  tools?: string[]
  projects?: string[]
  model?: string | null
  promptTokens?: number
  completionTokens?: number
  ok?: boolean
  error?: string | null
  blocked?: BlockReason | null
}

/** Best-effort: a failed log never fails the answer. */
export async function recordSiteChat(admin: Admin, row: SiteChatRow): Promise<void> {
  try {
    const promptTokens = row.promptTokens ?? 0
    const completionTokens = row.completionTokens ?? 0
    await admin.from("site_chat_messages").insert({
      session_id: row.session,
      ip_hash: row.ipHash,
      country: row.country,
      page: row.page,
      question: row.question.slice(0, 600),
      answer: row.answer ? row.answer.slice(0, 4000) : null,
      tools: row.tools ?? [],
      projects: (row.projects ?? []).slice(0, 12),
      model: row.model ?? null,
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
      cost_usd: Number(costUsd(promptTokens, completionTokens, row.model).toFixed(6)),
      ok: row.ok ?? true,
      error: row.error ?? null,
      blocked: row.blocked ?? null,
    })
  } catch {
    // Logging must never surface to the visitor.
  }
}

/** The last messages of one conversation, oldest first — the lead form's context, read from OUR record, never from the browser. */
export async function siteChatTranscript(admin: Admin, session: string, limit = 8): Promise<Array<{ question: string; answer: string | null; projects: string[]; page: string | null; at: string }>> {
  const { data, error } = await admin
    .from("site_chat_messages")
    .select("question, answer, projects, page, asked_at")
    .eq("session_id", session)
    .is("blocked", null)
    .order("asked_at", { ascending: false })
    .limit(limit)
  if (error) throw new Error(error.message)
  return ((data ?? []) as Array<{ question: string | null; answer: string | null; projects: string[] | null; page: string | null; asked_at: string }>)
    .reverse()
    .map((r) => ({ question: r.question ?? "", answer: r.answer, projects: r.projects ?? [], page: r.page, at: r.asked_at }))
}

// ─── The admin page's report ─────────────────────────────────────────────────

export type SiteChatReport = {
  window: { days: number; from: string }
  cap_usd: number
  day_cap_usd: number
  limits: { ip_per_hour: number; ip_per_day: number; per_session: number; site_per_hour: number }
  month: { from: string; spend_usd: number; questions: number; conversations: number; blocked: number; leads: number }
  today: { questions: number; spend_usd: number; blocked: number; leads: number }
  per_day: Array<{ day: string; questions: number; cost_usd: number; blocked: number; conversations: number; leads: number }>
  top_pages: Array<{ page: string; count: number }>
  top_tools: Array<{ tool: string; count: number }>
  top_countries: Array<{ country: string; count: number }>
  blocked_by_reason: Array<{ reason: string; count: number }>
  conversations: Array<{
    session: string
    started: string
    last: string
    messages: number
    page: string | null
    country: string | null
    first_question: string
    cost_usd: number
    failed: number
    lead: { name: string; id: string } | null
  }>
  messages: Array<{ at: string; session: string; question: string; answer: string | null; tools: string[]; ok: boolean; error: string | null; cost_usd: number; blocked: string | null; page: string | null }>
}

type Row = {
  session_id: string
  country: string | null
  page: string | null
  asked_at: string
  question: string | null
  answer: string | null
  tools: string[] | null
  cost_usd: number | string
  ok: boolean
  error: string | null
  blocked: string | null
}

const dubaiDay = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: "Asia/Dubai" })

export async function siteChatReport(admin: Admin, days: number): Promise<SiteChatReport> {
  const span = Math.min(Math.max(Math.round(days) || 30, 1), 90)
  const monthStart = dubaiMonthStart()
  const dayStart = dubaiDayStart()
  const windowFrom = new Date(dayStart.getTime() - (span - 1) * 86_400_000)
  const from = new Date(Math.min(windowFrom.getTime(), monthStart.getTime()))

  const rows: Row[] = []
  for (let page = 0; page < 10; page++) {
    const { data, error } = await admin
      .from("site_chat_messages")
      .select("session_id, country, page, asked_at, question, answer, tools, cost_usd, ok, error, blocked")
      .gte("asked_at", from.toISOString())
      .order("asked_at", { ascending: false })
      .range(page * 1000, page * 1000 + 999)
    if (error) throw new Error(error.message)
    rows.push(...((data ?? []) as Row[]))
    if (!data || data.length < 1000) break
  }

  // Which conversations turned into a lead (inquiries.chat_session_id, 083).
  const { data: leadRows } = await admin
    .from("inquiries")
    .select("id, name, chat_session_id, created_at")
    .eq("source", "chat")
    .gte("created_at", from.toISOString())
    .is("deleted_at", null)
  const leads = ((leadRows ?? []) as Array<{ id: string; name: string; chat_session_id: string | null; created_at: string }>)
  const leadBySession = new Map(leads.filter((l) => l.chat_session_id).map((l) => [l.chat_session_id as string, { name: l.name, id: l.id }]))

  const cost = (r: Row) => Number(r.cost_usd) || 0
  const inWindow = (iso: string) => new Date(iso) >= windowFrom
  const inMonth = (iso: string) => new Date(iso) >= monthStart
  const isToday = (iso: string) => new Date(iso) >= dayStart
  const live = (r: Row) => r.blocked === null

  const perDay = new Map<string, SiteChatReport["per_day"][number]>()
  for (let i = 0; i < span; i++) {
    perDay.set(dubaiDay(new Date(windowFrom.getTime() + i * 86_400_000).toISOString()), { day: "", questions: 0, cost_usd: 0, blocked: 0, conversations: 0, leads: 0 })
  }
  const sessionsByDay = new Map<string, Set<string>>()
  const pages = new Map<string, number>()
  const tools = new Map<string, number>()
  const countries = new Map<string, number>()
  const reasons = new Map<string, number>()
  const convs = new Map<string, SiteChatReport["conversations"][number]>()

  for (const r of rows) {
    if (inWindow(r.asked_at)) {
      const day = dubaiDay(r.asked_at)
      const d = perDay.get(day)
      if (d) {
        if (live(r)) {
          d.questions++
          d.cost_usd += cost(r)
          const set = sessionsByDay.get(day) ?? new Set<string>()
          set.add(r.session_id)
          sessionsByDay.set(day, set)
        } else d.blocked++
      }
      if (live(r)) {
        if (r.page) pages.set(r.page, (pages.get(r.page) ?? 0) + 1)
        for (const t of r.tools ?? []) tools.set(t, (tools.get(t) ?? 0) + 1)
        if (r.country) countries.set(r.country, (countries.get(r.country) ?? 0) + 1)
        // Rows come newest first: the first one seen is the last message, the last one seen the first.
        const c = convs.get(r.session_id)
        if (c) {
          c.messages++
          c.started = r.asked_at
          c.first_question = r.question ?? ""
          c.page = r.page ?? c.page
          c.cost_usd += cost(r)
          if (!r.ok) c.failed++
        } else {
          convs.set(r.session_id, { session: r.session_id, started: r.asked_at, last: r.asked_at, messages: 1, page: r.page, country: r.country, first_question: r.question ?? "", cost_usd: cost(r), failed: r.ok ? 0 : 1, lead: leadBySession.get(r.session_id) ?? null })
        }
      } else if (r.blocked) reasons.set(r.blocked, (reasons.get(r.blocked) ?? 0) + 1)
    }
  }
  for (const [day, d] of perDay) {
    d.day = day
    d.conversations = sessionsByDay.get(day)?.size ?? 0
  }
  for (const l of leads) {
    const d = perDay.get(dubaiDay(l.created_at))
    if (d) d.leads++
  }

  const monthRows = rows.filter((r) => inMonth(r.asked_at))
  const todayRows = rows.filter((r) => isToday(r.asked_at))
  const top = (m: Map<string, number>, cap: number) => [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, cap)

  return {
    window: { days: span, from: windowFrom.toISOString() },
    cap_usd: SITE_CHAT_LIMITS.monthCapUsd(),
    day_cap_usd: SITE_CHAT_LIMITS.dayCapUsd(),
    limits: { ip_per_hour: SITE_CHAT_LIMITS.ipPerHour, ip_per_day: SITE_CHAT_LIMITS.ipPerDay, per_session: SITE_CHAT_LIMITS.perSession, site_per_hour: SITE_CHAT_LIMITS.sitePerHour },
    month: {
      from: monthStart.toISOString(),
      spend_usd: monthRows.reduce((s, r) => s + cost(r), 0),
      questions: monthRows.filter(live).length,
      conversations: new Set(monthRows.filter(live).map((r) => r.session_id)).size,
      blocked: monthRows.filter((r) => !live(r)).length,
      leads: leads.filter((l) => inMonth(l.created_at)).length,
    },
    today: {
      questions: todayRows.filter(live).length,
      spend_usd: todayRows.reduce((s, r) => s + cost(r), 0),
      blocked: todayRows.filter((r) => !live(r)).length,
      leads: leads.filter((l) => isToday(l.created_at)).length,
    },
    per_day: [...perDay.values()],
    top_pages: top(pages, 12).map(([page, count]) => ({ page, count })),
    top_tools: top(tools, 10).map(([tool, count]) => ({ tool, count })),
    top_countries: top(countries, 10).map(([country, count]) => ({ country, count })),
    blocked_by_reason: top(reasons, 10).map(([reason, count]) => ({ reason, count })),
    conversations: [...convs.values()].sort((a, b) => b.last.localeCompare(a.last)).slice(0, 300),
    messages: rows
      .filter((r) => inWindow(r.asked_at))
      .slice(0, 600)
      .map((r) => ({ at: r.asked_at, session: r.session_id, question: r.question ?? "", answer: r.answer, tools: r.tools ?? [], ok: r.ok, error: r.error, cost_usd: Number(cost(r).toFixed(6)), blocked: r.blocked, page: r.page })),
  }
}
