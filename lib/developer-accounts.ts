// Developer partner accounts sign in with a USERNAME instead of an email.
// Supabase Auth is still email-keyed under the hood, so every developer account
// gets a deterministic synthetic address `<username>@developers.fhiglobal.ae`
// that the developer never sees. This module is the single source of truth for
// that mapping so the login action and the admin create-account endpoint always
// agree. Developers created this way have real admin-set passwords (not the
// shared DEFAULT_ACCOUNT_PASSWORD) and password resets are admin-driven.

export const DEVELOPER_LOGIN_EMAIL_DOMAIN = "developers.fhiglobal.ae"

const USERNAME_PATTERN = /^[a-z0-9._-]{3,32}$/

/** Trim + lowercase — the canonical form we store in `profiles.username`. */
export function normalizeUsername(username: string): string {
  return String(username ?? "").trim().toLowerCase()
}

/** 3–32 chars, lowercase letters/digits and `. _ -` only (checked post-normalize). */
export function isValidUsername(username: string): boolean {
  return USERNAME_PATTERN.test(normalizeUsername(username))
}

/** Deterministic synthetic auth email for a developer username. */
export function usernameToEmail(username: string): string {
  return `${normalizeUsername(username)}@${DEVELOPER_LOGIN_EMAIL_DOMAIN}`
}
