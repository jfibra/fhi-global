import "server-only"

import type { createAdminSupabase } from "@/lib/admin-supabase"
import { dubaiDayStart, dubaiMonthStart, recordAssistantUsage } from "@/lib/assistant-usage"

/**
 * The brakes on the Team Performance Report's AI analysis when a TEAM LEADER opens it (admins are
 * not limited, like the admin FHI Assistant). One analysis costs about 2 US cents (gpt-4.1), and a
 * leader flips between periods, so two limits keep the bill predictable — both read from the
 * assistant_usage table (migration 079) so they hold across Vercel instances:
 *
 *  - TEAM_REPORT_DAILY_LIMIT (default 6) AI analyses per person per Dubai day;
 *  - TEAM_REPORT_MONTHLY_CAP_USD (default 25) for all leaders together.
 *
 * It has its own audience ("team_report") so it never uses up the agent assistant's USD 30 monthly
 * cap. Over a limit — or when the check itself fails (never spend on an unchecked request) — the
 * report is still built, with the standard rule-based analysis from the same figures, and says so.
 * Opening the PDF re-uses the analysis already on screen and costs nothing.
 */

type Admin = ReturnType<typeof createAdminSupabase>

export const REPORT_AUDIENCE = "team_report"

const num = (v: string | undefined, fallback: number) => {
  const n = Number(v)
  return Number.isFinite(n) && n >= 0 ? n : fallback
}
export const reportDailyLimit = () => num(process.env.TEAM_REPORT_DAILY_LIMIT, 6)
export const reportMonthlyCapUsd = () => num(process.env.TEAM_REPORT_MONTHLY_CAP_USD, 25)

export type ReportBudget = { allowed: true } | { allowed: false; note: string }

const STANDARD = "the standard analysis, written from the same figures with fixed wording"

export async function reportBudget(admin: Admin, userId: string): Promise<ReportBudget> {
  try {
    const { count, error } = await admin
      .from("assistant_usage")
      .select("id", { count: "exact", head: true })
      .eq("audience", REPORT_AUDIENCE)
      .eq("user_id", userId)
      .gte("asked_at", dubaiDayStart().toISOString())
    if (error) throw new Error(error.message)
    const limit = reportDailyLimit()
    if ((count ?? 0) >= limit) return { allowed: false, note: `You have already opened ${limit} AI-written reports today, so this one shows ${STANDARD}. The AI analysis is back after midnight, Dubai time.` }
    const { data, error: spendError } = await admin.rpc("assistant_usage_spend", { p_audience: REPORT_AUDIENCE, p_from: dubaiMonthStart().toISOString() })
    if (spendError) throw new Error(spendError.message)
    if (Number(data ?? 0) >= reportMonthlyCapUsd()) return { allowed: false, note: `The AI analysis is paused until next month to stay within its budget, so this report shows ${STANDARD}.` }
    return { allowed: true }
  } catch {
    return { allowed: false, note: `The AI analysis could not be checked just now, so this report shows ${STANDARD}.` }
  }
}

/** Counts one AI analysis against the leader's day and the month's budget. Best-effort, like every usage log. */
export async function recordReportUsage(admin: Admin, opts: { userId: string; role: string | null; from: string; to: string; model: string; promptTokens: number; completionTokens: number; ok: boolean }): Promise<void> {
  await recordAssistantUsage(admin, {
    audience: REPORT_AUDIENCE,
    userId: opts.userId,
    role: opts.role,
    question: `Team Performance Report ${opts.from} to ${opts.to}`,
    tools: ["team_report"],
    model: opts.model,
    promptTokens: opts.promptTokens,
    completionTokens: opts.completionTokens,
    ok: opts.ok,
  })
}
