import { NextRequest, NextResponse } from "next/server"
import { requireActiveSession } from "@/lib/auth-guard"
import { createAdminSupabase } from "@/lib/admin-supabase"
import { logAuditEvent, requestContextFromRequest } from "@/lib/audit-log"
import { sendOtpEmail, sendEmailChangedNotice } from "@/lib/mailer"
import {
  generateOtpCode,
  storeEmailChangeChallenge,
  checkEmailChangeChallenge,
  clearEmailChangeChallenge,
} from "@/lib/auth-otp"
import { emailTypoMessage } from "@/lib/email-typo"
import { checkEmailDeliverable } from "@/lib/email-validate"

export const runtime = "nodejs"

// ─── POST /api/account/email ─────────────────────────────────────────────────
// Self-service email change for the signed-in user, OTP-confirmed like the
// login flow:
//   { action: "send",   newEmail }  → uniqueness check, 6-digit code emailed
//                                     to the NEW address (proves ownership).
//   { action: "verify", code }      → code checked against the stored
//                                     challenge, then the auth email rotates.
// Emails live only in auth.users; uniqueness is checked via the service-role
// auth_user_emails view (043) and again by Supabase at update time.

const TAKEN_MESSAGE = "This email is already taken."

async function emailTaken(email: string, excludeUserId: string): Promise<boolean> {
  const admin = createAdminSupabase()
  const { data, error } = await admin
    .from("auth_user_emails")
    .select("id")
    .eq("email", email)
    .limit(2)
  if (error) throw new Error(error.message)
  return (data ?? []).some((row) => row.id !== excludeUserId)
}

export async function POST(req: NextRequest) {
  const session = await requireActiveSession()
  if (!session.ok) return session.response
  const { userId, email: currentEmail } = session.context

  let body: { action?: unknown; newEmail?: unknown; code?: unknown }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 })
  }

  if (body.action === "send") {
    const newEmail = String(body.newEmail ?? "").trim().toLowerCase()
    if (!newEmail) return NextResponse.json({ error: "Enter your new email." }, { status: 400 })
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
      return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 })
    }
    if (currentEmail && newEmail === currentEmail.toLowerCase()) {
      return NextResponse.json({ error: "This is already your sign-in email." }, { status: 400 })
    }
    const typo = emailTypoMessage(newEmail)
    if (typo) return NextResponse.json({ error: typo }, { status: 400 })
    const undeliverable = await checkEmailDeliverable(newEmail)
    if (undeliverable) return NextResponse.json({ error: undeliverable }, { status: 400 })

    try {
      if (await emailTaken(newEmail, userId)) {
        return NextResponse.json({ error: TAKEN_MESSAGE }, { status: 409 })
      }
      const code = generateOtpCode()
      await storeEmailChangeChallenge(userId, code, newEmail)
      await sendOtpEmail(newEmail, code, "email_change")
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? `Could not send the code: ${e.message}` : "Could not send the code." },
        { status: 500 },
      )
    }
    return NextResponse.json({ ok: true })
  }

  if (body.action === "verify") {
    const code = String(body.code ?? "").trim()
    if (!code) return NextResponse.json({ error: "Enter the code we emailed you." }, { status: 400 })

    const check = await checkEmailChangeChallenge(userId, code)
    if ("error" in check) return NextResponse.json({ error: check.error }, { status: 400 })
    const newEmail = check.email

    try {
      // Re-check — the address could have been claimed between send and verify.
      if (await emailTaken(newEmail, userId)) {
        await clearEmailChangeChallenge(userId)
        return NextResponse.json({ error: TAKEN_MESSAGE }, { status: 409 })
      }
    } catch {
      return NextResponse.json({ error: "Couldn't update your email. Try again." }, { status: 500 })
    }

    const admin = createAdminSupabase()
    const { error: updateError } = await admin.auth.admin.updateUserById(userId, {
      email: newEmail,
      email_confirm: true,
    })
    if (updateError) {
      const m = updateError.message.toLowerCase()
      if (m.includes("already") || m.includes("exists") || m.includes("registered")) {
        await clearEmailChangeChallenge(userId)
        return NextResponse.json({ error: TAKEN_MESSAGE }, { status: 409 })
      }
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    await clearEmailChangeChallenge(userId)

    // Unlink any Google identity whose address no longer matches the new
    // email — otherwise the OLD address's "Sign in with Google" button would
    // remain a permanent key to this account. Uses the service-role RPC from
    // migration 046 (the GoTrue admin identity-delete REST endpoint 404s on
    // this instance). Best-effort: the email change stands either way, and the
    // user can re-link by signing in with Google on the new email.
    let googleUnlinked = false
    try {
      const { data: removed, error: unlinkError } = await admin.rpc("admin_unlink_stale_google_identity", {
        target_user: userId,
      })
      googleUnlinked = !unlinkError && Number(removed ?? 0) > 0
    } catch {
      /* best-effort; audit below records whether it happened */
    }

    // Security notice to the PREVIOUS address — a hijacked account can't be
    // silently re-pointed. Best-effort: the change already succeeded, so a
    // mailer hiccup must not fail the request (deliver() audits failures).
    if (currentEmail && currentEmail.toLowerCase() !== newEmail) {
      try {
        await sendEmailChangedNotice(currentEmail, newEmail, googleUnlinked)
      } catch {
        /* audited by the mailer; nothing actionable for the user */
      }
    }

    const ctx = await requestContextFromRequest(req)
    await logAuditEvent({
      category: "auth",
      event: "email_changed",
      source: "auth",
      description: `Email changed from ${currentEmail ?? "unknown"} to ${newEmail}${googleUnlinked ? " (stale Google identity unlinked)" : ""}`,
      subjectType: "user",
      subjectId: userId,
      ...ctx,
    })

    return NextResponse.json({ ok: true, email: newEmail })
  }

  return NextResponse.json({ error: "Unknown action." }, { status: 400 })
}
