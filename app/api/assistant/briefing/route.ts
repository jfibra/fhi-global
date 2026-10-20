import { NextRequest, NextResponse } from "next/server"
import { requireRole } from "@/lib/auth-guard"
import { ROLES_ADMIN_STAFF, ROLES_AGENT_ASSISTANT } from "@/lib/app-roles"
import { adminBriefing, agentBriefing } from "@/lib/assistant-briefing"

/**
 * GET ?audience=admin|agent — the "Today at a glance" tiles on FHI
 * Assistant's welcome screen (lib/assistant-briefing.ts). The admin briefing
 * is company-wide and admin staff only; the agent one is always the signed-in
 * person's own (their leads, sales, rank, team), never anyone else's.
 */

export const runtime = "nodejs"

export async function GET(req: NextRequest) {
  const audience = req.nextUrl.searchParams.get("audience") === "agent" ? "agent" : "admin"
  const session = await requireRole(audience === "admin" ? [...ROLES_ADMIN_STAFF] : [...ROLES_AGENT_ASSISTANT, ...ROLES_ADMIN_STAFF])
  if (!session.ok) return session.response
  const { userId, profile } = session.context
  try {
    const items = audience === "admin" ? await adminBriefing() : await agentBriefing({ userId, name: profile.fullname, role: profile.role })
    return NextResponse.json({ items }, { headers: { "Cache-Control": "private, no-store" } })
  } catch {
    return NextResponse.json({ error: "Couldn't load today's briefing." }, { status: 500 })
  }
}
