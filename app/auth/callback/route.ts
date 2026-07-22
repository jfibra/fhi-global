import { NextRequest, NextResponse } from "next/server"
import type { User } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/server"
import { createAdminSupabase } from "@/lib/admin-supabase"
import { parseName } from "@/lib/lr/lr-api"
import { logAuditEvent, requestContextFromRequest } from "@/lib/audit-log"

// OAuth redirect landing. Supabase sends the browser here with ?code=... after
// Google sign-in; we exchange it for a cookie session, then hand off to
// /auth/google/continue which shows the Leuterio Realty account modal and
// provisions the profile. `next` (a safe relative post-login target) is
// threaded through.

export const runtime = "nodejs"

// The handle_new_user trigger reads first_name/last_name metadata (the
// email/password register shape), which Google OAuth doesn't send — Google uses
// full_name/name/given_name/family_name. So Google accounts are created with a
// blank name, and if the user never completes the confirmation modal the admin
// list falls back to showing their email. Backfill the name here (runs for
// every Google sign-in, before the modal) so it's always populated.
async function backfillGoogleName(user: User) {
  const meta = user.user_metadata ?? {}
  const gName =
    typeof meta.full_name === "string" ? meta.full_name : typeof meta.name === "string" ? meta.name : ""
  const gGiven = typeof meta.given_name === "string" ? meta.given_name.trim() : ""
  const gFamily = typeof meta.family_name === "string" ? meta.family_name.trim() : ""
  const parsed = parseName(gName)
  const fname = parsed.first || gGiven || null
  const lname = parsed.last || gFamily || null
  const avatar =
    typeof meta.avatar_url === "string" ? meta.avatar_url : typeof meta.picture === "string" ? meta.picture : null
  if (!fname && !lname && !avatar) return

  const admin = createAdminSupabase()
  const { data: profile } = await admin
    .from("profiles")
    .select("fname, lname, profile_url")
    .eq("id", user.id)
    .maybeSingle<{ fname: string | null; lname: string | null; profile_url: string | null }>()

  const nameBlank = !profile?.fname?.trim() && !profile?.lname?.trim()
  const update: Record<string, unknown> = {}
  if (nameBlank && fname) update.fname = fname
  if (nameBlank && lname) update.lname = lname
  if (!profile?.profile_url && avatar) update.profile_url = avatar
  if (Object.keys(update).length > 0) {
    await admin.from("profiles").update(update).eq("id", user.id)
  }
}

export async function GET(req: NextRequest) {
  const url = req.nextUrl
  const code = url.searchParams.get("code")
  const next = url.searchParams.get("next") ?? ""
  // Referral/invite id — threaded through from the register page's Google button
  // so the continue → finalize step can credit the inviter.
  const ref = url.searchParams.get("ref") ?? ""
  // Developer-invite token (+ chosen developer for generic links) — threaded
  // from the /join Google button. Routes to the LR-free developer finalize.
  const devInvite = url.searchParams.get("dev_invite") ?? ""
  const dev = url.searchParams.get("dev") ?? ""
  // "Can't find your developer — create one" name, threaded from the /join
  // Google button when the registrant is creating a new developer company.
  const devNew = url.searchParams.get("dev_new") ?? ""
  const oauthError = url.searchParams.get("error_description") || url.searchParams.get("error")

  if (oauthError) {
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(oauthError)}`, url.origin))
  }
  if (!code) {
    return NextResponse.redirect(new URL("/login?error=missing_code", url.origin))
  }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.exchangeCodeForSession(code)
  if (error) {
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(error.message)}`, url.origin))
  }

  if (data.user) {
    // Best-effort — never block sign-in on a name backfill failure.
    try {
      await backfillGoogleName(data.user)
    } catch {
      /* ignore */
    }
    const meta = data.user.user_metadata ?? {}
    const name =
      (typeof meta.full_name === "string" && meta.full_name) ||
      (typeof meta.name === "string" && meta.name) ||
      data.user.email ||
      null
    const ctx = requestContextFromRequest(req)
    await logAuditEvent({
      category: "auth",
      event: "login",
      source: "auth",
      actor: { id: data.user.id, name, role: null },
      description: "Signed in with Google",
      ...ctx,
    })
  }

  // Developer-invite Google flow → LR-free continue (never the agent-provisioning path).
  if (devInvite) {
    const joinUrl = new URL("/join/continue", url.origin)
    joinUrl.searchParams.set("dev_invite", devInvite)
    if (dev) joinUrl.searchParams.set("dev", dev)
    if (devNew) joinUrl.searchParams.set("dev_new", devNew)
    return NextResponse.redirect(joinUrl)
  }

  const continueUrl = new URL("/auth/google/continue", url.origin)
  if (next) continueUrl.searchParams.set("next", next)
  if (ref) continueUrl.searchParams.set("ref", ref)
  return NextResponse.redirect(continueUrl)
}
