import "server-only"

import { createAdminSupabase } from "@/lib/admin-supabase"
import { logAuditEvent } from "@/lib/audit-log"

/**
 * Limits and bookkeeping for the agent-side FHI Assistant (migration 079).
 *
 * Two brakes, both enforced on the server from the assistant_usage table so
 * they hold across Vercel instances:
 *  - a per-person DAILY question limit (agents 20, team leaders 40; Dubai
 *    midnight reset) — admins are never limited;
 *  - a company MONTHLY spend cap for the agent audience (USD 30 by default).
 *    When it is hit the agent assistant pauses until next month; the admin
 *    assistant is a separate route and keeps working.
 * Every answered question is logged with its token usage; nothing is logged
 * for a request that was refused before reaching the model.
 */

type Admin = ReturnType<typeof createAdminSupabase>

export const ASSISTANT_AUDIENCE = "agent"

const num = (v: string | undefined, fallback: number) => {
  const n = Number(v)
  return Number.isFinite(n) && n >= 0 ? n : fallback
}

/** Questions a day per role; anything not listed here is unlimited. */
export function dailyLimitFor(role: string | null | undefined): number | null {
  if (role === "agent") return num(process.env.ASSISTANT_DAILY_LIMIT_AGENT, 20)
  if (role === "team_leader") return num(process.env.ASSISTANT_DAILY_LIMIT_TEAM_LEADER, 40)
  return null
}

export const monthlyCapUsd = () => num(process.env.ASSISTANT_MONTHLY_CAP_USD, 30)

/**
 * USD per 1M tokens. Defaults are gpt-4o-mini's list prices (input 0.15,
 * output 0.60) — override in env if the model or OpenAI's pricing changes.
 */
export function costUsd(promptTokens: number, completionTokens: number): number {
  const inPrice = num(process.env.OPENAI_PRICE_INPUT_USD_PER_M, 0.15)
  const outPrice = num(process.env.OPENAI_PRICE_OUTPUT_USD_PER_M, 0.6)
  return (promptTokens * inPrice + completionTokens * outPrice) / 1_000_000
}

/** Dubai is UTC+4 all year — the day and month boundaries as UTC instants. */
const DUBAI = "+04:00"
export const dubaiToday = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Dubai" })
export const dubaiDayStart = () => new Date(`${dubaiToday()}T00:00:00${DUBAI}`)
export const dubaiMonthStart = () => new Date(`${dubaiToday().slice(0, 7)}-01T00:00:00${DUBAI}`)
export const dubaiNextDayStart = () => new Date(dubaiDayStart().getTime() + 86_400_000)

export type AssistantQuota = {
  used: number
  /** null = unlimited (admin staff). */
  limit: number | null
  /** ISO instant when the daily count resets (next Dubai midnight). */
  resetsAt: string
}

export async function assistantQuota(admin: Admin, userId: string, role: string | null | undefined): Promise<AssistantQuota> {
  const limit = dailyLimitFor(role)
  const resetsAt = dubaiNextDayStart().toISOString()
  if (limit === null) return { used: 0, limit: null, resetsAt }
  const { count, error } = await admin
    .from("assistant_usage")
    .select("id", { count: "exact", head: true })
    .eq("audience", ASSISTANT_AUDIENCE)
    .eq("user_id", userId)
    .gte("asked_at", dubaiDayStart().toISOString())
  if (error) throw new Error(error.message)
  return { used: count ?? 0, limit, resetsAt }
}

/** Month-to-date spend of the agent audience, in USD. */
export async function assistantMonthSpend(admin: Admin): Promise<number> {
  const { data, error } = await admin.rpc("assistant_usage_spend", {
    p_audience: ASSISTANT_AUDIENCE,
    p_from: dubaiMonthStart().toISOString(),
  })
  if (error) throw new Error(error.message)
  return Number(data ?? 0)
}

export type UsageRow = {
  userId: string
  role: string | null
  question: string
  tools: string[]
  model: string
  promptTokens: number
  completionTokens: number
  ok: boolean
  error?: string | null
}

/** Best-effort: a failed log never fails the answer. */
export async function recordAssistantUsage(admin: Admin, row: UsageRow): Promise<void> {
  try {
    await admin.from("assistant_usage").insert({
      audience: ASSISTANT_AUDIENCE,
      user_id: row.userId,
      role: row.role,
      question: row.question.slice(0, 500),
      tools: row.tools,
      model: row.model,
      prompt_tokens: row.promptTokens,
      completion_tokens: row.completionTokens,
      cost_usd: Number(costUsd(row.promptTokens, row.completionTokens).toFixed(6)),
      ok: row.ok,
      error: row.error ?? null,
    })
  } catch {
    // Logging must never surface to the user.
  }
}

/**
 * Once per month, when the cap is first reached, leave a note in Activity
 * Logs so admins learn why agents see "paused" (phase 3 adds a usage page).
 */
export async function noteMonthlyCapReached(admin: Admin, spend: number): Promise<void> {
  try {
    const { data } = await admin
      .from("audit_logs")
      .select("id")
      .eq("category", "assistant")
      .eq("event", "monthly_cap_reached")
      .gte("occurred_at", dubaiMonthStart().toISOString())
      .limit(1)
    if (data?.length) return
    await logAuditEvent({
      category: "assistant",
      event: "monthly_cap_reached",
      source: "api",
      description: `FHI Assistant for agents paused: USD ${spend.toFixed(2)} spent this month, cap USD ${monthlyCapUsd().toFixed(2)}. It resumes next month or when ASSISTANT_MONTHLY_CAP_USD is raised.`,
    })
  } catch {
    // Best-effort.
  }
}

