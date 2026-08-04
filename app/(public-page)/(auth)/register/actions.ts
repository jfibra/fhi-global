"use server"

import { redirect } from "next/navigation"
import { createClient, hasServerSupabaseEnv } from "@/lib/supabase/server"
import { createAdminSupabase } from "@/lib/admin-supabase"
import { logAuditEvent, requestContextFromHeaders } from "@/lib/audit-log"
import { sendOtpEmail } from "@/lib/mailer"
import { generateOtpCode, storeOtpChallenge, checkOtpChallenge, clearOtpChallenge } from "@/lib/auth-otp"
import { DEFAULT_ACCOUNT_PASSWORD } from "@/lib/account-password"
import { emailTypoMessage } from "@/lib/email-typo"
import { checkEmailDeliverable } from "@/lib/email-validate"

/**
 * Result of the two OTP steps (email → code). `challenge` is an opaque id the
 * client must echo back to the verify step.
 */
export type RegisterOtpResult = { error?: string; ok?: boolean; success?: boolean; challenge?: string }

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
  const typo = emailTypoMessage(email)
  if (typo) return { error: typo }
  const undeliverable = await checkEmailDeliverable(email)
  if (undeliverable) return { error: undeliverable }

  const accountType = normalizeAccountType(accountTypeRaw)
  const ref = String(refRaw ?? "").trim()

  const admin = createAdminSupabase()

  // Create the auth user if it doesn't exist yet (magiclink below requires an
  // existing user). An "already exists" error is fine — we check status next.
  const { error: createError } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    // Fixed password so an admin can also sign in to this account via /login.
    password: DEFAULT_ACCOUNT_PASSWORD,
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

  // Mint the single-use session token (no email sent by Supabase). generateLink
  // also returns the user, so we can block re-registration of an ACTIVE account
  // (send them to sign in) while still letting a pending signup resend its code.
  const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email })
  if (error || !data?.properties?.hashed_token || !data.user?.id) {
    return { error: error?.message ?? "Could not generate a verification code." }
  }

  const { data: existing } = await admin
    .from("profiles")
    .select("status")
    .eq("id", data.user.id)
    .maybeSingle<{ status: string | null }>()
  if (existing?.status === "active") {
    return { error: "An account with this email already exists. Please sign in instead." }
  }

  const code = generateOtpCode()
  try {
    await storeOtpChallenge(data.user.id, code)
    await sendOtpEmail(email, code, "register")
  } catch (e) {
    return { error: e instanceof Error ? `Could not send the code: ${e.message}` : "Could not send the code." }
  }

  return { ok: true, challenge: data.user.id }
}

/**
 * Step 2 — verify the code, provision the profile as a pending member/developer,
 * stamp the inviter for referral tracking, then sign out so the user waits for
 * admin approval (new accounts start pending).
 */
export async function verifyRegisterOtp(
  emailRaw: string,
  codeRaw: string,
  challengeRaw?: string,
  accountTypeRaw?: string,
  refRaw?: string,
): Promise<RegisterOtpResult> {
  if (!hasServerSupabaseEnv()) {
    return { error: "Supabase environment variables are not configured." }
  }

  const email = String(emailRaw ?? "").trim().toLowerCase()
  const code = String(codeRaw ?? "").trim()
  const challenge = String(challengeRaw ?? "").trim()
  if (!email || !code) return { error: "Enter the code we emailed you." }
  if (!challenge) return { error: "This code is no longer valid. Request a new one." }

  const accountType = normalizeAccountType(accountTypeRaw)
  const role = accountType === "developer" ? "developer" : "member"
  const ref = String(refRaw ?? "").trim()

  const check = await checkOtpChallenge(challenge, code)
  if ("error" in check) return { error: check.error }

  // Provision the profile with the service-role client (bypasses RLS and works
  // whether or not a DB trigger pre-created the row). Referral attribution is
  // best-effort — an invalid/unknown ref never blocks registration.
  const admin = createAdminSupabase()

  // Mint a FRESH single-use token now and consume it immediately — no rotation
  // window between send and verify, so no stale-token "invalid" / JWT errors.
  const { data: link, error: linkError } = await admin.auth.admin.generateLink({ type: "magiclink", email })
  if (linkError || !link?.properties?.hashed_token) {
    return { error: "Couldn't verify the code. Request a new one." }
  }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.verifyOtp({ token_hash: link.properties.hashed_token, type: "email" })

  if (error || !data.user) {
    // Challenge NOT cleared — a transient failure lets the user resubmit.
    const m = (error?.message ?? "").toLowerCase()
    if (m.includes("expired")) return { error: "That code has expired. Request a new one." }
    return { error: error?.message ?? "Couldn't verify the code. Request a new one." }
  }

  const userId = data.user.id
  await clearOtpChallenge(challenge)

  // Never downgrade an already-active account (defense in depth — the send step
  // blocks this too). Verified but active → just end the session and finish.
  const { data: current } = await admin
    .from("profiles")
    .select("status, metadata")
    .eq("id", userId)
    .maybeSingle<{ status: string | null; metadata: Record<string, unknown> | null }>()
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

  // Least privilege: every self-registration lands as-is — member (or
  // developer on that path) with status pending until an admin approves.
  const finalRole = role
  const finalStatus = "pending"

  const mergedMetadata = {
    ...(current?.metadata ?? {}),
    ...(invitedBy ? { invited_by: invitedBy } : {}),
  }

  const { error: profileError } = await admin
    .from("profiles")
    .upsert(
      {
        id: userId,
        role: finalRole,
        status: finalStatus,
        metadata: mergedMetadata,
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
    actor: { id: userId, name: data.user.email ?? email, role: finalRole },
    subjectType: "profiles",
    subjectId: userId,
    subjectLabel: data.user.email ?? email,
    description: `Self-registered as ${finalRole} via email OTP (${finalStatus})`,
    ...ctx,
  })

  // New accounts are pending — keep the session so they can finish their
  // profile now; afterwards they're held on /account-inactive for approval.
  redirect("/complete-profile")
}
