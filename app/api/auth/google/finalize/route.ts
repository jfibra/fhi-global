import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminSupabase } from "@/lib/admin-supabase"
import { resolveLrProvision } from "@/lib/lr/lr-provision"
import { pickSafePostLoginRedirect } from "@/lib/auth"
import { logAuditEvent, requestContextFromRequest } from "@/lib/audit-log"

// Completes Google sign-in AFTER the client established the Supabase session via
// signInWithIdToken. Runs as the newly-signed-in user (cookie session), reads
// their Supabase-verified email, re-looks up LR, and — only on the first link —
// provisions the profile (role/status/name/metadata) with the service-role
// client (RLS blocks client writes to role/status). Idempotent and safe for
// returning users and for pre-existing email/password accounts.

export const runtime = "nodejs"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

type ProfileRow = {
  role: string | null
  status: string | null
  fname: string | null
  lname: string | null
  profile_url: string | null
  metadata: Record<string, unknown> | null
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as { next?: unknown; ref?: unknown } | null
  const nextRaw = typeof body?.next === "string" ? body.next : null
  // Referral/invite id from the register page's Google button. Attribution is
  // best-effort and only applied on first provision (see below).
  const refRaw = typeof body?.ref === "string" ? body.ref.trim() : ""

  // Must be signed in (the client just did signInWithIdToken).
  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()
  const user = userData.user
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const email = (user.email ?? "").toLowerCase()
  const admin = createAdminSupabase()

  // Load the profile (the handle_new_user trigger creates a default row on auth
  // user creation; fall back to an insert if it somehow doesn't exist yet).
  let { data: profile } = await admin
    .from("profiles")
    .select("role, status, fname, lname, profile_url, metadata")
    .eq("id", user.id)
    .maybeSingle<ProfileRow>()

  if (!profile) {
    await admin.from("profiles").insert({ id: user.id })
    const reloaded = await admin
      .from("profiles")
      .select("role, status, fname, lname, profile_url, metadata")
      .eq("id", user.id)
      .maybeSingle<ProfileRow>()
    profile = reloaded.data ?? { role: null, status: null, fname: null, lname: null, profile_url: null, metadata: {} }
  }

  const metadata = (profile.metadata ?? {}) as Record<string, unknown>

  // Returning Google user: never re-map (respects later admin role changes).
  if (metadata.google_provisioned === true) {
    return NextResponse.json({ redirect: pickSafePostLoginRedirect(nextRaw, profile.role) })
  }

  const googleName = typeof user.user_metadata?.name === "string" ? user.user_metadata.name : null

  // Shared LR provisioning: look up the LR agent and decide role/status/metadata.
  // (Same logic the email-OTP register flow uses — see lib/lr/lr-provision.ts.)
  const prov = await resolveLrProvision({
    email,
    currentRole: profile.role,
    currentStatus: profile.status,
    nameHint: googleName,
  })
  const lrIsAgent = prov.isLrAgent
  const lrUnreachable = prov.lrUnreachable
  const lrMetadata = prov.lrMetadata
  const finalRole = prov.role
  const finalStatus = prov.status

  const googleGiven = typeof user.user_metadata?.given_name === "string" ? user.user_metadata.given_name.trim() : ""
  const googleFamily = typeof user.user_metadata?.family_name === "string" ? user.user_metadata.family_name.trim() : ""
  const googleAvatar =
    typeof user.user_metadata?.avatar_url === "string"
      ? user.user_metadata.avatar_url
      : typeof user.user_metadata?.picture === "string"
        ? user.user_metadata.picture
        : null

  const fname = prov.parsedName.first || googleGiven || profile.fname || null
  const lname = prov.parsedName.last || googleFamily || profile.lname || null
  const profileUrl = profile.profile_url || googleAvatar || null

  // Referral attribution — mirror the email/password register flow: validate the
  // ref is a real, non-deleted profile that isn't the user themselves, and only
  // stamp it if attribution isn't already recorded. First provision only (this
  // whole block is skipped for returning google_provisioned users above).
  let invitedBy: string | null = null
  if (refRaw && UUID_RE.test(refRaw) && refRaw !== user.id && typeof metadata.invited_by !== "string") {
    const { data: inviter } = await admin
      .from("profiles")
      .select("id")
      .eq("id", refRaw)
      .eq("is_deleted", false)
      .maybeSingle()
    if (inviter) invitedBy = refRaw
  }

  const nextMetadata = {
    ...metadata,
    ...lrMetadata,
    google_linked: true,
    ...(invitedBy ? { invited_by: invitedBy } : {}),
    ...(lrUnreachable ? {} : { google_provisioned: true }),
  }

  const { error: updateError } = await admin
    .from("profiles")
    .update({
      role: finalRole,
      status: finalStatus,
      fname,
      lname,
      profile_url: profileUrl,
      metadata: nextMetadata,
    })
    .eq("id", user.id)

  if (updateError) {
    // Fail closed — the account stays at the least-privilege default rather than
    // returning an optimistic redirect for a role we didn't actually persist.
    return NextResponse.json(
      { error: "Could not finish setting up your account. Please try again." },
      { status: 500 },
    )
  }

  // Security-relevant: first-link provisioning applied a role/status. The
  // profiles trigger records the data change (as "System"); this row names the
  // event, carries request info, and flags a genuine privilege elevation.
  const roleElevated = finalRole !== (profile.role ?? "member") && finalRole !== "member"
  const displayName = [fname, lname].filter(Boolean).join(" ") || user.email || null
  const ctx = requestContextFromRequest(req)
  await logAuditEvent({
    category: "security",
    event: roleElevated ? "role_granted" : "user_provisioned",
    source: "auth",
    actor: { id: user.id, name: displayName, role: finalRole },
    subjectType: "profiles",
    subjectId: user.id,
    subjectLabel: displayName,
    description: lrIsAgent
      ? `Google sign-in linked Leuterio Realty agent → ${finalRole}`
      : `Google sign-in provisioned account → ${finalRole}`,
    oldValues: { role: profile.role ?? null, status: profile.status ?? null },
    newValues: { role: finalRole, status: finalStatus },
    changedKeys: ["role", "status"],
    ...ctx,
  })

  return NextResponse.json({ redirect: pickSafePostLoginRedirect(nextRaw, finalRole) })
}
