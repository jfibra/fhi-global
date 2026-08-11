import { NextRequest, NextResponse } from "next/server"
import { after } from "next/server"
import { revalidatePath } from "next/cache"
import { requireRole } from "@/lib/auth-guard"
import { ROLES_ADMIN_STAFF } from "@/lib/app-roles"
import { createAdminSupabase } from "@/lib/admin-supabase"
import { logAuditEvent, requestContextFromRequest } from "@/lib/audit-log"
import { SITE_URL } from "@/lib/seo"
import { submitToIndexNow } from "@/lib/indexnow"

// Admin edit / soft-delete / restore of any agent's listing. Service-role
// (bypasses the owner-only RLS on agent_listings) + super_admin/admin guard.
// Every mutation is recorded in audit_logs with the real admin as actor.

export const runtime = "nodejs"

const STATUSES = new Set(["draft", "published", "archived"])
const KINDS = new Set(["sale", "rent"])
const EDITABLE = ["title", "description", "listing_kind", "status", "unit_type", "price", "currency"] as const

type ExistingListing = {
  id: string
  slug: string | null
  agent_id: string
  project_id: number | null
  title: string
  description: string | null
  listing_kind: string
  status: string
  unit_type: string | null
  price: number | null
  currency: string
  deleted_at: string | null
}

function actorFrom(ctx: { userId: string; email: string | null; profile: { role: string | null; fullname: string | null } }) {
  return { id: ctx.userId, name: ctx.profile.fullname ?? ctx.email ?? null, role: ctx.profile.role }
}

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const guard = await requireRole([...ROLES_ADMIN_STAFF])
  if (!guard.ok) return guard.response
  const { id } = await context.params

  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const title = String(body.title ?? "").trim()
  const listingKind = String(body.listing_kind ?? "")
  const status = String(body.status ?? "")
  if (!title) return NextResponse.json({ error: "Title is required." }, { status: 400 })
  if (!KINDS.has(listingKind)) return NextResponse.json({ error: "Invalid listing type." }, { status: 400 })
  if (!STATUSES.has(status)) return NextResponse.json({ error: "Invalid status." }, { status: 400 })

  const admin = createAdminSupabase()
  const { data: existing, error: fetchErr } = await admin
    .from("agent_listings")
    .select("id, slug, agent_id, project_id, title, description, listing_kind, status, unit_type, price, currency, is_featured, deleted_at")
    .eq("id", id)
    .maybeSingle<ExistingListing>()

  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 })
  if (!existing) return NextResponse.json({ error: "Listing not found." }, { status: 404 })

  const update: Record<string, unknown> = {
    title,
    description: String(body.description ?? "").trim() || null,
    listing_kind: listingKind,
    status,
    unit_type: String(body.unit_type ?? "").trim() || null,
    updated_at: new Date().toISOString(),
  }
  // Project-linked listings inherit price/currency from the developer project —
  // only standalone listings expose an editable price.
  if (existing.project_id == null) {
    const rawPrice = body.price
    const price = rawPrice === null || rawPrice === undefined || rawPrice === "" ? null : Number(rawPrice)
    update.price = price != null && Number.isFinite(price) ? price : null
    update.currency = (String(body.currency ?? existing.currency ?? "AED").trim() || "AED").toUpperCase()
  }

  const { error: updateErr } = await admin.from("agent_listings").update(update).eq("id", id)
  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

  // Diff of the editable fields that actually changed, for the activity log.
  const oldValues: Record<string, unknown> = {}
  const newValues: Record<string, unknown> = {}
  const changedKeys: string[] = []
  for (const key of EDITABLE) {
    if (!(key in update)) continue
    const before = existing[key as keyof ExistingListing] ?? null
    const after = update[key] ?? null
    if (before !== after) {
      oldValues[key] = before
      newValues[key] = after
      changedKeys.push(key)
    }
  }

  if (changedKeys.length > 0) {
    await logAuditEvent({
      category: "listings",
      event: "updated",
      source: "dashboard",
      actor: actorFrom(guard.context),
      subjectType: "agent_listings",
      subjectId: id,
      subjectLabel: title,
      description: `Edited listing "${title}" (${changedKeys.join(", ")})`,
      oldValues,
      newValues,
      changedKeys,
      ...requestContextFromRequest(req),
    })
  }

  // Purge the public page immediately and, when live, ping IndexNow after the
  // response is sent (after() keeps the serverless function alive).
  const publicPath = `/listings/${existing.slug ?? existing.id}`
  revalidatePath(publicPath)
  if (status === "published" && !existing.deleted_at) {
    const loc = `${SITE_URL.replace(/\/$/, "")}${publicPath}`
    after(() => submitToIndexNow([loc]))
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const guard = await requireRole([...ROLES_ADMIN_STAFF])
  if (!guard.ok) return guard.response
  const { id } = await context.params
  const restore = req.nextUrl.searchParams.get("restore") === "1"

  const admin = createAdminSupabase()
  const { data: existing, error: fetchErr } = await admin
    .from("agent_listings")
    .select("id, title, deleted_at")
    .eq("id", id)
    .maybeSingle<{ id: string; title: string; deleted_at: string | null }>()

  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 })
  if (!existing) return NextResponse.json({ error: "Listing not found." }, { status: 404 })

  const now = new Date().toISOString()
  const { error: updateErr } = await admin
    .from("agent_listings")
    .update({ deleted_at: restore ? null : now, updated_at: now })
    .eq("id", id)
  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

  await logAuditEvent({
    category: "listings",
    event: restore ? "restored" : "deleted",
    source: "dashboard",
    actor: actorFrom(guard.context),
    subjectType: "agent_listings",
    subjectId: id,
    subjectLabel: existing.title,
    description: `${restore ? "Restored" : "Deleted"} listing "${existing.title}"`,
    ...requestContextFromRequest(req),
  })

  return NextResponse.json({ ok: true })
}
