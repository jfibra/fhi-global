import { NextRequest, NextResponse } from "next/server"
import { isAdminStaffRole, isKnownAppRoleId } from "@/lib/app-roles"
import { createClient } from "@/lib/supabase/server"
import { createAdminSupabase } from "@/lib/admin-supabase"
import type { UpdateUserPayload } from "@/lib/user-service"
import { logAuditEvent, requestContextFromRequest } from "@/lib/audit-log"

type AdminCaller = { id: string; name: string | null; role: string | null }

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function requireAdmin(): Promise<AdminCaller | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, fullname")
    .eq("id", user.id)
    .single()
  if (!profile || !isAdminStaffRole(profile.role)) return null
  return { id: user.id, name: profile.fullname ?? user.email ?? null, role: profile.role }
}

// ─── GET /api/admin/users/[id] ─────────────────────────────────────────────────
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const caller = await requireAdmin()
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const admin = createAdminSupabase()

  const [{ data: profile }, { data: authData }] = await Promise.all([
    admin.from("profiles").select("*").eq("id", id).single(),
    admin.auth.admin.getUserById(id),
  ])

  if (!profile) return NextResponse.json({ error: "User not found" }, { status: 404 })

  return NextResponse.json({
    ...profile,
    email: authData?.user?.email ?? null,
  })
}

