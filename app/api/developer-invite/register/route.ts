import { NextRequest, NextResponse } from "next/server"
import { createAdminSupabase } from "@/lib/admin-supabase"
import {
  resolveInviteToken,
  resolveChosenDeveloper,
  createOrFindInviteDeveloper,
  claimInvite,
  releaseInviteClaim,
  type InviteDeveloper,
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
    newDeveloperName?: unknown
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
  const developerId = typeof body?.developerId === "string" ? body.developerId : null
  const newDeveloperName = typeof body?.newDeveloperName === "string" ? body.newDeveloperName.trim() : ""

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

  // Determine the developer. A bound link fixes it; a generic link either picks
  // an existing one (scope-checked) or creates a new one ("can't find yours").
  // Fail fast on an obviously bad choice; defer create-new until AFTER the auth
  // user exists so a failed sign-up doesn't leave an orphan developer.
  const wantsNewDeveloper = !config.developer && !developerId && newDeveloperName.length > 0
  let developer: InviteDeveloper | null = null
  if (!wantsNewDeveloper) {
    developer = await resolveChosenDeveloper(config, developerId)
    if (!developer) {
      return NextResponse.json({ error: "Please choose a valid developer." }, { status: 400 })
    }
  } else if (newDeveloperName.length < 2 || newDeveloperName.length > 120) {
    return NextResponse.json({ error: "Enter a developer name between 2 and 120 characters." }, { status: 400 })
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

  // Create-new developer (deferred): the auth user now exists, so an orphan
  // developer isn't possible from a dup-email failure above. Track whether we
  // inserted a fresh row so a later failure can roll it back (never delete a
  // deduped existing developer).
  let developerWasCreated = false
  if (wantsNewDeveloper) {
    const result = await createOrFindInviteDeveloper(newDeveloperName)
    if (!result) {
      await admin.auth.admin.deleteUser(userId)
      await releaseInviteClaim(config.id)
      return NextResponse.json({ error: "Could not create the developer. Please try again." }, { status: 500 })
    }
    developer = result.developer
    developerWasCreated = result.created
  }
  if (!developer) {
    // Unreachable (both branches above set it or return), but keeps types sound.
    await admin.auth.admin.deleteUser(userId)
    await releaseInviteClaim(config.id)
    return NextResponse.json({ error: "Please choose a valid developer." }, { status: 400 })
  }

  // Roll back everything provisioned so far, including a just-created developer
  // (but not a deduped existing one), so a failed redemption leaves nothing behind.
  const rollback = async () => {
    if (developerWasCreated && developer) {
      await admin.from("developers").delete().eq("id", developer.id)
    }
    await admin.auth.admin.deleteUser(userId)
    await releaseInviteClaim(config.id)
  }

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
        // NB: do NOT stamp metadata.invited_by here. That field is the personal
        // "My recruits" / downline attribution (set by the ?ref= invite flow);
        // developer-invite registrations are tracked solely by developer_invite_id
        // (see /api/admin/developer-invites/[id]/recruits). Stamping invited_by
        // would leak these developers into the link creator's personal recruits.
      },
    })
    .eq("id", userId)

  if (profileError) {
    // Roll back the auth user, a just-created developer, and the invite claim.
    await rollback()
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
