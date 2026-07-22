import { NextRequest, NextResponse } from "next/server"
import { requireRole } from "@/lib/auth-guard"
import { ROLES_ADMIN_STAFF } from "@/lib/app-roles"
import { createAdminSupabase } from "@/lib/admin-supabase"
import { generateInviteToken } from "@/lib/developer-invites"
import { logAuditEvent, requestContextFromRequest } from "@/lib/audit-log"
import { SITE_URL } from "@/lib/seo"

// Admin management of developer invite links. Admin/super-admin only; all writes
// via the service-role client (the table's only RLS policy is admin SELECT).

export const runtime = "nodejs"

const EXPIRY_DAYS = new Set([1, 7, 30])

function inviteUrl(token: string): string {
  return `${SITE_URL.replace(/\/$/, "")}/join/${token}`
}

export async function GET() {
  const guard = await requireRole([...ROLES_ADMIN_STAFF])
  if (!guard.ok) return guard.response

  const admin = createAdminSupabase()
  const { data, error } = await admin
    .from("developer_invites")
    .select(
      "id, token, developer_id, label, auto_activate, expires_at, max_uses, use_count, is_active, created_at, developers ( name, logo_url, is_active, deleted_at )",
    )
    .is("deleted_at", null)
    .order("created_at", { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const now = Date.now()
  const invites = (data ?? []).map((row) => {
    const r = row as typeof row & {
      developers: { name: string; logo_url: string | null; is_active: boolean; deleted_at: string | null } | null
    }
    const expired = r.expires_at != null && new Date(r.expires_at).getTime() <= now
    const usedUp = r.max_uses != null && r.use_count >= r.max_uses
    // A bound link whose developer was later deactivated/deleted no longer
    // redeems (resolveInviteToken returns invalid) — surface that here so the
    // admin isn't shown a dead link as "active".
    const deadDeveloper = r.developer_id != null && (!r.developers || !r.developers.is_active || r.developers.deleted_at != null)
    const status = !r.is_active
      ? "revoked"
      : deadDeveloper
        ? "invalid"
        : expired
          ? "expired"
          : usedUp
            ? "used_up"
            : "active"
    return {
      id: r.id,
      url: inviteUrl(r.token),
      developer: r.developers ? { name: r.developers.name, logo_url: r.developers.logo_url } : null,
      label: r.label,
      autoActivate: r.auto_activate,
      expiresAt: r.expires_at,
      maxUses: r.max_uses,
      useCount: r.use_count,
      isActive: r.is_active,
      status,
      createdAt: r.created_at,
    }
  })

  return NextResponse.json({ invites })
}

export async function POST(req: NextRequest) {
  const guard = await requireRole([...ROLES_ADMIN_STAFF])
  if (!guard.ok) return guard.response

  const body = (await req.json().catch(() => null)) as {
    developerId?: unknown
    label?: unknown
    autoActivate?: unknown
    expiresInDays?: unknown
    maxUses?: unknown
  } | null

  const admin = createAdminSupabase()

  // Validate pre-bound developer (if any).
  let developerId: string | null = null
  if (typeof body?.developerId === "string" && body.developerId.trim()) {
    developerId = body.developerId.trim()
    const { data: dev } = await admin
      .from("developers")
      .select("id")
      .eq("id", developerId)
      .is("deleted_at", null)
      .eq("is_active", true)
      .maybeSingle()
    if (!dev) return NextResponse.json({ error: "Selected developer was not found." }, { status: 400 })
  }

  const autoActivate = body?.autoActivate !== false // default ON
  const label = typeof body?.label === "string" && body.label.trim() ? body.label.trim() : null

  let expiresAt: string | null = null
  if (typeof body?.expiresInDays === "number" && EXPIRY_DAYS.has(body.expiresInDays)) {
    expiresAt = new Date(Date.now() + body.expiresInDays * 24 * 60 * 60 * 1000).toISOString()
  }

  let maxUses: number | null = null
  if (typeof body?.maxUses === "number" && Number.isInteger(body.maxUses) && body.maxUses > 0) {
    maxUses = body.maxUses
  }

  // Insert with unique-collision retry on the token.
  let inserted: { id: string; token: string } | null = null
  for (let attempt = 0; attempt < 5 && !inserted; attempt++) {
    const token = generateInviteToken()
    const { data, error } = await admin
      .from("developer_invites")
      .insert({
        token,
        developer_id: developerId,
        created_by: guard.context.userId,
        label,
        auto_activate: autoActivate,
        expires_at: expiresAt,
        max_uses: maxUses,
      })
      .select("id, token")
      .single()
    if (!error && data) {
      inserted = data
    } else if (error && error.code !== "23505") {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
  }
  if (!inserted) {
    return NextResponse.json({ error: "Could not generate a unique invite. Try again." }, { status: 500 })
  }

  await logAuditEvent({
    category: "developers",
    event: "created",
    source: "dashboard",
    actor: { id: guard.context.userId, name: guard.context.profile.fullname, role: guard.context.profile.role },
    subjectType: "developer_invites",
    subjectId: inserted.id,
    subjectLabel: label ?? "Developer invite link",
    description: `Created developer invite link${developerId ? " (pre-bound)" : " (generic)"}, ${autoActivate ? "auto-activate" : "needs approval"}`,
    newValues: { developer_id: developerId, auto_activate: autoActivate, expires_at: expiresAt, max_uses: maxUses },
    ...requestContextFromRequest(req),
  })

  return NextResponse.json({ id: inserted.id, url: inviteUrl(inserted.token) }, { status: 201 })
}
