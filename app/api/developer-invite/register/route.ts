import { NextRequest, NextResponse } from "next/server"
import { createAdminSupabase } from "@/lib/admin-supabase"
import {
  resolveInviteToken,
  resolveChosenDeveloper,
  claimInvite,
  releaseInviteClaim,
} from "@/lib/developer-invites"
import { logAuditEvent, requestContextFromRequest } from "@/lib/audit-log"

// Manual (password) redemption of a developer invite link. Public — no session.
// Order matters: validate → scope-check → atomically claim → create auth user →
// link profile. On a post-claim failure we release the claim so the slot isn't
// lost.

export const runtime = "nodejs"

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as {
    token?: unknown
    developerId?: unknown
    firstName?: unknown
    lastName?: unknown
    email?: unknown
    password?: unknown
  } | null

  const token = typeof body?.token === "string" ? body.token : ""
  const firstName = typeof body?.firstName === "string" ? body.firstName.trim() : ""
  const lastName = typeof body?.lastName === "string" ? body.lastName.trim() : ""
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : ""
  const password = typeof body?.password === "string" ? body.password : ""

  if (!firstName || !lastName || !email || !password) {
    return NextResponse.json({ error: "All fields are required." }, { status: 400 })
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 })
  }

  const resolved = await resolveInviteToken(token)
  if (resolved.status !== "valid") {
    return NextResponse.json({ error: "This invite link is no longer valid.", reason: resolved.status }, { status: 410 })
  }
  const config = resolved.config

  const developer = await resolveChosenDeveloper(
    config,
    typeof body?.developerId === "string" ? body.developerId : null,
  )
  if (!developer) {
    return NextResponse.json({ error: "Please choose a valid developer." }, { status: 400 })
  }

  // Atomically claim a use (guards expiry/max/revoked against races).
  const claim = await claimInvite(token)
  if (!claim) {
    return NextResponse.json({ error: "This invite link is no longer available." }, { status: 410 })
  }

  const admin = createAdminSupabase()
  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { first_name: firstName, last_name: lastName, account_type: "developer" },
  })

  if (authError || !authData?.user) {
    await releaseInviteClaim(config.id)
    const msg = /already been registered|already registered|exists/i.test(authError?.message ?? "")
      ? "An account with this email already exists."
      : authError?.message ?? "Failed to create account."
    return NextResponse.json({ error: msg }, { status: 409 })
  }

  const userId = authData.user.id
  const status = config.autoActivate ? "active" : "pending"

  // Merge (never overwrite) the trigger-seeded metadata.
  const { data: existing } = await admin
    .from("profiles")
    .select("metadata")
    .eq("id", userId)
    .maybeSingle<{ metadata: Record<string, unknown> | null }>()

  const { error: profileError } = await admin
    .from("profiles")
    .update({
      role: "developer",
      status,
      fname: firstName,
      lname: lastName,
      metadata: {
        ...(existing?.metadata ?? {}),
        developer_id: developer.id,
        developer_invite_id: config.id,
        ...(config.createdBy ? { invited_by: config.createdBy } : {}),
      },
    })
    .eq("id", userId)

  if (profileError) {
    // Roll back the orphaned auth user + release the claim.
    await admin.auth.admin.deleteUser(userId)
    await releaseInviteClaim(config.id)
    return NextResponse.json({ error: profileError.message }, { status: 500 })
  }

  await logAuditEvent({
    category: "auth",
    event: "register",
    source: "auth",
    actor: { id: userId, name: `${firstName} ${lastName}`.trim(), role: "developer" },
    subjectType: "profiles",
    subjectId: userId,
    subjectLabel: `${firstName} ${lastName}`.trim(),
    description: `Registered as developer for ${developer.name} via invite link (${status})`,
    newValues: { role: "developer", status, developer_id: developer.id },
    ...requestContextFromRequest(req),
  })

  return NextResponse.json({ success: true, autoActivate: config.autoActivate })
}
