"use server"

import { redirect } from "next/navigation"
import { ensureProfileForUser, isInactiveProfile, pickSafePostLoginRedirect } from "@/lib/auth"
import { createClient, hasServerSupabaseEnv } from "@/lib/supabase/server"
import { createAdminSupabase } from "@/lib/admin-supabase"
import { logAuditEvent, requestContextFromHeaders } from "@/lib/audit-log"
import { sendOtpEmail } from "@/lib/mailer"
import { generateOtpCode, storeOtpChallenge, consumeOtpChallenge } from "@/lib/auth-otp"

export type LoginState = {
  error?: string
}

/**
 * Result of the two OTP steps (email → code). `ok` = code was emailed;
 * `challenge` is an opaque id the client must echo back to the verify step.
 */
export type OtpResult = { error?: string; ok?: boolean; challenge?: string }

/**
 * Step 1 — email the user a 6-digit sign-in code.
 * We mint our own 6-digit code (Supabase's OTP length is a dashboard setting we
 * don't control from code) and deliver it via our own SMTP (see lib/mailer.ts).
 * Supabase's single-use hashed_token is held server-side until the code is
 * verified (see lib/auth-otp.ts). A missing user surfaces as "no account" —
 * login never provisions accounts.
 */
export async function sendLoginOtp(emailRaw: string): Promise<OtpResult> {
  if (!hasServerSupabaseEnv()) {
    return { error: "Supabase environment variables are not configured." }
  }

  const email = String(emailRaw ?? "").trim().toLowerCase()
  if (!email) return { error: "Email is required." }

  const admin = createAdminSupabase()
  // magiclink only generates a token for an EXISTING user; unknown emails
  // error out, which we map to a friendly "no account" message.
  const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email })

  if (error || !data?.properties?.hashed_token || !data.user?.id) {
    const m = (error?.message ?? "").toLowerCase()
    if (m.includes("not found") || m.includes("no user") || m.includes("unable to")) {
      return { error: "No account found for this email. Ask an admin to add you, or create an account." }
    }
    return { error: error?.message ?? "Could not generate a sign-in code." }
  }

  const code = generateOtpCode()
  try {
    await storeOtpChallenge(data.user.id, code, data.properties.hashed_token)
    await sendOtpEmail(email, code, "login")
  } catch (e) {
    return { error: e instanceof Error ? `Could not send the code: ${e.message}` : "Could not send the code." }
  }

  return { ok: true, challenge: data.user.id }
}

/**
 * Step 2 — check the 6-digit code against the stored challenge, exchange the
 * held token hash for a session, then run the same post-login checks the
 * password flow used (profile bootstrap, inactive gate, audit, safe redirect).
 */
export async function verifyLoginOtp(
  emailRaw: string,
  codeRaw: string,
  challengeRaw?: string,
  nextRaw?: string,
): Promise<OtpResult> {
  if (!hasServerSupabaseEnv()) {
    return { error: "Supabase environment variables are not configured." }
  }

  const email = String(emailRaw ?? "").trim().toLowerCase()
  const code = String(codeRaw ?? "").trim()
  const challenge = String(challengeRaw ?? "").trim()
  if (!email || !code) return { error: "Enter the code we emailed you." }
  if (!challenge) return { error: "This code is no longer valid. Request a new one." }

  const result = await consumeOtpChallenge(challenge, code)
  if ("error" in result) {
    const ctx = await requestContextFromHeaders()
    await logAuditEvent({
      category: "auth",
      event: "login_failed",
      source: "auth",
      description: `Failed OTP sign-in for ${email}`,
      ...ctx,
    })
    return { error: result.error }
  }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.verifyOtp({ token_hash: result.tokenHash, type: "email" })

  if (error || !data.user) {
    const m = (error?.message ?? "").toLowerCase()
    if (m.includes("expired")) return { error: "That code has expired. Request a new one." }
    return { error: error?.message ?? "Couldn't sign you in. Request a new code." }
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

/**
 * Password sign-in for the /login page (admin/staff access; the public uses the
 * OTP modal). Since every account shares DEFAULT_ACCOUNT_PASSWORD, an admin can
 * sign in as any account with its email + that password.
 */
export async function passwordLoginAction(_: LoginState, formData: FormData): Promise<LoginState> {
  if (!hasServerSupabaseEnv()) {
    return { error: "Supabase environment variables are not configured." }
  }

  const email = String(formData.get("email") ?? "").trim().toLowerCase()
  const password = String(formData.get("password") ?? "")
  if (!email || !password) return { error: "Email and password are required." }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })

  if (error || !data.user) {
    const ctx = await requestContextFromHeaders()
    await logAuditEvent({
      category: "auth",
      event: "login_failed",
      source: "auth",
      description: `Failed password sign-in for ${email}`,
      ...ctx,
    })
    const m = (error?.message ?? "").toLowerCase()
    if (m.includes("invalid login credentials")) return { error: "Invalid email or password." }
    if (m.includes("too many") || m.includes("rate")) return { error: "Too many attempts. Wait a minute and try again." }
    return { error: error?.message ?? "Invalid email or password." }
  }

  const { profile, error: profileError } = await ensureProfileForUser(supabase, {
    id: data.user.id,
    email: data.user.email,
    user_metadata: data.user.user_metadata,
  })

  if (profileError || !profile) {
    await supabase.auth.signOut()
    return { error: profileError?.message ? `Profile setup failed: ${profileError.message}` : "Profile setup failed." }
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
    description: "Signed in with password",
    ...ctx,
  })

  const nextRaw = String(formData.get("next") ?? "").trim()
  redirect(pickSafePostLoginRedirect(nextRaw, profile.role))
}
