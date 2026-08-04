import { NextRequest, NextResponse } from "next/server"
import { requireRole } from "@/lib/auth-guard"
import { ROLES_ADMIN_STAFF } from "@/lib/app-roles"
import { createAdminSupabase } from "@/lib/admin-supabase"
import { logAuditEvent, requestContextFromRequest } from "@/lib/audit-log"

export const runtime = "nodejs"

type Body = { action?: "approve" | "reject" }

// POST /api/admin/developers/[id]/slug — admin reviews a developer's pending
// slug-change request. approve → copy pending_slug to slug (re-checking
// uniqueness) and clear the request; reject → just clear the request.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireRole([...ROLES_ADMIN_STAFF])
  if (!guard.ok) return guard.response

  const { id } = await params
  const { action } = (await req.json()) as Body
  if (action !== "approve" && action !== "reject") {
    return NextResponse.json({ error: "Invalid action." }, { status: 400 })
  }

  const admin = createAdminSupabase()
  const { data: dev, error: loadErr } = await admin
    .from("developers")
    .select("id, name, slug, pending_slug")
    .eq("id", id)
    .is("deleted_at", null)
    .single()
  if (loadErr || !dev) {
    return NextResponse.json({ error: "Developer not found." }, { status: 404 })
  }
  if (!dev.pending_slug) {
    return NextResponse.json({ error: "No pending slug change for this developer." }, { status: 400 })
  }

  const clearPending = { pending_slug: null, pending_slug_at: null, pending_slug_by: null }

  if (action === "reject") {
    const { data: updated, error } = await admin
      .from("developers")
      .update(clearPending)
      .eq("id", id)
      .select()
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    await logAuditEvent({
      category: "user_management",
      event: "slug_change_rejected",
      source: "dashboard",
      actor: { id: guard.context.userId, name: guard.context.profile.fullname, role: guard.context.profile.role },
      subjectType: "developers",
      subjectId: id,
      subjectLabel: dev.name,
      description: `Rejected slug change ${dev.slug} → ${dev.pending_slug}`,
      ...requestContextFromRequest(req),
    })
    return NextResponse.json({ developer: updated })
  }

  // approve — re-check the requested slug is still free before switching the URL.
  const { data: clash } = await admin
    .from("developers")
    .select("id")
    .ilike("slug", dev.pending_slug)
    .neq("id", id)
    .is("deleted_at", null)
    .maybeSingle()
  if (clash) {
    return NextResponse.json(
      { error: `"${dev.pending_slug}" is now taken by another developer. Ask them to choose a different slug.` },
      { status: 409 },
    )
  }

  const { data: updated, error } = await admin
    .from("developers")
    .update({ slug: dev.pending_slug, ...clearPending })
    .eq("id", id)
    .select()
    .single()
  if (error) {
    // A unique-violation race on the slug index surfaces here.
    const dup = error.code === "23505"
    return NextResponse.json(
      { error: dup ? "That slug was just taken by another developer." : error.message },
      { status: dup ? 409 : 500 },
    )
  }

  await logAuditEvent({
    category: "user_management",
    event: "slug_change_approved",
    source: "dashboard",
    actor: { id: guard.context.userId, name: guard.context.profile.fullname, role: guard.context.profile.role },
    subjectType: "developers",
    subjectId: id,
    subjectLabel: dev.name,
    description: `Approved slug change ${dev.slug} → ${dev.pending_slug}`,
    changedKeys: ["slug"],
    ...requestContextFromRequest(req),
  })
  return NextResponse.json({ developer: updated })
}
