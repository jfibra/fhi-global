"use server"

import { createClient, hasServerSupabaseEnv } from "@/lib/supabase/server"
import { createAdminSupabase } from "@/lib/admin-supabase"
import { logAuditEvent, requestContextFromHeaders } from "@/lib/audit-log"
import { sendOtpEmail } from "@/lib/mailer"
import { generateOtpCode, storeOtpChallenge, checkOtpChallenge, clearOtpChallenge } from "@/lib/auth-otp"
import { DEFAULT_ACCOUNT_PASSWORD } from "@/lib/account-password"
import { emailTypoMessage } from "@/lib/email-typo"
import { checkEmailDeliverable } from "@/lib/email-validate"
import {
  claimInvite,
  createOrFindInviteDeveloper,
  releaseInviteClaim,
  resolveChosenDeveloper,
  resolveInviteToken,
  type InviteDeveloper,
} from "@/lib/developer-invites"

/**
 * Email-OTP redemption of a developer invite link — the passwordless
 * counterpart to the Google button, mirroring the /register flow's two steps
 * (sendRegisterOtp / verifyRegisterOtp) with the invite semantics of
 * /api/developer-invite/register: token validity, developer scope, atomic
 * use-count claim with rollback, role `developer`, and auto-activate.
 *
 * This replaced the old name+password form on /join/<token>: accounts sign in
 * with OTP or Google like everyone else, and names are collected later by
 * /complete-profile rather than at the door.
 */

export type JoinOtpResult = {
  error?: string
  ok?: boolean
  success?: boolean
  challenge?: string
  /** Set on success: true → session is live, go to the dashboard. */
  active?: boolean
}

/** Step 1 — validate the link + email, create the pending auth user, send the code. */
export async function sendJoinOtp(tokenRaw: string, emailRaw: string): Promise<JoinOtpResult> {
  if (!hasServerSupabaseEnv()) {
    return { error: "Supabase environment variables are not configured." }
  }

  const token = String(tokenRaw ?? "").trim()
  const resolved = await resolveInviteToken(token)
  if (resolved.status !== "valid") {
    return { error: "This invite link is no longer valid." }
  }

  const email = String(emailRaw ?? "").trim().toLowerCase()
  if (!email) return { error: "Email is required." }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Enter a valid email address." }
  const typo = emailTypoMessage(email)
  if (typo) return { error: typo }
  const undeliverable = await checkEmailDeliverable(email)
  if (undeliverable) return { error: undeliverable }

  const admin = createAdminSupabase()

  // Same pattern as the /register flow: the magiclink below needs an existing
  // user, so mint one now (fixed default password; OTP/Google are the sign-in
  // paths). "Already exists" is fine — the active check below decides.
  const { error: createError } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    password: DEFAULT_ACCOUNT_PASSWORD,
    user_metadata: { account_type: "developer" },
  })
  if (createError) {
    const m = createError.message.toLowerCase()
    const alreadyExists = m.includes("already") || m.includes("registered") || m.includes("exists")
    if (!alreadyExists) return { error: createError.message }
  }

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
 * Step 2 — verify the code, claim one use of the link, provision the developer
 * account. Validation runs BEFORE the code is consumed, so a bad developer
 * choice never burns a working OTP; the claim and any just-created developer
 * row are rolled back if provisioning fails partway.
 */
