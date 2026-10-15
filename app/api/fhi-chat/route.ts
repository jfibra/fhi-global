import { NextRequest, NextResponse } from "next/server"
import { requireRole } from "@/lib/auth-guard"
import { ROLES_ADMIN_STAFF, ROLES_AGENT_ASSISTANT } from "@/lib/app-roles"
import { createAdminSupabase } from "@/lib/admin-supabase"
import { AGENT_CHAT_MAX_HISTORY, AGENT_CHAT_MAX_QUESTION_CHARS, runAgentChat } from "@/lib/fhi-agent-chat"
import { assistantMonthSpend, assistantQuota, monthlyCapUsd, noteMonthlyCapReached, recordAssistantUsage } from "@/lib/assistant-usage"
import { sseResponse, type ChatStreamEvent } from "@/lib/fhi-chat-stream"

/**
 * FHI Assistant for agents and team leaders (boss, 2026-10-09). The same
 * chat as the admin one but over a five-tool box bound to the caller's own
 * identity (lib/fhi-agent-chat-tools.ts) — their sales, the Top Sales board,
 * projects and news. The admin toolbox is never sent to the model.
 *
 * Brakes (lib/assistant-usage.ts, migration 079): a daily question limit per
 * person and a monthly spend cap for the whole agent audience. GET returns
 * the caller's quota for the UI counter.
 */

export const runtime = "nodejs"
export const maxDuration = 60

const ALLOWED = [...ROLES_AGENT_ASSISTANT, ...ROLES_ADMIN_STAFF]

/** The caller's daily quota — the UI shows "N of M questions left today". */
export async function GET() {
  const session = await requireRole(ALLOWED)
  if (!session.ok) return session.response
  try {
    const quota = await assistantQuota(createAdminSupabase(), session.context.userId, session.context.profile.role)
    return NextResponse.json({ quota }, { headers: { "Cache-Control": "no-store" } })
  } catch {
    return NextResponse.json({ error: "Couldn't read your usage." }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const session = await requireRole(ALLOWED)
  if (!session.ok) return session.response
  const { userId, profile } = session.context

  const apiKey = process.env.OPENAI_API_KEY?.trim()
  if (!apiKey) return NextResponse.json({ error: "FHI Assistant is not configured on the server." }, { status: 503 })

  const body = (await req.json().catch(() => null)) as { messages?: Array<{ role: string; content: string }> } | null
  const history = (body?.messages ?? [])
    .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .slice(-AGENT_CHAT_MAX_HISTORY)
    .map((m) => ({ role: m.role as "user" | "assistant", content: m.content.slice(0, m.role === "user" ? AGENT_CHAT_MAX_QUESTION_CHARS : 4000) }))
  if (history.length === 0 || history[history.length - 1].role !== "user") {
    return NextResponse.json({ error: "Send at least one user message." }, { status: 422 })
  }
  const question = history[history.length - 1].content

  // The brakes, checked before anything reaches the model.
  const admin = createAdminSupabase()
  let quota
  try {
    quota = await assistantQuota(admin, userId, profile.role)
    if (quota.limit !== null && quota.used >= quota.limit) {
      return NextResponse.json(
        { error: `You've used today's ${quota.limit} questions. The counter resets at midnight Dubai time.`, quota },
        { status: 429 },
      )
    }
    const spend = await assistantMonthSpend(admin)
    if (spend >= monthlyCapUsd()) {
      await noteMonthlyCapReached(admin, spend)
      return NextResponse.json(
        { error: "FHI Assistant has reached this month's usage budget and is paused until next month. The admins have been notified.", quota },
        { status: 429 },
      )
    }
  } catch {
    return NextResponse.json({ error: "Couldn't check your usage — try again.", }, { status: 500 })
  }

  const run = async (emit: (e: ChatStreamEvent) => void) => {
    const result = await runAgentChat({ userId, name: profile.fullname, role: profile.role }, history, apiKey, emit)
    // Every question that reached the model counts, answered or not — it cost tokens.
    await recordAssistantUsage(admin, {
      userId,
      role: profile.role,
      question,
      tools: result.used,
      model: result.model,
      promptTokens: result.promptTokens,
      completionTokens: result.completionTokens,
      ok: result.ok,
      error: result.error,
    })
    const nextQuota = { ...quota, used: quota.used + 1 }
    if (!result.ok) return { ok: false as const, status: result.status ?? 500, error: result.error ?? "FHI Assistant couldn't answer — try again.", quota: nextQuota }
    return {
      ok: true as const,
      payload: { reply: result.reply, used: result.used, cards: result.cards, names: result.names, charts: result.charts, stats: result.stats, printCards: [], quota: nextQuota },
    }
  }

  // The page asks for a live stream (words as they are written, which lookups
  // are running); anything else gets the whole answer as one JSON object.
  if (req.headers.get("accept")?.includes("text/event-stream")) {
    return sseResponse(async (send) => {
      const out = await run(send)
      send(out.ok ? { type: "done", ...out.payload } : { type: "error", error: out.error, status: out.status, quota: out.quota })
    })
  }
  const out = await run(() => {})
  return out.ok ? NextResponse.json(out.payload) : NextResponse.json({ error: out.error, quota: out.quota }, { status: out.status })
}
