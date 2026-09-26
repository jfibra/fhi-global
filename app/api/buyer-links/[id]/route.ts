import { NextRequest, NextResponse } from "next/server"
import { requireRole } from "@/lib/auth-guard"
import { ROLES_BUYER_LINK_OWNERS } from "@/lib/app-roles"
import { createAdminSupabase } from "@/lib/admin-supabase"
import { BUYER_LINK_COLUMNS } from "@/lib/buyer-links"

// Pause, re-activate or delete one of the signed-in agent's Buyers Links. A
// paused link keeps its clients and just stops taking new ones; deleting one
// removes its clients too (the dashboard asks first). Owner only.

export const runtime = "nodejs"

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const guard = await requireRole([...ROLES_BUYER_LINK_OWNERS])
  if (!guard.ok) return guard.response
  const { id } = await context.params

  let body: { isActive?: unknown }
  try {
    body = (await req.json()) as { isActive?: unknown }
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 })
  }
  if (typeof body.isActive !== "boolean") return NextResponse.json({ error: "Nothing to change." }, { status: 400 })

  const admin = createAdminSupabase()
  const { data, error } = await admin
    .from("buyer_links")
    .update({ is_active: body.isActive, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("agent_id", guard.context.userId)
    .select(BUYER_LINK_COLUMNS)
    .maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: "Link not found." }, { status: 404 })
  return NextResponse.json({ link: data })
}

export async function DELETE(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const guard = await requireRole([...ROLES_BUYER_LINK_OWNERS])
  if (!guard.ok) return guard.response
  const { id } = await context.params

  const admin = createAdminSupabase()
  // Its clients go with it (ON DELETE CASCADE, migration 060).
  const { data, error } = await admin
    .from("buyer_links")
    .delete()
    .eq("id", id)
    .eq("agent_id", guard.context.userId)
    .select("id")
    .maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: "Link not found." }, { status: 404 })
  return NextResponse.json({ ok: true })
}
