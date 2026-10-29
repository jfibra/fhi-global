import { z } from "zod"
import { A2A_MAX_SIGNATURE_CHARS, A2A_TEXT_LIMITS as L, isSignatureDataUrl } from "./shared"

// What the API stores as a2a_agreements.data — the A2AInput the page edits,
// bounded field by field. Unknown keys are stripped. The form caps every text
// box at the same lengths (maxLength), so a failure here means a tampered
// request or an oversized signature, not a typo.

const PartySchema = z.object({
  fullName: z.string().max(L.name),
  agency: z.string().max(L.agency),
  brn: z.string().max(L.licence),
  orn: z.string().max(L.licence),
  phone: z.string().max(L.phone),
  email: z.string().max(L.email),
  signatureDataUrl: z
    .string()
    .max(A2A_MAX_SIGNATURE_CHARS)
    .refine(isSignatureDataUrl, "Signature must be a PNG image")
    .optional(),
  signedName: z.string().max(L.name),
  signedDate: z.string().max(L.short),
})

export const A2AInputSchema = z.object({
  date: z.string().max(L.short),
  partyA: PartySchema,
  partyB: PartySchema,
  partyC: PartySchema.optional(),
  scope: z.enum(["inventory", "client", "both", ""]),
  propertyRef: z.string().max(L.reference),
  clientName: z.string().max(L.name),
  splitA: z.string().max(L.short),
  splitB: z.string().max(L.short),
  splitC: z.string().max(L.short).optional(),
  noticePeriodDays: z.string().max(L.short),
  validUntil: z.string().max(L.short),
})

/** A readable reason for a payload the schema refused. */
export function a2aSchemaError(error: z.ZodError): string {
  const signature = error.issues.some((i) => i.path.includes("signatureDataUrl"))
  return signature
    ? "A signature couldn't be saved — clear it and sign again."
    : "Some details are too long or invalid — check the form and try again."
}
