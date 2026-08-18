import { createHash, randomInt } from "crypto"
import { createAdminSupabase } from "@/lib/admin-supabase"

/**
 * App-managed 6-digit OTP on top of Supabase Auth.
 *
 * Supabase's own email OTP length is a project-level dashboard setting (this
 * project generates 8 digits), so instead we mint our own 6-digit code and
 * only use Supabase for the session. The challenge (code hash + expiry +
 * attempts) lives in the auth user's `app_metadata` — server-only, users can't
 * read or edit it — so no extra table is needed.
 *
 * IMPORTANT: we do NOT store Supabase's single-use magic-link token here.
 * `generateLink` rotates that token on every send, so persisting it across the
 * send→verify gap made a double/rapid send leave the stored token disagreeing
 * with what Supabase holds → "invalid code" / JWT errors that cleared up on a
 * retry. Instead the caller mints a FRESH token at verify time (once the 6-digit
 * code checks out) and consumes it immediately — no rotation window.
 *
 * send step:   storeOtpChallenge() saves the code hash; the code is emailed.
 * verify step: checkOtpChallenge() validates the code (expiry + attempt cap);
 *              the caller then mints a fresh token, calls verifyOtp(), and on
 *              success calls clearOtpChallenge().
 */

const OTP_TTL_MS = 10 * 60 * 1000 // server-side validity; not surfaced in the email
const MAX_ATTEMPTS = 5

type OtpChallenge = {
  ch: string // sha256 of the 6-digit code
  exp: number // epoch ms
  at: number // failed attempts so far
}

export function generateOtpCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, "0")
}

function hashCode(code: string): string {
  return createHash("sha256").update(code).digest("hex")
}

function readChallenge(meta: Record<string, unknown> | undefined): OtpChallenge | null {
  const raw = meta?.fhi_otp as Partial<OtpChallenge> | null | undefined
  if (!raw || typeof raw.ch !== "string") return null
  return { ch: raw.ch, exp: Number(raw.exp ?? 0), at: Number(raw.at ?? 0) }
}

async function writeChallenge(userId: string, challenge: OtpChallenge | null): Promise<void> {
  const admin = createAdminSupabase()
  // app_metadata updates merge by top-level key, so this only touches fhi_otp.
  const { error } = await admin.auth.admin.updateUserById(userId, {
    app_metadata: { fhi_otp: challenge },
  })
  if (error) throw new Error(error.message)
}

/** Persist a fresh challenge (overwrites any previous one for this user). */
export async function storeOtpChallenge(userId: string, code: string): Promise<void> {
  await writeChallenge(userId, { ch: hashCode(code), exp: Date.now() + OTP_TTL_MS, at: 0 })
}

/** Clear the challenge — call after the session is established (verify success). */
export async function clearOtpChallenge(userId: string): Promise<void> {
  await writeChallenge(userId, null)
}

/**
 * Validate a submitted code against the stored challenge (expiry + attempt cap +
 * hash). On success it does NOT clear the challenge — the caller clears it only
 * after the Supabase session is actually created, so a transient session error
 * never strands a correct code (the user can just resubmit).
 */
export async function checkOtpChallenge(
  userId: string,
  code: string,
): Promise<{ ok: true } | { error: string }> {
  const admin = createAdminSupabase()
  const { data, error } = await admin.auth.admin.getUserById(userId)
  if (error || !data.user) return { error: "Couldn't verify the code. Request a new one." }

  const challenge = readChallenge(data.user.app_metadata)
  if (!challenge) return { error: "No active code for this email. Request a new one." }

  if (Date.now() > challenge.exp) {
    await writeChallenge(userId, null)
    return { error: "That code has expired. Request a new one." }
  }

  if (challenge.at >= MAX_ATTEMPTS) {
    await writeChallenge(userId, null)
    return { error: "Too many incorrect attempts. Request a new code." }
  }

  if (hashCode(code) !== challenge.ch) {
    await writeChallenge(userId, { ...challenge, at: challenge.at + 1 })
    return { error: "Invalid code. Check the digits and try again." }
  }

  return { ok: true }
}

// ─── Email-change challenge ───────────────────────────────────────────────────
// Same hash/expiry/attempt mechanics as the login OTP, but under its own
// app_metadata key (so it can't collide with a login code) and carrying the
// pending new email — the verify step needs to know WHAT address was proven.

type EmailChangeChallenge = OtpChallenge & { em: string }

async function writeEmailChangeChallenge(userId: string, challenge: EmailChangeChallenge | null): Promise<void> {
  const admin = createAdminSupabase()
  const { error } = await admin.auth.admin.updateUserById(userId, {
    app_metadata: { fhi_email_change: challenge },
  })
  if (error) throw new Error(error.message)
}

/** Persist a fresh email-change challenge; the code is emailed to `newEmail`. */
export async function storeEmailChangeChallenge(userId: string, code: string, newEmail: string): Promise<void> {
  await writeEmailChangeChallenge(userId, {
    ch: hashCode(code),
    exp: Date.now() + OTP_TTL_MS,
    at: 0,
    em: newEmail,
  })
}

export async function clearEmailChangeChallenge(userId: string): Promise<void> {
  await writeEmailChangeChallenge(userId, null)
}

/**
 * Validate a submitted email-change code. On success returns the pending new
 * email WITHOUT clearing the challenge — the caller clears it only after the
 * auth email has actually been rotated.
 */
export async function checkEmailChangeChallenge(
  userId: string,
  code: string,
): Promise<{ ok: true; email: string } | { error: string }> {
  const admin = createAdminSupabase()
  const { data, error } = await admin.auth.admin.getUserById(userId)
  if (error || !data.user) return { error: "Couldn't verify the code. Request a new one." }

  const raw = data.user.app_metadata?.fhi_email_change as Partial<EmailChangeChallenge> | null | undefined
  if (!raw || typeof raw.ch !== "string" || typeof raw.em !== "string") {
    return { error: "No active code. Request a new one." }
  }
  const challenge: EmailChangeChallenge = { ch: raw.ch, exp: Number(raw.exp ?? 0), at: Number(raw.at ?? 0), em: raw.em }

  if (Date.now() > challenge.exp) {
    await writeEmailChangeChallenge(userId, null)
    return { error: "That code has expired. Request a new one." }
  }

  if (challenge.at >= MAX_ATTEMPTS) {
    await writeEmailChangeChallenge(userId, null)
    return { error: "Too many incorrect attempts. Request a new code." }
  }

  if (hashCode(code) !== challenge.ch) {
    await writeEmailChangeChallenge(userId, { ...challenge, at: challenge.at + 1 })
    return { error: "Invalid code. Check the digits and try again." }
  }

  return { ok: true, email: challenge.em }
}
