"use server"

import { createClient, hasServerSupabaseEnv } from "@/lib/supabase/server"
import { createAdminSupabase } from "@/lib/admin-supabase"
import { logAuditEvent, requestContextFromHeaders } from "@/lib/audit-log"
import { sendOtpEmail } from "@/lib/mailer"

export type RegisterState = {
  error?: string
  success?: boolean
}

/** Result of the two OTP steps (email → code). */
export type RegisterOtpResult = { error?: string; ok?: boolean; success?: boolean }

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

type AccountType = "member" | "developer"

function normalizeAccountType(v: string | null | undefined): AccountType {
  return String(v ?? "").toLowerCase().trim() === "developer" ? "developer" : "member"
}

/**
 * Step 1 — create the account (email pre-confirmed; access is gated by the
 * pending→active approval flow, not email confirmation) and email a 6-digit
 * code via our own SMTP (lib/mailer.ts) instead of Supabase's rate-limited
 * built-in email. The account type + inviter ride along in user_metadata and
 * are applied to the profile once the code is verified (see verifyRegisterOtp).
 */
export async function sendRegisterOtp(
  emailRaw: string,
  accountTypeRaw?: string,
  refRaw?: string,
): Promise<RegisterOtpResult> {
  if (!hasServerSupabaseEnv()) {
    return { error: "Supabase environment variables are not configured." }
  }

  const email = String(emailRaw ?? "").trim().toLowerCase()
  if (!email) return { error: "Email is required." }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Enter a valid email address." }

  const accountType = normalizeAccountType(accountTypeRaw)
  const ref = String(refRaw ?? "").trim()

  const admin = createAdminSupabase()

  // Create the auth user if it doesn't exist yet (magiclink below requires an
  // existing user). An "already exists" error is fine — we check status next.
  const { error: createError } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: {
      account_type: accountType,
      ...(ref && UUID_RE.test(ref) ? { invited_by: ref } : {}),
    },
  })
  if (createError) {
    const m = createError.message.toLowerCase()
    const alreadyExists = m.includes("already") || m.includes("registered") || m.includes("exists")
    if (!alreadyExists) return { error: createError.message }
  }

  // Generate the code (no email sent by Supabase). generateLink also returns the
  // user, so we can block re-registration of an ACTIVE account (send them to
  // sign in) while still letting a pending/unfinished signup resend its code.
  const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email })
  if (error || !data?.properties?.email_otp) {
    return { error: error?.message ?? "Could not generate a verification code." }
  }

  if (data.user?.id) {
    const { data: existing } = await admin
      .from("profiles")
      .select("status")
      .eq("id", data.user.id)
      .maybeSingle<{ status: string | null }>()
    if (existing?.status === "active") {
      return { error: "An account with this email already exists. Please sign in instead." }
    }
  }

  try {
    await sendOtpEmail(email, data.properties.email_otp, "register")
  } catch (e) {
    return { error: e instanceof Error ? `Could not send the code: ${e.message}` : "Could not send the code." }
  }

  return { ok: true }
}

/**
 * Step 2 — verify the code, provision the profile as a pending member/developer,
 * stamp the inviter for referral tracking, then sign out so the user waits for
 * admin approval (new accounts start pending).
 */
export async function verifyRegisterOtp(
  emailRaw: string,
  tokenRaw: string,
  accountTypeRaw?: string,
  refRaw?: string,
): Promise<RegisterOtpResult> {
  if (!hasServerSupabaseEnv()) {
    return { error: "Supabase environment variables are not configured." }
  }

  const email = String(emailRaw ?? "").trim().toLowerCase()
  const token = String(tokenRaw ?? "").trim()
  if (!email || !token) return { error: "Enter the code we emailed you." }

  const accountType = normalizeAccountType(accountTypeRaw)
  const role = accountType === "developer" ? "developer" : "member"
  const ref = String(refRaw ?? "").trim()

  const supabase = await createClient()
  const { data, error } = await supabase.auth.verifyOtp({ email, token, type: "email" })

  if (error || !data.user) {
    const m = (error?.message ?? "").toLowerCase()
    if (m.includes("expired")) return { error: "That code has expired. Request a new one." }
    if (m.includes("invalid") || m.includes("token")) {
      return { error: "Invalid code. Check the digits and try again." }
    }
    return { error: error?.message ?? "Invalid code." }
  }

  const userId = data.user.id

  // Provision the profile with the service-role client (bypasses RLS and works
  // whether or not a DB trigger pre-created the row). Referral attribution is
  // best-effort — an invalid/unknown ref never blocks registration.
  const admin = createAdminSupabase()

  // Never downgrade an already-active account (defense in depth — the send step
  // blocks this too). Verified but active → just end the session and finish.
  const { data: current } = await admin
    .from("profiles")
    .select("status")
    .eq("id", userId)
    .maybeSingle<{ status: string | null }>()
  if (current?.status === "active") {
    await supabase.auth.signOut()
    return { success: true }
  }

  let invitedBy: string | null = null
  if (ref && UUID_RE.test(ref)) {
    const { data: inviter } = await admin
      .from("profiles")
      .select("id")
      .eq("id", ref)
      .eq("is_deleted", false)
      .maybeSingle()
    if (inviter) invitedBy = ref
  }

  const { error: profileError } = await admin
    .from("profiles")
    .upsert(
      {
        id: userId,
        role,
        status: "pending",
        ...(invitedBy ? { metadata: { invited_by: invitedBy } } : {}),
      },
      { onConflict: "id" },
    )
  if (profileError) {
    await supabase.auth.signOut()
    return { error: `Profile setup failed: ${profileError.message}` }
  }

  const ctx = await requestContextFromHeaders()
  await logAuditEvent({
    category: "auth",
    event: "register",
    source: "auth",
    actor: { id: userId, name: data.user.email ?? email, role },
    subjectType: "profiles",
    subjectId: userId,
    subjectLabel: data.user.email ?? email,
    description: `Self-registered as ${role} via email OTP (pending approval)`,
    ...ctx,
  })

  // New accounts are pending — sign out so they can't enter until approved.
  await supabase.auth.signOut()

  return { success: true }
}
