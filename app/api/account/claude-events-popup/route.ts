import { NextRequest, NextResponse } from "next/server"
import { requireActiveSession } from "@/lib/auth-guard"
import { createAdminSupabase } from "@/lib/admin-supabase"
import { ROLES_AGENT_ASSISTANT, roleInList } from "@/lib/app-roles"

/**
 * An agent or team leader answered the "create your events with Claude" pop-up
 * (components/dashboard/claude-events-popup.tsx): record it on their own profile so it follows the account, not
 * the device. `later` = remind me in three days (three showings at most); `done` = they went to Connect Claude,
 * said not to show it again, or already have a connection that may create events. Merges just
 * metadata.claude_events_popup = { shown, later_at | done_at }; a `done` is never undone.
 */
export async function POST(req: NextRequest) {
  const session = await requireActiveSession()
  if (!session.ok) return session.response
  if (!roleInList(session.context.profile.role, ROLES_AGENT_ASSISTANT)) {
    return NextResponse.json({ error: "Only agents and team leaders see this" }, { status: 403 })
  }
  const body = (await req.json().catch(() => ({}))) as { action?: unknown }
  const action = body.action === "done" ? "done" : body.action === "later" ? "later" : null
  if (!action) return NextResponse.json({ error: "action must be later or done" }, { status: 400 })

  const admin = createAdminSupabase()
  const { data: current, error: readError } = await admin
    .from("profiles")
    .select("metadata")
    .eq("id", session.context.userId)
    .maybeSingle<{ metadata: Record<string, unknown> | null }>()
  if (readError) return NextResponse.json({ error: "Couldn't save" }, { status: 500 })

  const existing = current?.metadata ?? {}
  const before = (existing.claude_events_popup ?? {}) as { shown?: unknown; done_at?: unknown }
  if (typeof before.done_at === "string") return NextResponse.json({ ok: true })
  const shown = (typeof before.shown === "number" && Number.isFinite(before.shown) ? before.shown : 0) + 1
  const now = new Date().toISOString()
  const next = action === "done" ? { shown, done_at: now } : { shown, later_at: now }

  const { error } = await admin
    .from("profiles")
    .update({ metadata: { ...existing, claude_events_popup: next } })
    .eq("id", session.context.userId)
  if (error) return NextResponse.json({ error: "Couldn't save" }, { status: 500 })
  return NextResponse.json({ ok: true })
}
