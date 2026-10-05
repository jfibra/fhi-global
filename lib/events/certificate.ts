/**
 * Certificate of attendance — per-event design settings.
 *
 * Pure (no server imports): shared by the admin designer, the event input
 * sanitizer and the server-side renderer.
 */

export type Signatory = { name: string; title: string }

/**
 * Who may fetch their own certificate from the public page (QR at the venue).
 * The team chose "open" for every event — anyone types a name and downloads —
 * so there is no admin control; the other modes remain for a future toggle.
 */
export type SelfService = "off" | "registered" | "open"
export const SELF_SERVICE_MODES: SelfService[] = ["off", "registered", "open"]

/**
 * The certificate's look, picked when the event is created (and changeable in
 * the Certificates window). Every design shows the same facts; only the art
 * differs. "classic" is the original design — events saved before designs
 * existed have no `design` and keep it.
 */
export type CertificateDesign = "classic" | "royal" | "arabesque" | "skyline"

export const CERTIFICATE_DESIGNS: { key: CertificateDesign; name: string; blurb: string }[] = [
  { key: "classic", name: "Classic Gold", blurb: "Ivory sheet, navy corner bands and the gold seal" },
  { key: "royal", name: "Royal Navy", blurb: "Midnight navy, gold lettering and a calligraphy name" },
  { key: "arabesque", name: "Arabesque", blurb: "Parchment framed in Arabic geometry under a gold arch" },
  { key: "skyline", name: "Skyline", blurb: "A modern split with the Dubai skyline in gold" },
]

const DESIGN_KEYS = CERTIFICATE_DESIGNS.map((d) => d.key)

export const isCertificateDesign = (v: unknown): v is CertificateDesign => DESIGN_KEYS.includes(v as CertificateDesign)

export type CertificateSettings = {
  design: CertificateDesign
  /** Big heading, e.g. "Certificate of Attendance" / "Certificate of Participation". */
  heading: string
  /** Connecting line between the attendee's name and the event title. */
  line: string
  /** Optional one-line note under the event details (e.g. "8 hours · CPD accredited"). */
  note: string
  /** Up to two signature blocks. */
  signatories: Signatory[]
  selfService: SelfService
}

export const CERTIFICATE_DEFAULTS: CertificateSettings = {
  design: "classic",
  heading: "Certificate of Attendance",
  line: "for attending",
  note: "",
  signatories: [],
  selfService: "open",
}

export const MAX_SIGNATORIES = 2
const MAX_HEADING = 60
const MAX_LINE = 80
const MAX_NOTE = 120
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
    design: isCertificateDesign(r.design) ? r.design : "classic",
    heading: str(r.heading, MAX_HEADING) || CERTIFICATE_DEFAULTS.heading,
    line: str(r.line, MAX_LINE) || CERTIFICATE_DEFAULTS.line,
    note: str(r.note, MAX_NOTE),
    signatories,
    selfService: SELF_SERVICE_MODES.includes(r.selfService as SelfService) ? (r.selfService as SelfService) : "open",
  }
}

/** Short, human-checkable certificate number derived from the registration id. */
export function certificateNumber(registrationId: string, eventDate: string | null): string {
  const year = eventDate ? new Date(eventDate).getFullYear() : new Date().getFullYear()
  return `FHI-${year}-${registrationId.replace(/-/g, "").slice(0, 8).toUpperCase()}`
}
