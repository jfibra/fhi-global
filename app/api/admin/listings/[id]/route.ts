import { NextRequest, NextResponse } from "next/server"
import { after } from "next/server"
import { revalidatePath, revalidateTag } from "next/cache"
import { requireRole } from "@/lib/auth-guard"
import { ROLES_ADMIN_STAFF } from "@/lib/app-roles"
import { createAdminSupabase } from "@/lib/admin-supabase"
import { logAuditEvent, requestContextFromRequest } from "@/lib/audit-log"
import { SITE_URL } from "@/lib/seo"
import { submitToIndexNow } from "@/lib/indexnow"
import { isLiveProject, isTestRecord, listingIssuesMessage, listingPublishIssues } from "@/lib/listing-publish-checks"

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

/**
 * Drop every cached view of a listing — its slug page, the legacy uuid page, the /buy and /rent lists — and,
 * when `announce`, tell IndexNow both URLs changed (a removal is announced the same way as a publish: the
 * protocol takes "this URL changed" and a dead page then leaves Bing's index promptly).
 */
function purgeListing(listing: { id: string; slug: string | null }, announce: boolean) {
  revalidatePath(`/listings/${listing.slug ?? listing.id}`)
  if (listing.slug) revalidatePath(`/listings/${listing.id}`)
  revalidatePath("/buy")
  revalidatePath("/rent")
  // /buy and /rent keep their agent-listing cards under this tag for 120 s.
  revalidateTag("agent-listings", { expire: 0 })
  if (announce) {
    const base = SITE_URL.replace(/\/$/, "")
    const urls = [`${base}/listings/${listing.slug ?? listing.id}`, ...(listing.slug ? [`${base}/listings/${listing.id}`] : [])]
    after(() => submitToIndexNow(urls))
  }
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

  // Going live needs the same checklist the agents' own form runs. Admins get no
  // override (they can still save as Draft): the test listing that reached the
  // sitemap was exactly the kind of record this exists to stop.
  if (status === "published" && existing.status !== "published") {
    const [{ count: ownPhotos }, { data: project }, { count: projectGalleryPhotos }] = await Promise.all([
      admin.from("agent_listing_images").select("id", { count: "exact", head: true }).eq("listing_id", id),
      existing.project_id != null
        ? admin
            .from("projects")
            .select("name, main_image, is_published, is_active, deleted_at")
            .eq("id", existing.project_id)
            .maybeSingle<{ name: string | null; main_image: string | null; is_published: boolean | null; is_active: boolean | null; deleted_at: string | null }>()
        : Promise.resolve({ data: null }),
      // The public page also shows the project's gallery, so a project with gallery photos but no cover still counts.
      existing.project_id != null
        ? admin.from("project_images").select("id", { count: "exact", head: true }).eq("project_id", existing.project_id)
        : Promise.resolve({ count: 0 }),
    ])
    const description = String(body.description ?? "").trim() || null
    const rawPrice = body.price
    const price = existing.project_id == null && rawPrice !== null && rawPrice !== undefined && rawPrice !== "" ? Number(rawPrice) : existing.price
    const issues = listingPublishIssues({
      title,
      description,
      listingKind: listingKind as "sale" | "rent",
      hasProject: existing.project_id != null,
      projectName: project?.name ?? null,
      projectLive: existing.project_id == null ? undefined : isLiveProject(project),
      ownPhotoCount: ownPhotos ?? 0,
      projectHasPhoto: Boolean(project?.main_image?.trim()) || (projectGalleryPhotos ?? 0) > 0,
      price: Number.isFinite(price) ? price : null,
    })
    if (issues.length > 0) {
      return NextResponse.json({ error: listingIssuesMessage(issues), issues }, { status: 422 })
    }
  } else if (status === "published" && !existing.deleted_at && isTestRecord({ title }) && !isTestRecord({ title: existing.title })) {
    // A listing that is already live is never held to the full checklist (routine edits must go through), but a
    // rename INTO test wording is how a real listing turns into the junk record this gate exists to stop.
    return NextResponse.json(
      { error: "That title looks like test data — rename it, or move the listing to Draft." },
      { status: 422 },
    )
  }

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

  // Purge the public page and the /buy and /rent lists at once; IndexNow is told after the response is sent
  // (after() keeps the serverless function alive) whenever the page is, or just stopped being, public — so an
  // admin's unpublish is announced as a removal, which the old code skipped.
  purgeListing(existing, !existing.deleted_at && (status === "published" || existing.status === "published"))

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
    .select("id, slug, title, status, deleted_at")
    .eq("id", id)
    .maybeSingle<{ id: string; slug: string | null; title: string; status: string; deleted_at: string | null }>()

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

  // The public page, the lists and the sitemap must follow at once, not after the 120 s revalidate: purge
  // them and tell IndexNow the URL changed (it accepts removed URLs — a deleted listing should not linger in
  // Bing's index). A restore of a published listing is announced too: the page is back.
  purgeListing(existing, existing.status === "published")

  return NextResponse.json({ ok: true })
}
