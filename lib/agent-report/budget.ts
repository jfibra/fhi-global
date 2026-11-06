import "server-only"

import type { createAdminSupabase } from "@/lib/admin-supabase"
import { dubaiDayStart, dubaiMonthStart, recordAssistantUsage } from "@/lib/assistant-usage"

/**
 * The brakes on My Performance Report's AI coaching (agents and team leaders).
 * One analysis costs 2–4 US cents on the advice model, and a report is
 * something people re-open, so two limits keep the bill predictable — both
 * read from assistant_usage (migration 079) so they hold across Vercel
 * instances, under their own audience so they never eat the agent
 * assistant's monthly cap:
 *
 *  - AGENT_REPORT_DAILY_LIMIT (default 3) AI-written reports per person per Dubai day;
 *  - AGENT_REPORT_MONTHLY_CAP_USD (default 20) for everyone together.
 *
 * Over a limit — or when the check itself fails — the report is still built,
 * with the standard rule-based coaching from the same figures, and says so.
 */

type Admin = ReturnType<typeof createAdminSupabase>

export const AGENT_REPORT_AUDIENCE = "agent_report"

const num = (v: string | undefined, fallback: number) => {
  const n = Number(v)
  return Number.isFinite(n) && n >= 0 ? n : fallback
}
export const agentReportDailyLimit = () => num(process.env.AGENT_REPORT_DAILY_LIMIT, 3)
export const agentReportMonthlyCapUsd = () => num(process.env.AGENT_REPORT_MONTHLY_CAP_USD, 20)

export type AgentReportBudget = { allowed: true } | { allowed: false; note: string }

const STANDARD = "the standard coaching, written from the same figures with fixed wording"

export async function agentReportBudget(admin: Admin, userId: string): Promise<AgentReportBudget> {
  try {
    const { count, error } = await admin
      .from("assistant_usage")
      .select("id", { count: "exact", head: true })
      .eq("audience", AGENT_REPORT_AUDIENCE)
      .eq("user_id", userId)
      .gte("asked_at", dubaiDayStart().toISOString())
    if (error) throw new Error(error.message)
    const limit = agentReportDailyLimit()
    if ((count ?? 0) >= limit) return { allowed: false, note: `You have already opened ${limit} AI-coached reports today, so this one shows ${STANDARD}. The AI coaching is back after midnight, Dubai time.` }
    const { data, error: spendError } = await admin.rpc("assistant_usage_spend", { p_audience: AGENT_REPORT_AUDIENCE, p_from: dubaiMonthStart().toISOString() })
    if (spendError) throw new Error(spendError.message)
    if (Number(data ?? 0) >= agentReportMonthlyCapUsd()) return { allowed: false, note: `The AI coaching is paused until next month to stay within its budget, so this report shows ${STANDARD}.` }
    return { allowed: true }
  } catch {
    return { allowed: false, note: `The AI coaching could not be checked just now, so this report shows ${STANDARD}.` }
  }
}

/** Counts one AI analysis against the person's day and the month's budget. Best-effort, like every usage log. */
export async function recordAgentReportUsage(admin: Admin, opts: { userId: string; role: string | null; from: string; to: string; model: string; promptTokens: number; completionTokens: number; ok: boolean }): Promise<void> {
  await recordAssistantUsage(admin, {
    audience: AGENT_REPORT_AUDIENCE,
    userId: opts.userId,
    role: opts.role,
    question: `My Performance Report ${opts.from} to ${opts.to}`,
    tools: ["my_report"],
    model: opts.model,
    promptTokens: opts.promptTokens,
    completionTokens: opts.completionTokens,
    ok: opts.ok,
  })
}
