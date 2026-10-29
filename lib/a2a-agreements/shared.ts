// Saved A2A agreements (migration 082) — the pieces the page, the data service
// and the API routes all share, so lists, limits and rules can't drift apart.
// No dependencies: safe in client and server bundles. The zod schema the
// routes validate with lives in ./schema.ts and reuses these limits.
//
// Documents: per party, the agency's papers Dubai brokerages exchange before
// working a deal together (and that the paying side needs before releasing a
// commission share). "Owner" means the agency's owner as named on its trade
// licence — not the property owner, whose papers go through Owner Documents.
// Plus one agreement-level slot for a copy signed on paper.

import type { A2AInput, A2AParty } from "@/lib/a2a-agreement"

export type A2APartyKey = "A" | "B" | "C"
export const A2A_PARTY_KEYS: readonly A2APartyKey[] = ["A", "B", "C"]

export const A2A_PARTY_DOC_TYPES = ["brn", "orn", "trade_licence", "vat", "owner_passport", "owner_emirates_id"] as const
export type A2APartyDocType = (typeof A2A_PARTY_DOC_TYPES)[number]
export const A2A_DOC_TYPES = [...A2A_PARTY_DOC_TYPES, "signed_copy"] as const
export type A2ADocType = (typeof A2A_DOC_TYPES)[number]

export const A2A_DOC_LABELS: Record<A2ADocType, { label: string; hint: string }> = {
  brn: { label: "BRN card", hint: "The agent's RERA broker registration card" },
  orn: { label: "ORN certificate", hint: "The agency's RERA office registration" },
  trade_licence: { label: "Trade licence", hint: "Copy of the agency's trade licence" },
  vat: { label: "VAT certificate", hint: "Not VAT-registered yet? Attach the VAT undertaking letter instead" },
  owner_passport: { label: "Owner's passport", hint: "The agency owner, as named on the trade licence" },
  owner_emirates_id: { label: "Owner's Emirates ID", hint: "Front and back" },
  signed_copy: { label: "Signed copy", hint: "The agreement signed on paper — a scan or a photo" },
}

/** Private Supabase bucket the browser uploads to (migration 082); the API then moves files to S3. */
export const A2A_DOCS_BUCKET = "a2a-documents"

export const A2A_MAX_FILE_MB = 25
export const A2A_MAX_FILE_BYTES = A2A_MAX_FILE_MB * 1024 * 1024
export const A2A_MAX_FILES_PER_SLOT = 4
export const A2A_MAX_FILES_PER_AGREEMENT = 60
export const A2A_ALLOWED_MIME: readonly string[] = ["image/jpeg", "image/png", "application/pdf"]
export const A2A_ACCEPT = ".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf"

export function isA2ADocType(v: unknown): v is A2ADocType {
  return typeof v === "string" && (A2A_DOC_TYPES as readonly string[]).includes(v)
}

/** Longest value each text box keeps — the form's maxLength and the API's limits. */
export const A2A_TEXT_LIMITS = {
  name: 200,
  agency: 200,
  licence: 60, // BRN / ORN
  phone: 60,
  email: 320,
  reference: 300,
  short: 40, // dates, shares, notice days
} as const

// A drawn signature: a PNG data URL, and nothing else — admins' browsers render
// what the creator saved, so a stored value is never trusted as a URL.
const SIGNATURE_RE = /^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/
export const A2A_MAX_SIGNATURE_CHARS = 400_000

export function isSignatureDataUrl(v: unknown): v is string {
  return typeof v === "string" && v.length <= A2A_MAX_SIGNATURE_CHARS && SIGNATURE_RE.test(v)
}

/** Fields that block Submit and the PDF download until filled in. */
export type A2ARequiredField = "partyA.fullName" | "partyB.fullName" | "partyC.fullName" | "scope"

/** Every party needs a full name and the agreement a scope — Submit and Download share the rule. */
export function missingForSubmit(input: A2AInput): A2ARequiredField[] {
  const missing: A2ARequiredField[] = []
  if (!input.partyA.fullName.trim()) missing.push("partyA.fullName")
  if (!input.partyB.fullName.trim()) missing.push("partyB.fullName")
  if (input.partyC && !input.partyC.fullName.trim()) missing.push("partyC.fullName")
  if (!input.scope) missing.push("scope")
  return missing
}

/** "Sajid Akber · Anthony Leuterio · Michelle Guinto" — the label stored with each agreement. */
export function partyNames(input: A2AInput): string {
  return [input.partyA, input.partyB, input.partyC]
    .map((p) => p?.fullName.trim() ?? "")
    .filter(Boolean)
    .join(" · ")
}

/** The stored label as people read it: "Sajid Akber, Anthony Leuterio & Michelle Guinto". */
export function readablePartyNames(stored: string): string {
  const names = stored.split(" · ").map((n) => n.trim()).filter(Boolean)
  if (names.length <= 1) return names[0] ?? ""
  return `${names.slice(0, -1).join(", ")} & ${names[names.length - 1]}`
}

const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "")
const record = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {}

function normalizeParty(raw: unknown): A2AParty {
  const p = record(raw)
  const L = A2A_TEXT_LIMITS
  return {
    fullName: str(p.fullName, L.name),
    agency: str(p.agency, L.agency),
    brn: str(p.brn, L.licence),
    orn: str(p.orn, L.licence),
    phone: str(p.phone, L.phone),
    email: str(p.email, L.email),
    signatureDataUrl: isSignatureDataUrl(p.signatureDataUrl) ? p.signatureDataUrl : undefined,
    signedName: str(p.signedName, L.name),
    signedDate: str(p.signedDate, L.short),
  }
}

/**
 * A saved payload as a complete A2AInput: missing fields filled, over-long ones
 * cut, and any signature that isn't a PNG data URL dropped. Applied to every
 * agreement loaded from the database before the form or the PDF sees it.
 */
export function normalizeA2AInput(raw: unknown): A2AInput {
  const r = record(raw)
  const L = A2A_TEXT_LIMITS
  const scope = r.scope === "inventory" || r.scope === "client" || r.scope === "both" ? r.scope : ""
  const hasC = Object.keys(record(r.partyC)).length > 0
  return {
    date: str(r.date, L.short),
    partyA: normalizeParty(r.partyA),
    partyB: normalizeParty(r.partyB),
    ...(hasC ? { partyC: normalizeParty(r.partyC), splitC: str(r.splitC, L.short) } : {}),
    scope,
    propertyRef: str(r.propertyRef, L.reference),
    clientName: str(r.clientName, L.name),
    splitA: str(r.splitA, L.short),
    splitB: str(r.splitB, L.short),
    noticePeriodDays: str(r.noticePeriodDays, L.short),
    validUntil: str(r.validUntil, L.short),
  }
}
