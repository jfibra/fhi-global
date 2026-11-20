/**
 * The Merchant Partnership Programme's rules, in one place (boss via
 * Juliecor, 2026-11-20; the Merchant Partnership Proposal and the Agent
 * Business Development Programme 2026–2027). Browser-safe: no secrets.
 *
 * A merchant shows a unique QR in its shop; its customers scan it, reach
 * rentsouq.ae and rent. Every validated rental tagged with the merchant pays
 * the merchant AED 100 (the 15th of the next month) and the agent who signed
 * the merchant AED 100 (the 10th). One-year agreement; a rental cancelled
 * within the claw-back window is taken back.
 */

/** AED per closed deal, for the merchant and for the agent alike. */
export const MERCHANT_INCENTIVE_AED = 100
export const AGENT_INCENTIVE_AED = 100
/** A rental set invalid within this many days of being recorded is a claw-back. */
export const MERCHANT_CLAWBACK_DAYS = 14
export const MERCHANT_AGREEMENT_MONTHS = 12
/** Day of the following month each side is paid. */
export const MERCHANT_PAY_DAY = 15
export const AGENT_PAY_DAY = 10
/** How many working days the merchant is told the review takes. */
export const MERCHANT_REVIEW_DAYS = 2

/** The kinds of business the proposal lists, plus Other. */
export const MERCHANT_CATEGORIES = [
  "Restaurant",
  "Cleaning company",
  "Hotel",
  "Travel and tourism",
  "Cargo company",
  "Spa or home massage",
  "Jewellery shop",
  "Perfume store",
  "Training school",
  "School",
  "Supermarket",
  "Gasoline station",
  "Dental clinic",
  "Aesthetic centre",
  "Other",
] as const
export type MerchantCategory = (typeof MERCHANT_CATEGORIES)[number]

export type MerchantStatus = "onboarding" | "submitted" | "accepted" | "declined" | "ended"

export const MERCHANT_STATUS_LABELS: Record<MerchantStatus, string> = {
  onboarding: "Waiting for documents",
  submitted: "Under review by FHI",
  accepted: "Active partner",
  declined: "Declined",
  ended: "Agreement ended",
}

/** The four official requirements, in the order the pages show them. */
export type MerchantDocumentKind = "agreement" | "trade_licence" | "emirates_id" | "bank"

export const MERCHANT_DOCUMENT_KINDS: ReadonlyArray<{ kind: MerchantDocumentKind; label: string; hint: string }> = [
  { kind: "agreement", label: "Signed Merchant Agreement", hint: "The one-year Merchant Partnership Agreement, signed by your authorised signatory." },
  { kind: "trade_licence", label: "Trade licence copy", hint: "DED or free-zone licence, valid today." },
  { kind: "emirates_id", label: "Signatory's Emirates ID", hint: "Front and back of the person who signs for the business." },
  { kind: "bank", label: "Bank details for your incentive", hint: "Where AED 100 per rented unit is paid on the 15th of each month." },
]

export const isMerchantDocumentKind = (v: unknown): v is MerchantDocumentKind =>
  MERCHANT_DOCUMENT_KINDS.some((d) => d.kind === v)

/**
 * The programme's PDFs an agent sends a merchant (the proposal, the agent
 * programme), hosted wherever the admins put them. Empty = not published yet,
 * and the card leaves it out (the agreement itself is generated per merchant).
 */
export const MERCHANT_MATERIALS: ReadonlyArray<{ label: string; url: string }> = [
  { label: "Merchant Partnership Proposal 2026–2027", url: process.env.NEXT_PUBLIC_MERCHANT_PROPOSAL_URL ?? "" },
  { label: "Agent Business Development Programme 2026–2027", url: process.env.NEXT_PUBLIC_MERCHANT_AGENT_PROGRAMME_URL ?? "" },
].filter((m) => m.url)

/** What an agent says to a merchant, from the Agent Business Development Programme. */
export const MERCHANT_PITCH: ReadonlyArray<{ title: string; text: string }> = [
  { title: "Free QR code", text: "A unique QR on a flyer or roll-up banner, in store or handed out by staff." },
  { title: `AED ${MERCHANT_INCENTIVE_AED} per unit`, text: "The merchant earns for every unit their customers rent, tracked in their own dashboard." },
  { title: "Client voucher", text: "Each customer receives a discount voucher to use directly with the merchant." },
  { title: "Free promotion", text: "Twice a month, rentsouq.ae features the merchant on its website and social media. Never promise income." },
]

/** The short path the QR opens on fhiglobal.ae; it counts the scan and forwards to rentsouq.ae. */
export const merchantQrPath = (code: string) => `/m/${encodeURIComponent(code)}`

/** The merchant's code as the pages print it: "M-4K7Q". */
export const MERCHANT_CODE_RE = /^M-[A-HJ-NP-Z2-9]{4,6}$/

/**
 * Whether a merchant's agreement covers a day (both ends inclusive). An
 * accepted merchant with no dates yet counts as active.
 */
export function agreementCovers(m: { status: string; agreement_starts_on: string | null; agreement_ends_on: string | null }, day: string): boolean {
  if (m.status !== "accepted") return false
  if (m.agreement_starts_on && day < m.agreement_starts_on) return false
  if (m.agreement_ends_on && day > m.agreement_ends_on) return false
  return true
}

/** "AED 2,400" */
export const fmtAed = (n: number) => `AED ${Math.round(n).toLocaleString("en-AE")}`

/** The Dubai calendar day of an instant, YYYY-MM-DD. */
export const dubaiDay = (d: Date | string | number = new Date()) =>
  new Date(new Date(d).getTime() + 4 * 3600e3).toISOString().slice(0, 10)

/** "15 Dec" style pay-day label for the month after `monthKey` (YYYY-MM). */
export function payDateLabel(monthKey: string, payDay: number): string {
  const [y, m] = monthKey.split("-").map(Number)
  const d = new Date(Date.UTC(y, m, payDay)) // month index m = the NEXT month (0-based m-1 + 1)
  return d.toLocaleDateString("en-AE", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })
}

/** "November 2026" for a YYYY-MM key. */
export function monthLabel(monthKey: string): string {
  const [y, m] = monthKey.split("-").map(Number)
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-AE", { month: "long", year: "numeric", timeZone: "UTC" })
}
