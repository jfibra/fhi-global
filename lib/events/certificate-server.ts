import { PDFDocument } from "pdf-lib"
import type { SupabaseClient } from "@supabase/supabase-js"
import { eventBrand } from "@/lib/events/brands"
import { certificateNumber, parseCertificateSettings, type CertificateSettings } from "@/lib/events/certificate"
import {
  CERT_HEIGHT,
  CERT_WIDTH,
  certificateDateLabel,
  loadCertificateFonts,
  renderCertificate,
  type CertificateInput,
} from "@/lib/events/certificate-image"
import { titleCaseName } from "@/lib/public-profile"

/** Server-only glue between the database rows and the renderer. */

export type CertificateEventRow = {
  id: string
  slug: string | null
  title: string
  event_date: string | null
  venue: string | null
  brand: string | null
  certificate: unknown
}

export type CertificateRegistrationRow = { id: string; full_name: string; email: string }

export const SAMPLE_ATTENDEE = "Maria Clara Santos"

export async function loadCertificateEvent(admin: SupabaseClient, eventId: string): Promise<CertificateEventRow | null> {
  const { data } = await admin
    .from("events")
    .select("id, slug, title, event_date, venue, brand, certificate")
    .eq("id", eventId)
    .is("deleted_at", null)
    .maybeSingle()
  return (data as CertificateEventRow | null) ?? null
}

export async function loadCertificateRegistration(
  admin: SupabaseClient,
  eventId: string,
  registrationId: string,
): Promise<CertificateRegistrationRow | null> {
  const { data } = await admin
    .from("event_registrations")
    .select("id, full_name, email")
    .eq("event_id", eventId)
    .eq("id", registrationId)
    .maybeSingle()
  return (data as CertificateRegistrationRow | null) ?? null
}

export async function buildCertificateInput(opts: {
  event: CertificateEventRow
  registration: CertificateRegistrationRow | null
  /** Unsaved designer values for a live preview; omit to use the saved design. */
  settingsOverride?: CertificateSettings
  /** Public origin to fetch fonts and the logo from (this deployment). */
  origin: string
}): Promise<CertificateInput> {
  const { event, registration } = opts
  const brand = eventBrand(event.brand)
  const fonts = await loadCertificateFonts(opts.origin)
  return {
    attendeeName: registration ? titleCaseName(registration.full_name) : SAMPLE_ATTENDEE,
    eventTitle: event.title,
    dateLabel: certificateDateLabel(event.event_date),
    venue: event.venue,
    brandKey: brand.key,
    // Logo filenames contain spaces; Satori needs a proper URL.
    logoSrc: `${opts.origin}${encodeURI(brand.logo)}`,
    sealMarkSrc: brand.sealMark ? `${opts.origin}${encodeURI(brand.sealMark)}` : null,
    sealSrc: `${opts.origin}/seals/${brand.key}.png`,
    certificateNo: certificateNumber(registration?.id ?? "00000000-0000-0000-0000-000000000000", event.event_date),
    settings: opts.settingsOverride ?? parseCertificateSettings(event.certificate),
    fonts,
  }
}

export async function renderCertificatePng(input: CertificateInput): Promise<Buffer> {
  const res = renderCertificate(input)
  return Buffer.from(await res.arrayBuffer())
}

/** Wrap the PNG in a single-page A4-landscape PDF — what attendees receive. */
export async function certificatePdfFromPng(png: Buffer, meta: { title: string; attendee: string }): Promise<Buffer> {
  const doc = await PDFDocument.create()
  const A4_LANDSCAPE: [number, number] = [841.89, 595.28]
  const page = doc.addPage(A4_LANDSCAPE)
  const img = await doc.embedPng(png)
  // Same aspect ratio as the page (1754×1240 ≈ 1.414), so it fills it exactly.
  const scale = Math.min(A4_LANDSCAPE[0] / CERT_WIDTH, A4_LANDSCAPE[1] / CERT_HEIGHT)
  const w = CERT_WIDTH * scale
  const h = CERT_HEIGHT * scale
  page.drawImage(img, { x: (A4_LANDSCAPE[0] - w) / 2, y: (A4_LANDSCAPE[1] - h) / 2, width: w, height: h })
  doc.setTitle(`${meta.title} — ${meta.attendee}`)
  doc.setAuthor("FHI Global Property")
  doc.setProducer("fhiglobal.ae")
  return Buffer.from(await doc.save())
}

/** "Certificate - Ana Fragata - dubai-summit-2026.pdf" — safe for every mail client. */
export function certificateFilename(attendee: string, slug: string | null): string {
  const safe = attendee.replace(/[^\p{L}\p{N} .'-]/gu, "").trim().slice(0, 60)
  return `Certificate - ${safe}${slug ? ` - ${slug.slice(0, 40)}` : ""}.pdf`
}
