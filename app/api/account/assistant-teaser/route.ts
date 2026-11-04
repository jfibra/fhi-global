import { NextResponse } from "next/server"
import { requireActiveSession } from "@/lib/auth-guard"
import { createAdminSupabase } from "@/lib/admin-supabase"
import { ROLES_AGENT_ASSISTANT, isAdminStaffRole, roleInList } from "@/lib/app-roles"

/**
 * Someone with an FHI Assistant (agent, team leader, admin staff) closed its teaser pop-up
 * (AssistantTeaserPopup) — record it on their own profile (metadata.assistant_teaser_seen_at) so it is shown
 * once per account, not once per device. Merges just that field; a second call keeps the first date.
 */
export async function POST() {
  const session = await requireActiveSession()
  if (!session.ok) return session.response
  const role = session.context.profile.role
  if (!roleInList(role, ROLES_AGENT_ASSISTANT) && !isAdminStaffRole(role)) {
    return NextResponse.json({ error: "Only FHI Assistant users see this" }, { status: 403 })
  }

  const admin = createAdminSupabase()
  const { data: current, error: readError } = await admin
    .from("profiles")
    .select("metadata")
    .eq("id", session.context.userId)
    .maybeSingle<{ metadata: Record<string, unknown> | null }>()
  if (readError) return NextResponse.json({ error: "Couldn't save" }, { status: 500 })

  const existing = current?.metadata ?? {}
  if (typeof existing.assistant_teaser_seen_at === "string") return NextResponse.json({ ok: true })

  const { error } = await admin
    .from("profiles")
    .update({ metadata: { ...existing, assistant_teaser_seen_at: new Date().toISOString() } })
    .eq("id", session.context.userId)
  if (error) return NextResponse.json({ error: "Couldn't save" }, { status: 500 })
  return NextResponse.json({ ok: true })
}
