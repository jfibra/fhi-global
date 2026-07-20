import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminSupabase } from "@/lib/admin-supabase"
import { lookupLrAgent, parseName, resolveGoogleRole } from "@/lib/lr/lr-api"
import { pickSafePostLoginRedirect } from "@/lib/auth"

// Completes Google sign-in AFTER the client established the Supabase session via
// signInWithIdToken. Runs as the newly-signed-in user (cookie session), reads
// their Supabase-verified email, re-looks up LR, and — only on the first link —
// provisions the profile (role/status/name/metadata) with the service-role
// client (RLS blocks client writes to role/status). Idempotent and safe for
// returning users and for pre-existing email/password accounts.

export const runtime = "nodejs"

type ProfileRow = {
  role: string | null
  status: string | null
  fname: string | null
  lname: string | null
  profile_url: string | null
  metadata: Record<string, unknown> | null
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as { next?: unknown } | null
  const nextRaw = typeof body?.next === "string" ? body.next : null

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

  const result = await lookupLrAgent(email)
  const lr = result.kind === "agent" ? result.agent : null
  // LR couldn't be reached — the answer is unknown. Don't stamp the flag so the
  // next sign-in retries instead of permanently downgrading a real agent.
  const lrUnreachable = result.kind === "error"

  const googleName = typeof user.user_metadata?.name === "string" ? user.user_metadata.name : null
  const parsed = parseName(lr?.name ?? googleName)

  const googleGiven = typeof user.user_metadata?.given_name === "string" ? user.user_metadata.given_name.trim() : ""
  const googleFamily = typeof user.user_metadata?.family_name === "string" ? user.user_metadata.family_name.trim() : ""
  const googleAvatar =
    typeof user.user_metadata?.avatar_url === "string"
      ? user.user_metadata.avatar_url
      : typeof user.user_metadata?.picture === "string"
        ? user.user_metadata.picture
        : null

  const fname = parsed.first || googleGiven || profile.fname || null
  const lname = parsed.last || googleFamily || profile.lname || null
  const profileUrl = profile.profile_url || googleAvatar || null

  const lrMetadata = lr
    ? {
        lr_agent_id: lr.agentId,
        lr_role_id: lr.roleId,
        lr_role_label: lr.roleLabel,
        lr_state: lr.state,
        lr_mobile: lr.mobile,
        lr_team: lr.teamName,
        lr_upline: lr.uplineName,
        lr_verification: lr.verification,
        lr_status: lr.status,
      }
    : {}

  // Decide role/status (first link only; returning users returned above). An
  // un-curated `member` (self-registration / new-user default) is upgraded to
  // the LR role; any deliberately-assigned role is preserved (never
  // overridden/downgraded). Activate only when we actually apply an LR role to
  // a member; otherwise keep the account's existing status (member/pending for
  // brand-new accounts, whatever an admin set for curated ones).
  const finalRole = resolveGoogleRole(profile.role, lr)
  const upgradedMember = lr != null && (profile.role ?? "member") === "member"
  const finalStatus = upgradedMember ? "active" : profile.status ?? "pending"

  const nextMetadata = {
    ...metadata,
    ...lrMetadata,
    google_linked: true,
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

  return NextResponse.json({ redirect: pickSafePostLoginRedirect(nextRaw, finalRole) })
}