// ─── PATCH /api/admin/users/[id] ───────────────────────────────────────────────
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const caller = await requireAdmin()
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const body = (await req.json()) as UpdateUserPayload

  if (body.role !== undefined) {
    const r = String(body.role).toLowerCase().trim()
    if (!isKnownAppRoleId(r)) {
      return NextResponse.json(
        { error: `Invalid role "${r}". Use a role defined in the app and in public.user_roles.` },
        { status: 400 },
      )
    }
  }

  const admin = createAdminSupabase()

  // Snapshot the target before the change so audit rows can show old→new and a
  // human subject label.
  const { data: before } = await admin
    .from("profiles")
    .select("role, status, fullname")
    .eq("id", id)
    .maybeSingle<{ role: string | null; status: string | null; fullname: string | null }>()

  // Build profile update payload
  const profileUpdate: Record<string, unknown> = {}

  if (body.fname      !== undefined) profileUpdate.fname      = body.fname || null
  if (body.mname      !== undefined) profileUpdate.mname      = body.mname || null
  if (body.lname      !== undefined) profileUpdate.lname      = body.lname || null
  if (body.birthday   !== undefined) profileUpdate.birthday   = body.birthday || null
  if (body.gender     !== undefined) profileUpdate.gender     = body.gender || null
  if (body.timezone   !== undefined) profileUpdate.timezone   = body.timezone
  if (body.role       !== undefined) profileUpdate.role       = body.role
  if (body.status     !== undefined) {
    profileUpdate.status = body.status
    // Activating restores a soft-deleted user: clearing the soft-delete flags
    // is required, otherwise isInactiveProfile (status !== 'active' ||
    // is_deleted) still blocks login and the row keeps showing "Deleted".
    if (String(body.status).toLowerCase().trim() === "active") {
      profileUpdate.is_deleted = false
      profileUpdate.deleted_at = null
    }
  }

  // Rebuild fullname when name parts change
  if (body.fname !== undefined || body.mname !== undefined || body.lname !== undefined) {
    const { data: current } = await admin.from("profiles").select("fname,mname,lname").eq("id", id).single()
    const fname = body.fname ?? current?.fname ?? ""
    const mname = body.mname ?? current?.mname ?? ""
    const lname = body.lname ?? current?.lname ?? ""
    profileUpdate.fullname = [fname, mname, lname].filter(Boolean).join(" ")
  }

  // Metadata merge for phone/whatsapp + developer link + referrer (invited_by)
  const metaKeys = [
    "phone_country_code", "phone_number", "whatsapp_country_code", "whatsapp_number",
    "nationality", "linkedin", "facebook", "license_number",
  ] as const
  const hasMeta = metaKeys.some((k) => body[k] !== undefined)
  const hasDeveloperLink = body.developer_id !== undefined
  const hasRoleUpdate = body.role !== undefined
  const hasInvitedBy = body.invited_by !== undefined

  // Referrer change is tracked for the audit trail (set inside the block below).
  let referrerBefore: string | null = null
  let referrerAfter: string | null = null
  let referrerChanged = false

  if (hasMeta || hasDeveloperLink || hasRoleUpdate || hasInvitedBy) {
    const { data: current } = await admin
      .from("profiles")
      .select("metadata, role")
      .eq("id", id)
      .single<{ metadata: Record<string, unknown> | null; role: string | null }>()

    const nextMetadata: Record<string, unknown> = {
      ...(current?.metadata ?? {}),
      ...Object.fromEntries(metaKeys.filter((k) => body[k] !== undefined).map((k) => [k, body[k]])),
    }

    const nextRole = String(body.role ?? current?.role ?? "").toLowerCase().trim()
    const requestedDeveloperId = typeof body.developer_id === "string" && body.developer_id.trim()
      ? body.developer_id.trim()
      : null

    if (nextRole === "developer") {
      const developerIdToUse = body.developer_id !== undefined
        ? requestedDeveloperId
        : (typeof nextMetadata.developer_id === "string" ? nextMetadata.developer_id : null)

      if (!developerIdToUse) {
        return NextResponse.json({ error: "Developer link is required for developer role." }, { status: 400 })
      }

      const { data: linkedDeveloper, error: developerError } = await admin
        .from("developers")
        .select("id")
        .eq("id", developerIdToUse)
        .is("deleted_at", null)
        .single()

      if (developerError || !linkedDeveloper) {
        return NextResponse.json({ error: "Selected developer was not found." }, { status: 400 })
      }

      nextMetadata.developer_id = developerIdToUse
    } else {
      nextMetadata.developer_id = null
    }

    // Referrer (invited_by): set/change/clear who invited this user. Same
    // metadata key the invite link stamps at registration — this lets admins
    // fix attribution for people who registered directly (no ?ref link).
    if (hasInvitedBy) {
      const currentInvitedBy = typeof nextMetadata.invited_by === "string" && nextMetadata.invited_by.trim()
        ? nextMetadata.invited_by.trim()
        : null
      const raw = typeof body.invited_by === "string" ? body.invited_by.trim() : ""

      if (raw !== (currentInvitedBy ?? "")) {
        if (!raw) {
          // Clear referrer.
          nextMetadata.invited_by = null
          referrerBefore = currentInvitedBy
          referrerAfter = null
          referrerChanged = true
        } else {
          if (!UUID_RE.test(raw)) {
            return NextResponse.json({ error: "Referrer id is not a valid user id." }, { status: 400 })
          }
          if (raw === id) {
            return NextResponse.json({ error: "A user can't be their own referrer." }, { status: 400 })
          }
          const { data: referrer } = await admin
            .from("profiles")
            .select("id, is_deleted")
            .eq("id", raw)
            .maybeSingle<{ id: string; is_deleted: boolean | null }>()
          if (!referrer || referrer.is_deleted === true) {
            return NextResponse.json({ error: "Selected referrer was not found." }, { status: 400 })
          }
          nextMetadata.invited_by = raw
          referrerBefore = currentInvitedBy
          referrerAfter = raw
          referrerChanged = true
        }
      }
    }

    profileUpdate.metadata = nextMetadata
  }

  const { error } = await admin.from("profiles").update(profileUpdate).eq("id", id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Audit (app-level, carries the human admin + IP). The profiles trigger also
  // records the raw data diff as "System"; these rows add who/where/why for the
  // sensitive transitions.
  const ctx = requestContextFromRequest(req)
  const actor = caller
  const subjectLabel = before?.fullname ?? null
  const newRole = body.role !== undefined ? String(body.role).toLowerCase().trim() : undefined
  const newStatus = body.status !== undefined ? String(body.status).toLowerCase().trim() : undefined

  if (newRole && newRole !== (before?.role ?? null)) {
    await logAuditEvent({
      category: "security",
      event: "role_granted",
      source: "dashboard",
      actor,
      subjectType: "profiles",
      subjectId: id,
      subjectLabel,
      description: `Changed role ${before?.role ?? "—"} → ${newRole}`,
      oldValues: { role: before?.role ?? null },
      newValues: { role: newRole },
      changedKeys: ["role"],
      ...ctx,
    })
  }
  if (newStatus && newStatus !== (before?.status ?? null)) {
    await logAuditEvent({
      category: "user_management",
      event: newStatus === "active" ? "activated" : "deactivated",
      source: "dashboard",
      actor,
      subjectType: "profiles",
      subjectId: id,
      subjectLabel,
      description: `Set status ${before?.status ?? "—"} → ${newStatus}`,
      oldValues: { status: before?.status ?? null },
      newValues: { status: newStatus },
      changedKeys: ["status"],
      ...ctx,
    })
  }

  if (referrerChanged) {
    await logAuditEvent({
      category: "user_management",
      event: "updated",
      source: "dashboard",
      actor,
      subjectType: "profiles",
      subjectId: id,
      subjectLabel,
      description: `Changed referrer ${referrerBefore ?? "—"} → ${referrerAfter ?? "—"}`,
      oldValues: { invited_by: referrerBefore },
      newValues: { invited_by: referrerAfter },
      changedKeys: ["invited_by"],
      ...ctx,
    })
  }

  return NextResponse.json({ ok: true })
}

