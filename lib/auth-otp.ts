import { createHash, randomInt } from "crypto"
import { createAdminSupabase } from "@/lib/admin-supabase"

/**
 * App-managed 6-digit OTP on top of Supabase Auth.
 *
 * Supabase's own email OTP length is a project-level dashboard setting (this
 * project generates 8 digits), so instead we mint our own 6-digit code and
 * only use Supabase for the session: `generateLink` gives us a single-use
 * `hashed_token`, which we hold back until the user proves they received the
 * 6-digit code. The challenge lives in the auth user's `app_metadata`
 * (server-only — users can't read or edit it), so no extra table is needed.
 *
 * send step:   code + hashed_token stored via storeOtpChallenge(), code emailed.
 * verify step: consumeOtpChallenge() checks code hash, expiry, and attempt cap,
 *              then returns the hashed_token for verifyOtp({ token_hash }).
 */

const OTP_TTL_MS = 10 * 60 * 1000 // server-side validity; not surfaced in the email
const MAX_ATTEMPTS = 5

type OtpChallenge = {
  ch: string // sha256 of the 6-digit code
  th: string // Supabase hashed_token (single-use session ticket)
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
  if (!raw || typeof raw.ch !== "string" || typeof raw.th !== "string") return null
  return { ch: raw.ch, th: raw.th, exp: Number(raw.exp ?? 0), at: Number(raw.at ?? 0) }
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
export async function storeOtpChallenge(userId: string, code: string, tokenHash: string): Promise<void> {
  await writeChallenge(userId, { ch: hashCode(code), th: tokenHash, exp: Date.now() + OTP_TTL_MS, at: 0 })
}

/**
 * Check a submitted code against the stored challenge. On success the challenge
 * is cleared and the Supabase token hash is returned for session creation.
 */
export async function consumeOtpChallenge(
  userId: string,
  code: string,
): Promise<{ tokenHash: string } | { error: string }> {
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

  await writeChallenge(userId, null)
  return { tokenHash: challenge.th }
}
