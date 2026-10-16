import "server-only"

import { NextResponse } from "next/server"
import { requireActiveSession } from "@/lib/auth-guard"
import { ROLES_ADMIN_STAFF, ROLES_AGENT_ASSISTANT, roleInList } from "@/lib/app-roles"

/**
 * FHI Assistant conversation history (migration 081) — shared by
 * app/api/assistant/conversations and its [id] route. A conversation belongs
 * to one person and one assistant: "admin" (admin staff) or "agent" (agents
 * and team leaders; admins previewing it too). Every query is filtered by the
 * session's user id, so nobody can read or change another person's chats.
 */

export type Audience = "admin" | "agent"
export const MAX_STORED_MESSAGES = 80
export const MAX_CONVERSATIONS_LISTED = 60

export function audienceOf(v: unknown): Audience | null {
  return v === "admin" || v === "agent" ? v : null
}

/** The session, refused unless the caller may use that assistant. */
export async function conversationSession(audience: Audience): Promise<{ ok: true; userId: string } | { ok: false; response: NextResponse }> {
  const session = await requireActiveSession()
  if (!session.ok) return { ok: false, response: session.response }
  const role = session.context.profile.role
  const allowed = audience === "admin" ? roleInList(role, ROLES_ADMIN_STAFF) : roleInList(role, [...ROLES_AGENT_ASSISTANT, ...ROLES_ADMIN_STAFF])
  if (!allowed) return { ok: false, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) }
  return { ok: true, userId: session.context.userId }
}

/** "Give me the full report for the last 7 days" → a short list title. */
export function titleFrom(text: string): string {
  const t = text.replace(/\s+/g, " ").trim()
  if (!t) return "New chat"
  return t.length > 60 ? `${t.slice(0, 59).trimEnd()}…` : t
}

/** Keep only the parts of a message the page renders; cap the thread. */
export function cleanMessages(raw: unknown): unknown[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((m): m is Record<string, unknown> => !!m && typeof m === "object" && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .filter((m) => !m.streaming)
    .slice(-MAX_STORED_MESSAGES)
}
