/**
 * The RERA BRN rule (boss, 2026-11-09): every account answers it once — a BRN
 * the Dubai Land Department register has (metadata.license_number, checked on
 * the profile page's Save) or "I'm not a broker" (metadata.not_broker). Until
 * then DashboardAuthGate sends every dashboard page to the profile page, where
 * the BRN field is highlighted.
 */

export function needsBrnAnswer(metadata: Record<string, unknown> | null | undefined): boolean {
  const m = metadata ?? {}
  if (m.not_broker === true) return false
  const brn = m.license_number
  return !(typeof brn === "number" || (typeof brn === "string" && brn.trim()))
}

/** The query flag the redirect adds, so the profile page scrolls to the BRN field. */
export const BRN_REQUIRED_PARAM = "brn"

/**
 * Fired by the profile page after a successful save, with the saved metadata,
 * so DashboardAuthGate (which holds the session) stops redirecting without a reload.
 */
export const PROFILE_SAVED_EVENT = "fhi:profile-saved"
export type ProfileSavedDetail = { metadata: Record<string, unknown> | null }

export const isProfilePath = (pathname: string) => /\/profile\/?$/.test(pathname)
