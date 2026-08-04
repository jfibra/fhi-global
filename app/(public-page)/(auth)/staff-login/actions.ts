"use server"

import { redirect } from "next/navigation"
import { ensureProfileForUser, isInactiveProfile, isProfileMissingMinimumFields, pickSafePostLoginRedirect } from "@/lib/auth"
import { isAdminStaffRole } from "@/lib/app-roles"
import { createClient, hasServerSupabaseEnv } from "@/lib/supabase/server"
import { createAdminSupabase } from "@/lib/admin-supabase"
import { logAuditEvent, requestContextFromHeaders } from "@/lib/audit-log"
import { sendOtpEmail } from "@/lib/mailer"
import { generateOtpCode, storeOtpChallenge, checkOtpChallenge, clearOtpChallenge } from "@/lib/auth-otp"
import { DEFAULT_ACCOUNT_PASSWORD } from "@/lib/account-password"
import { provisionLrForOtpLogin } from "@/lib/lr/lr-provision"
import { emailTypoMessage } from "@/lib/email-typo"
import { checkEmailDeliverable } from "@/lib/email-validate"

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
    await storeOtpChallenge(data.user.id, code)
    await sendOtpEmail(email, code, "login")
  } catch (e) {
    return { error: e instanceof Error ? `Could not send the code: ${e.message}` : "Could not send the code." }
  }

  return { ok: true, challenge: data.user.id }
}

/**
 * Unified "continue with email" — logs in if the email already has an account,
 * or creates a pending member account if it's new, then emails a 6-digit code.
 * Verification uses the same verifyLoginOtp step, which routes new users to
 * /complete-profile and pending accounts to /account-inactive.
 */
export async function sendAuthOtp(emailRaw: string): Promise<OtpResult> {
  if (!hasServerSupabaseEnv()) {
    return { error: "Supabase environment variables are not configured." }
  }

  const email = String(emailRaw ?? "").trim().toLowerCase()
  if (!email) return { error: "Email is required." }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Enter a valid email address." }
  const typo = emailTypoMessage(email)
  if (typo) return { error: typo }
  const undeliverable = await checkEmailDeliverable(email)
  if (undeliverable) return { error: undeliverable }

  const admin = createAdminSupabase()

  // Create the account if this email is new; an "already exists" error just
  // means it's a returning user (a login). New profiles default to member/pending.
  const { error: createError } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    password: DEFAULT_ACCOUNT_PASSWORD,
  })
  if (createError) {
    const m = createError.message.toLowerCase()
    if (!m.includes("already") && !m.includes("registered") && !m.includes("exists")) {
      return { error: createError.message }
    }
  }

  const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email })
  if (error || !data?.properties?.hashed_token || !data.user?.id) {
    return { error: error?.message ?? "Could not generate a code." }
  }

  const code = generateOtpCode()
  try {
    await storeOtpChallenge(data.user.id, code)
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

  const check = await checkOtpChallenge(challenge, code)
  if ("error" in check) {
    const ctx = await requestContextFromHeaders()
    await logAuditEvent({
      category: "auth",
      event: "login_failed",
      source: "auth",
      description: `Failed OTP sign-in for ${email}`,
      ...ctx,
    })
    return { error: check.error }
  }

  // Mint a FRESH single-use token now (not at send time) and consume it
  // immediately — no rotation window between send and verify, so no stale-token
  // "invalid" / JWT errors.
  const admin = createAdminSupabase()
  const { data: link, error: linkError } = await admin.auth.admin.generateLink({ type: "magiclink", email })
  if (linkError || !link?.properties?.hashed_token) {
    return { error: "Couldn't sign you in. Request a new code." }
  }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.verifyOtp({ token_hash: link.properties.hashed_token, type: "email" })

  if (error || !data.user) {
    // Challenge NOT cleared — a transient failure lets the user resubmit the
    // same code instead of forcing a resend.
    const m = (error?.message ?? "").toLowerCase()
    if (m.includes("expired")) return { error: "That code has expired. Request a new one." }
    return { error: error?.message ?? "Couldn't sign you in. Request a new code." }
  }

  // Session established — now the challenge can be retired.
  await clearOtpChallenge(challenge)

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

  // Parity with Google sign-in: on the first sign-in for an un-curated member,
  // check Leuterio Realty and upgrade to the agent role + active status. Guarded
  // and idempotent (see provisionLrForOtpLogin) so returning/curated accounts are
  // never re-mapped. Reflect any change in the profile used by the gates/redirect.
  const prov = await provisionLrForOtpLogin(admin, data.user.id, email)
  const effProfile = prov.changed ? { ...profile, role: prov.role, status: prov.status } : profile

  // Incomplete profile → finish it first, even while the account is pending.
  if (!isAdminStaffRole(effProfile.role) && isProfileMissingMinimumFields(effProfile)) {
    redirect("/complete-profile")
  }

  // Complete but still pending → hold on the awaiting-approval screen.
  if (isInactiveProfile(effProfile)) {
    redirect("/account-inactive")
  }

  const ctx = await requestContextFromHeaders()
  await logAuditEvent({
    category: "auth",
    event: "login",
    source: "auth",
    actor: { id: data.user.id, name: effProfile.fullname, role: effProfile.role },
    description: prov.changed
      ? "Signed in with email OTP — linked Leuterio Realty agent"
      : "Signed in with email OTP",
    ...ctx,
  })

  redirect(pickSafePostLoginRedirect(nextRaw ?? "", effProfile.role))
}

/**
 * Password sign-in for the /staff-login page (admin/staff access; the public
 * uses the OTP modal). Since every account shares DEFAULT_ACCOUNT_PASSWORD, an
 * admin can sign in as any account with its email + that password.
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

  // Same guarded LR provisioning as the OTP login (accounts share a password, so
  // a member could sign in here too). Idempotent — no-op for curated/returning.
  const admin = createAdminSupabase()
  const prov = await provisionLrForOtpLogin(admin, data.user.id, email)
  const effProfile = prov.changed ? { ...profile, role: prov.role, status: prov.status } : profile

  // Incomplete profile → finish it first, even while the account is pending.
  if (!isAdminStaffRole(effProfile.role) && isProfileMissingMinimumFields(effProfile)) {
    redirect("/complete-profile")
  }

  // Complete but still pending → hold on the awaiting-approval screen.
  if (isInactiveProfile(effProfile)) {
    redirect("/account-inactive")
  }

  const ctx = await requestContextFromHeaders()
  await logAuditEvent({
    category: "auth",
    event: "login",
    source: "auth",
    actor: { id: data.user.id, name: effProfile.fullname, role: effProfile.role },
    description: prov.changed
      ? "Signed in with password — linked Leuterio Realty agent"
      : "Signed in with password",
    ...ctx,
  })

  const nextRaw = String(formData.get("next") ?? "").trim()
  redirect(pickSafePostLoginRedirect(nextRaw, effProfile.role))
}
