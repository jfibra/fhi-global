import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

// OAuth redirect landing. Supabase sends the browser here with ?code=... after
// Google sign-in; we exchange it for a cookie session, then hand off to
// /auth/google/continue which shows the Leuterio Realty account modal and
// provisions the profile. `next` (a safe relative post-login target) is
// threaded through.

export const runtime = "nodejs"

export async function GET(req: NextRequest) {
  const url = req.nextUrl
  const code = url.searchParams.get("code")
  const next = url.searchParams.get("next") ?? ""
  const oauthError = url.searchParams.get("error_description") || url.searchParams.get("error")

  if (oauthError) {
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(oauthError)}`, url.origin))
  }
  if (!code) {
    return NextResponse.redirect(new URL("/login?error=missing_code", url.origin))
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)
  if (error) {
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(error.message)}`, url.origin))
  }

  const continueUrl = new URL("/auth/google/continue", url.origin)
  if (next) continueUrl.searchParams.set("next", next)
  return NextResponse.redirect(continueUrl)
}
