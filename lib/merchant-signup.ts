/**
 * Merchant sign-up — the first step of /register?type=merchant&ref=<agent>
 * (the agent's merchant link, 2026-11-20): the business, the person who signs
 * for it and their WhatsApp, checked here by the page before the email step
 * and again by the server (the email-code actions and the Google finalize
 * route), like the Global Partner step in lib/partner-signup.ts.
 */

import { COUNTRIES } from "@/lib/countries"
import { whatsappDigits } from "@/lib/partner-signup"
import { MERCHANT_CATEGORIES } from "@/lib/merchant/rules"

export type MerchantSignupInfo = {
  businessName: string
  category: string
  /** The authorised signatory — becomes the account's name. */
  contactName: string
  whatsappCode: string
  whatsappNumber: string
}

/** Carries the step through Google sign-in (sessionStorage — never a URL). */
export const MERCHANT_SIGNUP_STORAGE_KEY = "fhi.merchantSignup"

export function checkMerchantSignupInfo(raw: unknown): { ok: true; info: MerchantSignupInfo } | { ok: false; error: string } {
  const r = (raw ?? {}) as Record<string, unknown>
  const businessName = typeof r.businessName === "string" ? r.businessName.trim().replace(/\s+/g, " ") : ""
  if (businessName.length < 2 || businessName.length > 120) return { ok: false, error: "Please enter your business name." }
  const category = typeof r.category === "string" ? r.category.trim() : ""
  if (!MERCHANT_CATEGORIES.includes(category as (typeof MERCHANT_CATEGORIES)[number])) return { ok: false, error: "Please choose the kind of business." }
  const contactName = typeof r.contactName === "string" ? r.contactName.trim().replace(/\s+/g, " ") : ""
  if (contactName.length < 2 || contactName.length > 120) return { ok: false, error: "Please enter the name of the person who signs for the business." }
  const code = typeof r.whatsappCode === "string" ? r.whatsappCode.trim() : ""
  if (!COUNTRIES.some((c) => c.dial === code)) return { ok: false, error: "Please choose your WhatsApp country code." }
  const number = whatsappDigits(code, typeof r.whatsappNumber === "string" ? r.whatsappNumber : "")
  if (number.length < 6 || number.length > 14) return { ok: false, error: "Please enter a valid WhatsApp number." }
  return { ok: true, info: { businessName, category, contactName, whatsappCode: code, whatsappNumber: number } }
}

/** What the step writes into profiles.metadata: the WhatsApp doubles as the phone. */
export function merchantInfoMetadata(info: MerchantSignupInfo) {
  return {
    merchant_signup: true,
    whatsapp_country_code: info.whatsappCode,
    whatsapp_number: info.whatsappNumber,
    phone_country_code: info.whatsappCode,
    phone_number: info.whatsappNumber,
  }
}