export async function verifyJoinOtp(
  tokenRaw: string,
  emailRaw: string,
  codeRaw: string,
  challengeRaw: string,
  developerIdRaw?: string | null,
  newDeveloperNameRaw?: string | null,
): Promise<JoinOtpResult> {
  if (!hasServerSupabaseEnv()) {
    return { error: "Supabase environment variables are not configured." }
  }

  const token = String(tokenRaw ?? "").trim()
  const email = String(emailRaw ?? "").trim().toLowerCase()
  const code = String(codeRaw ?? "").trim()
  const challenge = String(challengeRaw ?? "").trim()
  if (!email || !code) return { error: "Enter the code we emailed you." }
  if (!challenge) return { error: "This code is no longer valid. Request a new one." }

  const check = await checkOtpChallenge(challenge, code)
  if ("error" in check) return { error: check.error }

  const resolved = await resolveInviteToken(token)
  if (resolved.status !== "valid") {
    return { error: "This invite link is no longer valid." }
  }
  const config = resolved.config

  // Developer scope: a bound link's developer is fixed; a generic link needs a
  // valid existing choice, or a new-company name created AFTER the code checks.
  const chosenId = String(developerIdRaw ?? "").trim() || null
  const newDeveloperName = String(newDeveloperNameRaw ?? "").trim() || null
  let developer: InviteDeveloper | null = null
  if (config.developer || chosenId) {
    developer = await resolveChosenDeveloper(config, chosenId)
    if (!developer) return { error: "Please choose a valid developer." }
  } else if (!newDeveloperName) {
    return { error: "Please choose your developer." }
  }

  const admin = createAdminSupabase()

  // Consume the OTP: fresh single-use token minted and verified immediately,
  // same as the /register flow — no rotation window, and a session for the
  // auto-activate case.
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

  // Never touch an already-active account (defense in depth; send blocks too).
  const { data: current } = await admin
    .from("profiles")
    .select("status, metadata")
    .eq("id", userId)
    .maybeSingle<{ status: string | null; metadata: Record<string, unknown> | null }>()
  if (current?.status === "active") {
    await supabase.auth.signOut()
    return { error: "An account with this email already exists. Please sign in instead." }
  }

  // Claim one use of the link (atomic; races on the last slot resolve here).
  const claim = await claimInvite(token)
  if (!claim) {
    await supabase.auth.signOut()
    return { error: "This invite link is no longer available." }
  }

  // Create-new developer, deferred to after every check that could fail cheaply.
  let developerWasCreated = false
  if (!developer && newDeveloperName) {
    const result = await createOrFindInviteDeveloper(newDeveloperName)
    if (!result) {
      await releaseInviteClaim(config.id)
      await supabase.auth.signOut()
      return { error: "Could not create the developer. Please try again." }
    }
    developer = result.developer
    developerWasCreated = result.created
  }
  if (!developer) {
    await releaseInviteClaim(config.id)
    await supabase.auth.signOut()
    return { error: "Please choose a valid developer." }
  }

  const status = config.autoActivate ? "active" : "pending"

  // Merge (never overwrite) the trigger-seeded metadata. NB: no invited_by —
  // developer-invite signups are tracked by developer_invite_id alone, so they
  // never leak into the link creator's personal recruits (see the register route).
  const { error: profileError } = await admin
    .from("profiles")
    .update({
      role: "developer",
      status,
      metadata: {
        ...(current?.metadata ?? {}),
        developer_id: developer.id,
        developer_invite_id: config.id,
      },
    })
    .eq("id", userId)

  if (profileError) {
    if (developerWasCreated) {
      await admin.from("developers").delete().eq("id", developer.id)
    }
    await releaseInviteClaim(config.id)
    await supabase.auth.signOut()
    return { error: profileError.message }
  }

  await logAuditEvent({
    category: "auth",
    event: "register",
    source: "auth",
    actor: { id: userId, name: email, role: "developer" },
    subjectType: "profiles",
    subjectId: userId,
    subjectLabel: email,
    description: `Registered as developer for ${developer.name} via invite link, email OTP (${status})`,
    newValues: { role: "developer", status, developer_id: developer.id },
    ...(await requestContextFromHeaders()),
  })

  // Pending accounts wait for approval — end the session. Auto-activated ones
  // keep it and go straight to their dashboard.
  if (!config.autoActivate) {
    await supabase.auth.signOut()
  }
  return { success: true, active: config.autoActivate }
}
