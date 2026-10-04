/**
 * Global Partner sign-up — "Where are you based?" (boss, 2026-10-04). Before
 * the email step a partner picks the country they live in now and gives their
 * WhatsApp, so the admins approving them can see where they came from.
 *
 * Shared by the register page (checks before moving on) and the server (checks
 * again: the email-code actions and the Google finalize route). Stored on the
 * profile as metadata.residence_country (a COUNTRIES name) plus the profile's
 * own WhatsApp fields, so /complete-profile shows the number already filled in.
 */

import { COUNTRIES, countryByName } from "@/lib/countries"

export type PartnerSignupInfo = {
  /** The country they live in now — a COUNTRIES name. */
  country: string
  /** WhatsApp calling code, e.g. "+63". */
  whatsappCode: string
  /** WhatsApp number without the calling code, digits only. */
  whatsappNumber: string
}

/** Carries the step through Google sign-in (sessionStorage — a phone number never rides in a URL). */
export const PARTNER_SIGNUP_STORAGE_KEY = "fhi.partnerSignup"

/** WhatsApp digits as WhatsApp wants them: no spaces, no leading 0, no calling code typed twice. */
export function whatsappDigits(dial: string, raw: string): string {
  let digits = raw.replace(/\D/g, "").replace(/^0+/, "")
  const cc = dial.replace(/\D/g, "")
  // "+63 917 123 4567" typed in the number box after picking +63.
  if (cc && digits.length > 10 && digits.startsWith(cc)) digits = digits.slice(cc.length)
  return digits
}

export function checkPartnerSignupInfo(
  raw: unknown,
): { ok: true; info: PartnerSignupInfo } | { ok: false; error: string } {
  const r = (raw ?? {}) as Record<string, unknown>
  const country = countryByName(typeof r.country === "string" ? r.country : "")
  if (!country) return { ok: false, error: "Please choose the country you live in." }
  const code = typeof r.whatsappCode === "string" ? r.whatsappCode.trim() : ""
  if (!COUNTRIES.some((c) => c.dial === code)) return { ok: false, error: "Please choose your WhatsApp country code." }
  const number = whatsappDigits(code, typeof r.whatsappNumber === "string" ? r.whatsappNumber : "")
  if (number.length < 6 || number.length > 14) return { ok: false, error: "Please enter a valid WhatsApp number." }
  return { ok: true, info: { country: country.name, whatsappCode: code, whatsappNumber: number } }
}

/** What the step writes into profiles.metadata. */
export function partnerInfoMetadata(info: PartnerSignupInfo) {
  return {
    residence_country: info.country,
    whatsapp_country_code: info.whatsappCode,
    whatsapp_number: info.whatsappNumber,
  }
}
