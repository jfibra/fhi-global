import "server-only"

import type { createAdminSupabase } from "@/lib/admin-supabase"
import { AED, fetchAllSales, inRange, saleCredits, type SaleRow } from "@/lib/fhi-chat-tools"

/**
 * An agent's own sales goal (boss via Juliecor, 2026-11-12): "I want 5 deals
 * this quarter" in their FHI Assistant → stored on their profile
 * (metadata.assistant_goal, one goal per person); "how am I doing on my goal"
 * → progress from the same figures as My Sales (validated deals and value,
 * their share of shared deals, reservation-date rule), with the pace needed
 * for the days left. The "Your goal" tile on the assistant's welcome screen
 * reads the same progress. Nothing here is visible to anyone but the person.
 */

type Admin = ReturnType<typeof createAdminSupabase>

export type AgentGoal = {
  /** Validated deals wanted in the period, or null when the goal is a value. */
  deals: number | null
  /** Validated value wanted (AED), or null. */
  value: number | null
  /** The period, from inclusive to exclusive (YYYY-MM-DD), and how it reads. */
  from: string
  to: string
  label: string
  set_at: string
}

export type GoalProgress = {
  goal: AgentGoal
  validated_deals: number
  validated_value: number
  pending_deals: number
  pending_value: number
  days_total: number
  days_left: number
  /** 0–100 for the headline target (deals when set, else value). */
  percent: number
  /** What is still missing on the headline target, in deals or AED. */
  remaining_deals: number | null
  remaining_value: number | null
  /** How many validated deals a week the rest of the period needs (deals goals). */
  pace_deals_per_week: number | null
  done: boolean
  over: boolean
}

const dubaiToday = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Dubai" })
const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000)

function parseGoal(raw: unknown): AgentGoal | null {
  if (!raw || typeof raw !== "object") return null
  const g = raw as Record<string, unknown>
  const deals = typeof g.deals === "number" && g.deals > 0 ? Math.round(g.deals) : null
  const value = typeof g.value === "number" && g.value > 0 ? Math.round(g.value) : null
  if (!deals && !value) return null
  if (typeof g.from !== "string" || typeof g.to !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(g.from) || !/^\d{4}-\d{2}-\d{2}$/.test(g.to) || g.to <= g.from) return null
  return { deals, value, from: g.from, to: g.to, label: typeof g.label === "string" && g.label.trim() ? g.label.trim().slice(0, 60) : `${g.from} to ${g.to}`, set_at: typeof g.set_at === "string" ? g.set_at : "" }
}

export async function readGoal(admin: Admin, userId: string): Promise<AgentGoal | null> {
  const { data } = await admin.from("profiles").select("metadata").eq("id", userId).maybeSingle<{ metadata: Record<string, unknown> | null }>()
  return parseGoal(data?.metadata?.assistant_goal)
}

/** Writes the goal (or removes it with null) into profiles.metadata, keeping every other key. */
export async function writeGoal(admin: Admin, userId: string, goal: AgentGoal | null): Promise<void> {
  const { data, error: readError } = await admin.from("profiles").select("metadata").eq("id", userId).maybeSingle<{ metadata: Record<string, unknown> | null }>()
  if (readError) throw new Error(readError.message)
  const { assistant_goal: _old, ...rest } = data?.metadata ?? {}
  void _old
  const { error } = await admin.from("profiles").update({ metadata: goal ? { ...rest, assistant_goal: goal } : rest }).eq("id", userId)
  if (error) throw new Error(error.message)
}

/** The goal's figures today, from the person's own sales. */
export async function goalProgress(admin: Admin, userId: string, goal: AgentGoal, sales?: SaleRow[]): Promise<GoalProgress> {
  const all = sales ?? (await fetchAllSales(admin))
  const mine = (s: SaleRow) => saleCredits(s).find((c) => c.agentId === userId)
  const rows = all.filter((s) => mine(s) && inRange(s, goal.from, goal.to))
  const status = (s: SaleRow) => s.validation_status ?? "pending"
  const validated = rows.filter((s) => status(s) === "validated")
  const pending = rows.filter((s) => status(s) === "pending")
  const validatedValue = validated.reduce((a, s) => a + (mine(s)?.value ?? 0), 0)
  const pendingValue = pending.reduce((a, s) => a + (mine(s)?.value ?? 0), 0)
  const today = dubaiToday()
  const daysTotal = Math.max(daysBetween(goal.from, goal.to), 1)
  const daysLeft = Math.max(Math.min(daysBetween(today, goal.to), daysTotal), 0)
  const headlineDone = goal.deals ? validated.length : validatedValue
  const headlineWant = goal.deals ?? goal.value ?? 1
  const percent = Math.min(Math.round((headlineDone / headlineWant) * 100), 999)
  const remainingDeals = goal.deals ? Math.max(goal.deals - validated.length, 0) : null
  const remainingValue = goal.value ? Math.max(goal.value - validatedValue, 0) : null
  const weeksLeft = daysLeft / 7
  return {
    goal,
    validated_deals: validated.length,
    validated_value: validatedValue,
    pending_deals: pending.length,
    pending_value: pendingValue,
    days_total: daysTotal,
    days_left: daysLeft,
    percent: Math.min(percent, 100),
    remaining_deals: remainingDeals,
    remaining_value: remainingValue,
    pace_deals_per_week: remainingDeals != null && remainingDeals > 0 && weeksLeft > 0 ? Math.round((remainingDeals / weeksLeft) * 10) / 10 : null,
    done: headlineDone >= headlineWant,
    over: daysLeft === 0 && headlineDone < headlineWant,
  }
}

/** "3 of 5 deals" / "AED 1.2M of AED 3M" — the headline the tile and the chat print. */
export function goalHeadline(p: GoalProgress): string {
  return p.goal.deals ? `${p.validated_deals} of ${p.goal.deals} deal${p.goal.deals === 1 ? "" : "s"}` : `${AED(p.validated_value)} of ${AED(p.goal.value ?? 0)}`
}

/** The periods the goal tool understands, in Dubai time: this month, this quarter, this year, or explicit dates. */
export function goalPeriod(period: string | undefined, from?: string, to?: string): { from: string; to: string; label: string } | null {
  const today = dubaiToday()
  const y = Number(today.slice(0, 4))
  const m = Number(today.slice(5, 7))
  const p = (period ?? "").toLowerCase().replace(/[^a-z]/g, "")
  if (p === "thismonth" || p === "month") {
    const next = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`
    return { from: `${y}-${String(m).padStart(2, "0")}-01`, to: next, label: new Date(`${today.slice(0, 7)}-01T00:00:00Z`).toLocaleDateString("en-AE", { month: "long", year: "numeric", timeZone: "UTC" }) }
  }
  if (p === "thisquarter" || p === "quarter") {
    const q = Math.floor((m - 1) / 3)
    const start = q * 3 + 1
    const end = start + 3
    return { from: `${y}-${String(start).padStart(2, "0")}-01`, to: end > 12 ? `${y + 1}-01-01` : `${y}-${String(end).padStart(2, "0")}-01`, label: `Q${q + 1} ${y}` }
  }
  if (p === "thisyear" || p === "year") return { from: `${y}-01-01`, to: `${y + 1}-01-01`, label: String(y) }
  if (from && to && /^\d{4}-\d{2}-\d{2}$/.test(from) && /^\d{4}-\d{2}-\d{2}$/.test(to) && to > from) return { from, to, label: `${from} to ${to}` }
  return null
}
