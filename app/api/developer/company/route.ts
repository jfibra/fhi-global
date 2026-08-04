import { NextRequest, NextResponse } from "next/server"
import { requireActiveSession } from "@/lib/auth-guard"
import { createAdminSupabase } from "@/lib/admin-supabase"
import { logAuditEvent, requestContextFromRequest } from "@/lib/audit-log"

export const runtime = "nodejs"

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
}

type Body = {
  name?: string
  slug?: string
  description?: string
  website_url?: string
  phone?: string
  email?: string
  address?: string
}

// PATCH /api/developer/company — a developer edits THEIR OWN linked company.
// Runs on the service-role client after verifying ownership via the caller's
// profile.metadata.developer_id, so it works regardless of table RLS (this is
// why the fields — including slug — were effectively read-only before). Non-slug
// fields save immediately; a slug change is stored as pending_slug for admin
// approval and does NOT change the live public URL until approved.
export async function PATCH(req: NextRequest) {
  const guard = await requireActiveSession()
  if (!guard.ok) return guard.response

  const meta = guard.context.profile.metadata ?? {}
  const developerId = typeof meta.developer_id === "string" ? meta.developer_id.trim() : ""
  if (!developerId) {
    return NextResponse.json({ error: "No developer company is linked to your account." }, { status: 400 })
  }

  const body = (await req.json()) as Body
  const name = String(body.name ?? "").trim()
  if (!name) return NextResponse.json({ error: "Company name is required." }, { status: 400 })

  const admin = createAdminSupabase()
  const { data: dev, error: loadErr } = await admin
    .from("developers")
    .select("id, name, slug, pending_slug")
    .eq("id", developerId)
    .is("deleted_at", null)
    .single()
  if (loadErr || !dev) {
    return NextResponse.json({ error: "Your linked developer company was not found." }, { status: 404 })
  }

  const update: Record<string, unknown> = {
    name,
    description: String(body.description ?? "").trim() || null,
    website_url: String(body.website_url ?? "").trim() || null,
    phone: String(body.phone ?? "").trim() || null,
    email: String(body.email ?? "").trim() || null,
    address: String(body.address ?? "").trim() || null,
  }

  const requestedSlug = slugify(String(body.slug ?? ""))
  let slugRequested = false

  if (requestedSlug && requestedSlug !== dev.slug) {
    // Reject a slug already used by another live developer (the live slug is the
    // one that must stay unique; a duplicate pending is re-checked at approval).
    const { data: clash } = await admin
      .from("developers")
      .select("id")
      .ilike("slug", requestedSlug)
      .neq("id", developerId)
      .is("deleted_at", null)
      .maybeSingle()
    if (clash) {
      return NextResponse.json({ error: "That slug is already taken by another developer." }, { status: 409 })
    }
    update.pending_slug = requestedSlug
    update.pending_slug_at = new Date().toISOString()
    update.pending_slug_by = guard.context.userId
    slugRequested = true
  } else {
    // Unchanged, or reverted back to the live slug → drop any outstanding request.
    update.pending_slug = null
    update.pending_slug_at = null
    update.pending_slug_by = null
  }

  const { data: updated, error: updErr } = await admin
    .from("developers")
    .update(update)
    .eq("id", developerId)
    .select()
    .single()
  if (updErr || !updated) {
    return NextResponse.json({ error: updErr?.message ?? "Failed to save company information." }, { status: 500 })
  }

  await logAuditEvent({
    category: "user_management",
    event: slugRequested ? "slug_change_requested" : "updated",
    source: "dashboard",
    actor: { id: guard.context.userId, name: guard.context.profile.fullname, role: guard.context.profile.role },
    subjectType: "developers",
    subjectId: developerId,
    subjectLabel: name,
    description: slugRequested
      ? `Requested slug change ${dev.slug} → ${requestedSlug} (pending approval)`
      : "Updated company information",
    ...requestContextFromRequest(req),
  })

  return NextResponse.json({ developer: updated, slugRequested })
}
