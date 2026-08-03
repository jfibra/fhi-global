import { NextResponse } from "next/server"

// GONE — the manual (password) redemption of developer invite links.
//
// /join/<token> now redeems with email OTP (app/join/[token]/actions.ts) or
// Google (/api/developer-invite/finalize), matching the rest of the app's
// passwordless sign-in. This route is kept as an explicit 410 rather than
// deleted so an old tab that still has the form gets a clear answer instead
// of a confusing 404 — and so the password path can't quietly come back.

export async function POST() {
  return NextResponse.json(
    { error: "This registration method was retired. Open your invite link again and use the email code or Google." },
    { status: 410 },
  )
}