// ─── DELETE /api/admin/users/[id] ──────────────────────────────────────────────
// Default: soft delete (hide + deactivate, recoverable via Activate/Restore).
// ?hard=1: permanent delete — removes the auth user (freeing the email for
// re-registration) and the profile. Only allowed on an already soft-deleted
// user, so it's a deliberate two-step action.
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const caller = await requireAdmin()
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const admin = createAdminSupabase()
  const hard = req.nextUrl.searchParams.get("hard") === "1"

  if (hard) {
    if (id === caller.id) {
      return NextResponse.json({ error: "You can't permanently delete your own account." }, { status: 400 })
    }

    // Two-step safety: a user must be soft-deleted first.
    const { data: prof } = await admin
      .from("profiles")
      .select("is_deleted, fullname, role, metadata")
      .eq("id", id)
      .maybeSingle<{ is_deleted: boolean | null; fullname: string | null; role: string | null; metadata: Record<string, unknown> | null }>()
    if (prof && prof.is_deleted !== true) {
      return NextResponse.json(
        { error: "Soft-delete the user first, then permanently delete." },
        { status: 400 },
      )
    }

    // Delete the auth user — this frees the email. A profiles FK with ON DELETE
    // CASCADE removes the profile row too; delete it explicitly as a fallback.
    // If the user still owns data (listings, sales, …) the FK blocks this and
    // the error is surfaced so the admin knows to reassign/remove it first.
    const { error: authErr } = await admin.auth.admin.deleteUser(id)
    if (authErr) {
      return NextResponse.json(
        { error: `Could not permanently delete this account: ${authErr.message}` },
        { status: 500 },
      )
    }
    await admin.from("profiles").delete().eq("id", id)

    // If this account was created by redeeming a developer invite link, free the
    // slot it consumed (use_count -1, clamped at 0). Best-effort — a permanent
    // deletion should never be blocked by invite accounting. Only on hard delete:
    // a soft delete is recoverable, so its slot must stay reserved.
    const inviteId =
      prof?.metadata && typeof prof.metadata.developer_invite_id === "string"
        ? prof.metadata.developer_invite_id
        : null
    if (inviteId) {
      try {
        await admin.rpc("release_developer_invite", { _id: inviteId })
      } catch {
        /* best-effort */
      }
    }

    // The profiles trigger can't record this (the row is gone) — the app row is
    // the only trace of a permanent deletion, so it's high-value.
    await logAuditEvent({
      category: "security",
      event: "hard_deleted",
      source: "dashboard",
      actor: caller,
      subjectType: "profiles",
      subjectId: id,
      subjectLabel: prof?.fullname ?? null,
      description: `Permanently deleted user ${prof?.fullname ?? id} (${prof?.role ?? "—"})`,
      ...requestContextFromRequest(req),
    })

    return NextResponse.json({ ok: true, hard: true })
  }

  // Soft delete (default).
  const { data: target } = await admin
    .from("profiles")
    .select("fullname, role")
    .eq("id", id)
    .maybeSingle<{ fullname: string | null; role: string | null }>()

  const { error } = await admin
    .from("profiles")
    .update({
      is_deleted: true,
      deleted_at: new Date().toISOString(),
      status: "inactive",
    })
    .eq("id", id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logAuditEvent({
    category: "user_management",
    event: "deleted",
    source: "dashboard",
    actor: caller,
    subjectType: "profiles",
    subjectId: id,
    subjectLabel: target?.fullname ?? null,
    description: `Soft-deleted user ${target?.fullname ?? id}`,
    ...requestContextFromRequest(req),
  })

  return NextResponse.json({ ok: true })
}
