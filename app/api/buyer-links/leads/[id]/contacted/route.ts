import { NextRequest, NextResponse } from "next/server"
import { requireActiveSession } from "@/lib/auth-guard"
import { createAdminSupabase } from "@/lib/admin-supabase"
import { canUseBuyerLinks } from "@/lib/app-roles"

/**
 * Lead follow-up (boss via Juliecor, 2026-11-12): an agent marks one of THEIR
 * OWN Buyers Link / Sellers Link briefs as contacted, or takes the mark off.
 * The Buyers Link page's button and FHI Assistant's "mark Maria as contacted"
 * both land here. Service role, but the row must carry the caller's agent_id
 * — nobody can mark somebody else's lead (migration 088, contacted_at).
 *
 *   POST /api/buyer-links/leads/<id>/contacted   { contacted: true | false }
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireActiveSession()
  if (!session.ok) return session.response
  if (!canUseBuyerLinks(session.context.profile.role)) return NextResponse.json({ error: "Not allowed" }, { status: 403 })
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Which lead?" }, { status: 400 })
  const body = (await req.json().catch(() => null)) as { contacted?: unknown } | null
  const contacted = body?.contacted !== false

  const admin = createAdminSupabase()
  const { data, error } = await admin
    .from("buyer_link_leads")
    .update({ contacted_at: contacted ? new Date().toISOString() : null })
    .eq("id", id)
    .eq("agent_id", session.context.userId)
    .select("id, contacted_at")
    .maybeSingle<{ id: string; contacted_at: string | null }>()
  if (error) return NextResponse.json({ error: "Couldn't save" }, { status: 500 })
  if (!data) return NextResponse.json({ error: "That lead isn't yours." }, { status: 404 })
  return NextResponse.json({ ok: true, contacted_at: data.contacted_at })
}
