import { NextRequest, NextResponse } from "next/server"
import { createClient as createSupabaseClient } from "@supabase/supabase-js"
import { requireActiveSession } from "@/lib/auth-guard"
import { createAdminSupabase } from "@/lib/admin-supabase"
import { logAuditEvent, requestContextFromRequest } from "@/lib/audit-log"

export const runtime = "nodejs"

// ─── POST /api/account/password ─────────────────────────────────────────────────
// Self-service password change for the signed-in user. Requires the current
// password (verified against Supabase Auth) before setting a new one, so a stolen
// session alone can't silently rotate the password.
export async function POST(req: NextRequest) {
  const session = await requireActiveSession()
  if (!session.ok) return session.response

  const { userId, email } = session.context
  if (!email) {
    return NextResponse.json({ error: "This account has no password to change." }, { status: 400 })
  }

  let body: { currentPassword?: unknown; newPassword?: unknown }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 })
  }

  const currentPassword = typeof body.currentPassword === "string" ? body.currentPassword : ""
  const newPassword = typeof body.newPassword === "string" ? body.newPassword : ""

  if (!currentPassword || !newPassword) {
    return NextResponse.json({ error: "Current and new password are required." }, { status: 400 })
  }
  if (newPassword.length < 8) {
    return NextResponse.json({ error: "New password must be at least 8 characters." }, { status: 400 })
  }
  if (newPassword === currentPassword) {
    return NextResponse.json({ error: "New password must be different from the current one." }, { status: 400 })
  }

  // Verify the current password on a throwaway client so we never touch the
  // caller's cookie session (persistSession:false, not the cached public client).
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anonKey) {
    return NextResponse.json({ error: "Auth is not configured." }, { status: 500 })
  }
  const verifier = createSupabaseClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
  const { error: verifyError } = await verifier.auth.signInWithPassword({ email, password: currentPassword })
  if (verifyError) {
    return NextResponse.json({ error: "Current password is incorrect." }, { status: 400 })
  }

  const admin = createAdminSupabase()
  const { error: updateError } = await admin.auth.admin.updateUserById(userId, { password: newPassword })
  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  // Never log the password itself — just that the owner changed their own.
  await logAuditEvent({
    category: "security",
    event: "password_changed",
    source: "dashboard",
    actor: { id: userId, name: session.context.profile.fullname, role: session.context.profile.role },
    subjectType: "profiles",
    subjectId: userId,
    subjectLabel: session.context.profile.fullname,
    description: "Changed own password",
    ...requestContextFromRequest(req),
  })

  return NextResponse.json({ ok: true })
}
