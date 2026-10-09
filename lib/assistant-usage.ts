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
