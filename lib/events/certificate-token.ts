import { createHmac, timingSafeEqual } from "node:crypto"

/**
 * Short-lived, HMAC-signed tokens that let the public certificate page fetch a
 * preview and a PDF after a successful claim, without re-validating identity
 * on every request and without exposing registration ids in URLs.
 */

export type CertificateClaim = {
  /** event id */
  e: string
  /** attendee name as it will appear */
  n: string
  /** registration id when the claim was matched to a registration */
  r?: string
  /** email when matched (for the download log) */
  m?: string
  /** unix seconds */
  exp: number
}

const TTL_SECONDS = 30 * 60

function secret(): string {
  const s = process.env.CERTIFICATE_TOKEN_SECRET ?? process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!s) throw new Error("No signing secret configured")
  return s
}

const b64u = (buf: Buffer) => buf.toString("base64url")

export function signClaim(claim: Omit<CertificateClaim, "exp">): string {
  const payload = b64u(Buffer.from(JSON.stringify({ ...claim, exp: Math.floor(Date.now() / 1000) + TTL_SECONDS })))
  const sig = b64u(createHmac("sha256", secret()).update(payload).digest())
  return `${payload}.${sig}`
}

export function verifyClaim(token: string): CertificateClaim | null {
  const [payload, sig] = token.split(".")
  if (!payload || !sig) return null
  const expected = createHmac("sha256", secret()).update(payload).digest()
  const given = Buffer.from(sig, "base64url")
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null
  try {
    const claim = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as CertificateClaim
    if (typeof claim.e !== "string" || typeof claim.n !== "string" || typeof claim.exp !== "number") return null
    if (claim.exp < Math.floor(Date.now() / 1000)) return null
    return claim
  } catch {
    return null
  }
}
