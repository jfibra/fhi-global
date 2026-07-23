import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminSupabase } from "@/lib/admin-supabase"
import {
  resolveInviteToken,
  resolveChosenDeveloper,
  createOrFindInviteDeveloper,
  claimInvite,
  releaseInviteClaim,
  type InviteDeveloper,
} from "@/lib/developer-invites"
import { parseName } from "@/lib/lr/lr-api"
import { getDashboardRouteByRole } from "@/lib/auth"
import { logAuditEvent, requestContextFromRequest } from "@/lib/audit-log"

// Google one-click redemption. Runs AFTER the OAuth round-trip established the
// session (the invitee is signed in as their Google account). LR-free by
// design: it never calls resolveGoogleRole, so an invitee whose Gmail is a
// Leuterio Realty agent is still provisioned as a developer, not an agent.

export const runtime = "nodejs"

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as {
    token?: unknown
    developerId?: unknown
    newDeveloperName?: unknown
  } | null
  const token = typeof body?.token === "string" ? body.token : ""
  const developerId = typeof body?.developerId === "string" ? body.developerId : null
  const newDeveloperName = typeof body?.newDeveloperName === "string" ? body.newDeveloperName.trim() : ""

  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()
  const user = userData.user
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

  const admin = createAdminSupabase()
  const { data: profile } = await admin
    .from("profiles")
    .select("role, status, fname, lname, profile_url, metadata")
    .eq("id", user.id)
    .maybeSingle<{
      role: string | null
      status: string | null
      fname: string | null
      lname: string | null
      profile_url: string | null
      metadata: Record<string, unknown> | null
    }>()

  const meta = profile?.metadata ?? {}
  // Guard: an account that's already been provisioned (Google-linked before, or
  // given a curated non-member role) must not be silently rebound to a
  // developer — and we must NOT consume an invite use for it.
  const curatedRole = profile?.role && profile.role !== "member"
  if (meta.google_provisioned === true || curatedRole) {
    return NextResponse.json(
      { error: "This Google account already belongs to an FHI user. Sign in instead." },
      { status: 409 },
    )
  }

  const resolved = await resolveInviteToken(token)
  if (resolved.status !== "valid") {
    return NextResponse.json({ error: "This invite link is no longer valid.", reason: resolved.status }, { status: 410 })
  }
  const config = resolved.config

  // Determine the developer: bound link fixes it; generic link picks an existing
  // one (scope-checked) or creates a new one ("can't find yours"). Fail fast on
  // a bad choice; defer create-new until after the claim succeeds.
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

  const claim = await claimInvite(token)
  if (!claim) {
    return NextResponse.json({ error: "This invite link is no longer available." }, { status: 410 })
  }

  let developerWasCreated = false
  if (wantsNewDeveloper) {
    const result = await createOrFindInviteDeveloper(newDeveloperName)
    if (!result) {
      await releaseInviteClaim(config.id)
      return NextResponse.json({ error: "Could not create the developer. Please try again." }, { status: 500 })
    }
    developer = result.developer
    developerWasCreated = result.created
  }
  if (!developer) {
    // Unreachable, but keeps types sound.
    await releaseInviteClaim(config.id)
    return NextResponse.json({ error: "Please choose a valid developer." }, { status: 400 })
  }

  // Refund the claim and drop a just-created developer (never a deduped existing
  // one) when provisioning doesn't complete, so no orphan developer is left.
  const abandon = async () => {
    if (developerWasCreated && developer) {
      await admin.from("developers").delete().eq("id", developer.id)
    }
    await releaseInviteClaim(config.id)
  }

  // Name/avatar from the Google identity (backfilled onto the profile by the
  // callback, but re-derive here so first-link is complete).
  const gmeta = user.user_metadata ?? {}
  const googleName =
    (typeof gmeta.full_name === "string" && gmeta.full_name) ||
    (typeof gmeta.name === "string" && gmeta.name) ||
    ""
  const parsed = parseName(googleName)
  const fname = profile?.fname || parsed.first || (typeof gmeta.given_name === "string" ? gmeta.given_name : null)
  const lname = profile?.lname || parsed.last || (typeof gmeta.family_name === "string" ? gmeta.family_name : null)
  const avatar =
    profile?.profile_url ||
    (typeof gmeta.avatar_url === "string" ? gmeta.avatar_url : typeof gmeta.picture === "string" ? gmeta.picture : null)
  const status = config.autoActivate ? "active" : "pending"

  // Provision only if the row is still an un-provisioned member. This makes the
  // whole flow idempotent: N concurrent finalize requests for the same account
  // all claim, but only the first wins this conditional UPDATE (role flips to
  // 'developer'); the losers match zero rows, release their claim, and 409 — so
  // one invitee can't burn multiple slots on a max_uses link.
  const { data: updated, error: updateError } = await admin
    .from("profiles")
    .update({
      role: "developer",
      status,
      fname,
      lname,
      profile_url: avatar,
      metadata: {
        ...meta,
        developer_id: developer.id,
        developer_invite_id: config.id,
        ...(config.createdBy ? { invited_by: config.createdBy } : {}),
        google_linked: true,
        google_provisioned: true,
      },
    })
    .eq("id", user.id)
    .eq("role", "member")
    .select("id")

  if (updateError) {
    await abandon()
    return NextResponse.json({ error: "Could not finish setting up your account." }, { status: 500 })
  }
  if (!updated || updated.length === 0) {
    // A concurrent request already provisioned this account — refund our claim
    // and drop the developer we just created (the winning request has its own).
    await abandon()
    return NextResponse.json({ redirect: config.autoActivate ? getDashboardRouteByRole("developer") : "/account-inactive" })
  }

  await logAuditEvent({
    category: "security",
    event: "user_provisioned",
    source: "auth",
    actor: { id: user.id, name: [fname, lname].filter(Boolean).join(" ") || user.email || null, role: "developer" },
    subjectType: "profiles",
    subjectId: user.id,
    subjectLabel: [fname, lname].filter(Boolean).join(" ") || user.email || null,
    description: `Google-registered as developer for ${developer.name} via invite link (${status})`,
    newValues: { role: "developer", status, developer_id: developer.id },
    ...requestContextFromRequest(req),
  })

  // Pending accounts can't reach the dashboard — send them to the friendly
  // "awaiting approval" page instead of bouncing through proxy.ts. Active
  // accounts go to the developer dashboard via the canonical role→path helper
  // (the routes moved from /dashboard/* to /<role>/* in the (users) restructure).
  return NextResponse.json({ redirect: config.autoActivate ? getDashboardRouteByRole("developer") : "/account-inactive" })
}
