/**
 * Certificate of attendance — per-event design settings.
 *
 * Pure (no server imports): shared by the admin designer, the event input
 * sanitizer and the server-side renderer.
 */

export type Signatory = { name: string; title: string }

export type CertificateSettings = {
  /** Big heading, e.g. "Certificate of Attendance" / "Certificate of Participation". */
  heading: string
  /** Connecting line between the attendee's name and the event title. */
  line: string
  /** Optional one-line note under the event details (e.g. "8 hours · CPD accredited"). */
  note: string
  /** Short brand tagline, bottom-left; "·" or "/" separates lines. */
  tagline: string
  /** Up to two signature blocks. */
  signatories: Signatory[]
}

export const CERTIFICATE_DEFAULTS: CertificateSettings = {
  heading: "Certificate of Attendance",
  line: "for attending",
  note: "",
  tagline: "People · Opportunities · A Brighter Tomorrow",
  signatories: [],
}

export const MAX_SIGNATORIES = 2
const MAX_HEADING = 60
const MAX_LINE = 80
const MAX_NOTE = 120
const MAX_TAGLINE = 120
const MAX_SIG = 60

const str = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "")

/** Coerce stored / submitted settings into a complete, bounded object. */
export function parseCertificateSettings(raw: unknown): CertificateSettings {
  const r = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {}
  const signatories: Signatory[] = Array.isArray(r.signatories)
    ? r.signatories
        .map((s) => {
          const o = s && typeof s === "object" ? (s as Record<string, unknown>) : {}
          return { name: str(o.name, MAX_SIG), title: str(o.title, MAX_SIG) }
        })
        .filter((s) => s.name)
        .slice(0, MAX_SIGNATORIES)
    : []
  return {
    heading: str(r.heading, MAX_HEADING) || CERTIFICATE_DEFAULTS.heading,
    line: str(r.line, MAX_LINE) || CERTIFICATE_DEFAULTS.line,
    note: str(r.note, MAX_NOTE),
    tagline: r.tagline === "" ? "" : str(r.tagline, MAX_TAGLINE) || CERTIFICATE_DEFAULTS.tagline,
    signatories,
  }
}

/** Short, human-checkable certificate number derived from the registration id. */
export function certificateNumber(registrationId: string, eventDate: string | null): string {
  const year = eventDate ? new Date(eventDate).getFullYear() : new Date().getFullYear()
  return `FHI-${year}-${registrationId.replace(/-/g, "").slice(0, 8).toUpperCase()}`
}
