import { NextRequest, NextResponse } from "next/server"
import { createAdminSupabase } from "@/lib/admin-supabase"
import { verifyClaim } from "@/lib/events/certificate-token"
import { parseCertificateSettings } from "@/lib/events/certificate"
import {
  buildCertificateInput,
  certificateFilename,
  certificatePdfFromPng,
  loadCertificateEvent,
  renderCertificatePng,
} from "@/lib/events/certificate-server"
import { allowRequest, clientIp } from "@/lib/rate-limit"

export const runtime = "nodejs"
export const maxDuration = 60

/**
 * Streams a claimed certificate: `format=png` for the on-page preview,
 * `format=pdf` (default) as a download. Requires a valid claim token from
 * /api/events/certificate/claim. PDF downloads are logged.
 */
export async function GET(req: NextRequest) {
  const ip = clientIp(req.headers)
  if (!allowRequest(`cert-file:${ip}`, 20, 60_000)) {
    return NextResponse.json({ error: "Too many requests — please wait a minute" }, { status: 429 })
  }
  const token = req.nextUrl.searchParams.get("token") ?? ""
  const format = req.nextUrl.searchParams.get("format") === "png" ? "png" : "pdf"
  const claim = verifyClaim(token)
  if (!claim) return NextResponse.json({ error: "This link has expired — please enter your details again" }, { status: 401 })

  const admin = createAdminSupabase()
  const event = await loadCertificateEvent(admin, claim.e)
  if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 })
  if (parseCertificateSettings(event.certificate).selfService === "off") {
    return NextResponse.json({ error: "Certificates are not available for this event" }, { status: 403 })
  }

  const input = await buildCertificateInput({
    event,
    registration: { id: claim.r ?? "00000000-0000-0000-0000-000000000000", full_name: claim.n, email: claim.m ?? "" },
    origin: req.nextUrl.origin,
  })
  const png = await renderCertificatePng(input)

  if (format === "png") {
    return new NextResponse(new Uint8Array(png), {
      headers: { "Content-Type": "image/png", "Cache-Control": "private, no-store" },
    })
  }

  const pdf = await certificatePdfFromPng(png, { title: input.settings.heading, attendee: input.attendeeName })
  // Best-effort log — a logging hiccup must never block the download.
  void admin
    .from("event_certificate_downloads")
    .insert({ event_id: event.id, registration_id: claim.r ?? null, full_name: input.attendeeName, email: claim.m ?? null, ip })
    .then(({ error }) => error && console.error("[certificate/file] log failed:", error.message))

  const filename = certificateFilename(input.attendeeName, event.slug)
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename.replace(/"/g, "")}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "Cache-Control": "private, no-store",
    },
  })
}
