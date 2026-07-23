"use server"

import { redirect } from "next/navigation"
import { ensureProfileForUser, isInactiveProfile, pickSafePostLoginRedirect } from "@/lib/auth"
import { createClient, hasServerSupabaseEnv } from "@/lib/supabase/server"
import { createAdminSupabase } from "@/lib/admin-supabase"
import { logAuditEvent, requestContextFromHeaders } from "@/lib/audit-log"
import { sendOtpEmail } from "@/lib/mailer"

export type LoginState = {
  error?: string
}

/** Result of the two OTP steps (email → code). `ok` = code was emailed. */
export type OtpResult = { error?: string; ok?: boolean }

/**
 * Step 1 — email the user a 6-digit sign-in code.
 * We generate the OTP with the admin API (generateLink) and deliver it via our
 * own SMTP (see lib/mailer.ts) rather than Supabase's built-in email, which is
 * rate-limited to a handful of sends/hour on the free tier. A missing user
 * surfaces as "no account" here — login never provisions accounts.
 */
export async function sendLoginOtp(emailRaw: string): Promise<OtpResult> {
  if (!hasServerSupabaseEnv()) {
    return { error: "Supabase environment variables are not configured." }
  }

  const email = String(emailRaw ?? "").trim().toLowerCase()
  if (!email) return { error: "Email is required." }

  const admin = createAdminSupabase()
  // magiclink only generates a link/OTP for an EXISTING user; unknown emails
  // error out, which we map to a friendly "no account" message.
  const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email })

  if (error || !data?.properties?.email_otp) {
    const m = (error?.message ?? "").toLowerCase()
    if (m.includes("not found") || m.includes("no user") || m.includes("unable to")) {
      return { error: "No account found for this email. Ask an admin to add you, or create an account." }
    }
    return { error: error?.message ?? "Could not generate a sign-in code." }
  }

  try {
    await sendOtpEmail(email, data.properties.email_otp, "login")
  } catch (e) {
    return { error: e instanceof Error ? `Could not send the code: ${e.message}` : "Could not send the code." }
  }

  return { ok: true }
}

/**
 * Step 2 — verify the 6-digit code, then run the same post-login checks the
 * password flow used (profile bootstrap, inactive gate, audit, safe redirect).
 */
export async function verifyLoginOtp(
  emailRaw: string,
  tokenRaw: string,
  nextRaw?: string,
): Promise<OtpResult> {
  if (!hasServerSupabaseEnv()) {
    return { error: "Supabase environment variables are not configured." }
  }

  const email = String(emailRaw ?? "").trim().toLowerCase()
  const token = String(tokenRaw ?? "").trim()
  if (!email || !token) return { error: "Enter the code we emailed you." }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.verifyOtp({ email, token, type: "email" })

  if (error || !data.user) {
    const ctx = await requestContextFromHeaders()
    await logAuditEvent({
      category: "auth",
      event: "login_failed",
      source: "auth",
      description: `Failed OTP sign-in for ${email}`,
      ...ctx,
    })
    const m = (error?.message ?? "").toLowerCase()
    if (m.includes("expired")) return { error: "That code has expired. Request a new one." }
    if (m.includes("invalid") || m.includes("token")) {
      return { error: "Invalid code. Check the digits and try again." }
    }
    return { error: error?.message ?? "Invalid code." }
  }

  const { profile, error: profileError } = await ensureProfileForUser(supabase, {
    id: data.user.id,
    email: data.user.email,
    user_metadata: data.user.user_metadata,
  })

  if (profileError || !profile) {
    await supabase.auth.signOut()
    if (profileError?.message) {
      return { error: `Profile setup failed: ${profileError.message}` }
    }
    return { error: "Profile setup failed. Please contact administrator." }
  }

  if (isInactiveProfile(profile)) {
    await supabase.auth.signOut()
    redirect("/account-inactive")
  }

  const ctx = await requestContextFromHeaders()
  await logAuditEvent({
    category: "auth",
    event: "login",
    source: "auth",
    actor: { id: data.user.id, name: profile.fullname, role: profile.role },
    description: "Signed in with email OTP",
    ...ctx,
  })

  redirect(pickSafePostLoginRedirect(nextRaw ?? "", profile.role))
}
