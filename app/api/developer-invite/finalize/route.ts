import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminSupabase } from "@/lib/admin-supabase"
import {
  resolveInviteToken,
  resolveChosenDeveloper,
  claimInvite,
  releaseInviteClaim,
} from "@/lib/developer-invites"
import { parseName } from "@/lib/lr/lr-api"
import { logAuditEvent, requestContextFromRequest } from "@/lib/audit-log"

// Google one-click redemption. Runs AFTER the OAuth round-trip established the
// session (the invitee is signed in as their Google account). LR-free by
// design: it never calls resolveGoogleRole, so an invitee whose Gmail is a
// Leuterio Realty agent is still provisioned as a developer, not an agent.

export const runtime = "nodejs"

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as { token?: unknown; developerId?: unknown } | null
  const token = typeof body?.token === "string" ? body.token : ""

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

  const developer = await resolveChosenDeveloper(
    config,
    typeof body?.developerId === "string" ? body.developerId : null,
  )
  if (!developer) {
    return NextResponse.json({ error: "Please choose a valid developer." }, { status: 400 })
  }

  const claim = await claimInvite(token)
  if (!claim) {
    return NextResponse.json({ error: "This invite link is no longer available." }, { status: 410 })
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
    await releaseInviteClaim(config.id)
    return NextResponse.json({ error: "Could not finish setting up your account." }, { status: 500 })
  }
  if (!updated || updated.length === 0) {
    // A concurrent request already provisioned this account — refund our claim.
    await releaseInviteClaim(config.id)
    return NextResponse.json({ redirect: config.autoActivate ? "/dashboard/developer" : "/account-inactive" })
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
  // "awaiting approval" page instead of bouncing through proxy.ts.
  return NextResponse.json({ redirect: config.autoActivate ? "/dashboard/developer" : "/account-inactive" })
}
