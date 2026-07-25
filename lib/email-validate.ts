import { resolveMx, resolve4, resolve6 } from "dns/promises"

// Server-only email deliverability check. Runs a DNS lookup on the domain: an
// address is considered deliverable if the domain has MX records (or, per RFC
// 5321's implicit-MX rule, an A/AAAA record). Catches fake/undeliverable
// domains like "asdasd.com" that pass a format regex. Used by the account-
// creating flows (OTP register, "continue with email", admin create).
//
// Fail-open on TRANSIENT DNS errors (timeouts, SERVFAIL) so a DNS hiccup never
// blocks a legitimate signup; fail-closed only when the domain clearly has no
// mail route (ENOTFOUND / ENODATA and no A/AAAA fallback).

const DNS_TIMEOUT_MS = 3000
const UNDELIVERABLE = "This email address can't receive mail. Please check the address."

async function hasMailRoute(domain: string): Promise<boolean> {
  try {
    const mx = await resolveMx(domain)
    if (Array.isArray(mx) && mx.some((r) => r.exchange)) return true
  } catch (e) {
    const code = (e as NodeJS.ErrnoException | undefined)?.code
    // Transient / unexpected DNS error → don't block (treat as deliverable).
    if (code && code !== "ENODATA" && code !== "ENOTFOUND") return true
  }
  // No MX — a domain with an A/AAAA record can still accept mail (implicit MX).
  try {
    const a = await resolve4(domain)
    if (a.length) return true
  } catch { /* fall through */ }
  try {
    const aaaa = await resolve6(domain)
    if (aaaa.length) return true
  } catch { /* fall through */ }
  return false
}

/**
 * Returns an error message when the email's domain can't receive mail, or null
 * when it looks deliverable. Bounded by a DNS timeout that fails open.
 */
export async function checkEmailDeliverable(email: string): Promise<string | null> {
  const at = email.lastIndexOf("@")
  if (at <= 0) return "Enter a valid email address."
  const domain = email.slice(at + 1).trim().toLowerCase()
  if (!domain || !domain.includes(".") || domain.startsWith(".") || domain.endsWith(".")) {
    return "Enter a valid email address."
  }

  const deliverable = await Promise.race<boolean>([
    hasMailRoute(domain),
    new Promise<boolean>((resolve) => setTimeout(() => resolve(true), DNS_TIMEOUT_MS)),
  ])

  return deliverable ? null : UNDELIVERABLE
}
