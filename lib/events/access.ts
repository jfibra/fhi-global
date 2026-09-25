import { NextResponse } from "next/server"
import type { SupabaseClient } from "@supabase/supabase-js"
import { requireActiveSession, type GuardResult } from "@/lib/auth-guard"
import { canManageEvents, canManageOwnEvents } from "@/lib/app-roles"

/**
 * Who a dashboard events request acts for (migration 057):
 *   · all — admin staff: every event, company and agents' own.
 *   · own — Website Builder users: only events whose agent_id is theirs.
 * Every app/api/admin/events route and the event upload route go through
 * requireEventAccess(); an "own" caller is pinned to their events by
 * canAccessEvent() / the agent_id filter, never by what the client sends.
 */
export type EventScope = { kind: "all" } | { kind: "own"; agentId: string }

export async function requireEventAccess(): Promise<
  | { ok: true; context: GuardResult; scope: EventScope }
  | { ok: false; response: NextResponse }
> {
  const session = await requireActiveSession()
  if (!session.ok) return { ok: false, response: session.response }
  const { role } = session.context.profile
  if (canManageEvents(role)) return { ok: true, context: session.context, scope: { kind: "all" } }
  if (canManageOwnEvents(role)) {
    return { ok: true, context: session.context, scope: { kind: "own", agentId: session.context.userId } }
  }
  return { ok: false, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) }
}

/**
 * May this caller act on the event? Admin staff: yes (unchanged behaviour —
 * the route does its own existence checks). An owner: only a live event they
 * own; anything else answers as if it didn't exist.
 */
export async function canAccessEvent(admin: SupabaseClient, eventId: string, scope: EventScope): Promise<boolean> {
  if (scope.kind === "all") return true
  const { data, error } = await admin
    .from("events")
    .select("id")
    .eq("id", eventId)
    .eq("agent_id", scope.agentId)
    .is("deleted_at", null)
    .maybeSingle()
  return !error && Boolean(data)
}

/** 404 for an event this caller may not touch — never reveals that it exists. */
export const eventNotFound = () => NextResponse.json({ error: "Event not found" }, { status: 404 })

/** An agent's Website Builder site, or null when they haven't created one yet. */
export async function agentWebsite(
  admin: SupabaseClient,
  agentId: string,
): Promise<{ slug: string; isPublished: boolean } | null> {
  const { data, error } = await admin
    .from("website_builder")
    .select("slug, is_published")
    .eq("agent_id", agentId)
    .maybeSingle()
  if (error || !data) return null
  return { slug: data.slug as string, isPublished: data.is_published !== false }
}

/** agent_id → published site slug, for handing each listed event its public path. */
export async function publishedSiteSlugs(admin: SupabaseClient, agentIds: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  const ids = [...new Set(agentIds.filter(Boolean))]
  if (ids.length === 0) return out
  const { data } = await admin
    .from("website_builder")
    .select("agent_id, slug")
    .in("agent_id", ids)
    .eq("is_published", true)
  for (const row of data ?? []) out.set(String(row.agent_id), String(row.slug))
  return out
}