// ─── Admin usage report (phase 3) ────────────────────────────────────────────

export type AssistantUsageReport = {
  cap_usd: number
  month: { from: string; spend_usd: number; questions: number; people: number }
  today: { questions: number }
  window: { days: number; from: string }
  per_day: Array<{ day: string; questions: number; cost_usd: number }>
  per_person: Array<{ userId: string; name: string; role: string | null; questions: number; today: number; cost_usd: number; tokens: number; failed: number; last_asked: string; limit: number | null }>
  top_tools: Array<{ tool: string; count: number }>
  recent: Array<{ at: string; userId: string; name: string; role: string | null; question: string; tools: string[]; ok: boolean; error: string | null; cost_usd: number }>
}

type Row = { user_id: string; role: string | null; asked_at: string; question: string | null; tools: string[] | null; prompt_tokens: number; completion_tokens: number; cost_usd: number | string; ok: boolean; error: string | null }

/** Who asks what and what it costs — everything the admin Usage page shows. Last `days` days (max 92). */
export async function assistantUsageReport(admin: Admin, days = 30): Promise<AssistantUsageReport> {
  const span = Math.min(Math.max(days, 1), 92)
  const windowFrom = new Date(dubaiDayStart().getTime() - (span - 1) * 86_400_000)
  const monthFrom = dubaiMonthStart()
  const from = new Date(Math.min(windowFrom.getTime(), monthFrom.getTime()))
  const rows: Row[] = []
  for (let page = 0; page < 20; page++) {
    const { data, error } = await admin
      .from("assistant_usage")
      .select("user_id, role, asked_at, question, tools, prompt_tokens, completion_tokens, cost_usd, ok, error")
      .eq("audience", ASSISTANT_AUDIENCE)
      .gte("asked_at", from.toISOString())
      .order("asked_at", { ascending: false })
      .range(page * 1000, page * 1000 + 999)
    if (error) throw new Error(error.message)
    rows.push(...((data ?? []) as Row[]))
    if (!data || data.length < 1000) break
  }
  const dubaiDay = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: "Asia/Dubai" })
  const cost = (r: Row) => Number(r.cost_usd) || 0
  const today = dubaiToday()
  const monthRows = rows.filter((r) => new Date(r.asked_at) >= monthFrom)
  const winRows = rows.filter((r) => new Date(r.asked_at) >= windowFrom)

  const ids = [...new Set(rows.map((r) => r.user_id))]
  const names = new Map<string, string>()
  for (let i = 0; i < ids.length; i += 200) {
    const { data } = await admin.from("profiles").select("id, fullname").in("id", ids.slice(i, i + 200))
    for (const p of (data ?? []) as { id: string; fullname: string | null }[]) names.set(String(p.id), (p.fullname ?? "").replace(/\s+/g, " ").trim() || "Unnamed account")
  }

  const perDay = new Map<string, { questions: number; cost_usd: number }>()
  for (let i = 0; i < span; i++) perDay.set(new Date(windowFrom.getTime() + i * 86_400_000).toLocaleDateString("en-CA", { timeZone: "Asia/Dubai" }), { questions: 0, cost_usd: 0 })
  for (const r of winRows) {
    const d = perDay.get(dubaiDay(r.asked_at))
    if (d) { d.questions++; d.cost_usd += cost(r) }
  }
  const perPerson = new Map<string, AssistantUsageReport["per_person"][number]>()
  for (const r of winRows) {
    const p = perPerson.get(r.user_id) ?? { userId: r.user_id, name: names.get(r.user_id) ?? "Unknown", role: r.role, questions: 0, today: 0, cost_usd: 0, tokens: 0, failed: 0, last_asked: r.asked_at, limit: dailyLimitFor(r.role) }
    p.questions++
    if (dubaiDay(r.asked_at) === today) p.today++
    p.cost_usd += cost(r)
    p.tokens += (r.prompt_tokens ?? 0) + (r.completion_tokens ?? 0)
    if (!r.ok) p.failed++
    if (r.asked_at > p.last_asked) p.last_asked = r.asked_at
    perPerson.set(r.user_id, p)
  }
  const tools = new Map<string, number>()
  for (const r of winRows) for (const t of r.tools ?? []) tools.set(t, (tools.get(t) ?? 0) + 1)
  const r4 = (n: number) => Math.round(n * 10000) / 10000

  return {
    cap_usd: monthlyCapUsd(),
    month: { from: monthFrom.toISOString(), spend_usd: r4(monthRows.reduce((a, r) => a + cost(r), 0)), questions: monthRows.length, people: new Set(monthRows.map((r) => r.user_id)).size },
    today: { questions: rows.filter((r) => dubaiDay(r.asked_at) === today).length },
    window: { days: span, from: windowFrom.toISOString() },
    per_day: [...perDay.entries()].map(([day, v]) => ({ day, questions: v.questions, cost_usd: r4(v.cost_usd) })),
    per_person: [...perPerson.values()].map((p) => ({ ...p, cost_usd: r4(p.cost_usd) })).sort((a, b) => b.questions - a.questions || a.name.localeCompare(b.name)),
    top_tools: [...tools.entries()].map(([tool, count]) => ({ tool, count })).sort((a, b) => b.count - a.count),
    recent: winRows.slice(0, 200).map((r) => ({ at: r.asked_at, userId: r.user_id, name: names.get(r.user_id) ?? "Unknown", role: r.role, question: r.question ?? "", tools: r.tools ?? [], ok: r.ok, error: r.error, cost_usd: r4(cost(r)) })),
  }
}
