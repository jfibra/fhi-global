import { ImageResponse } from "next/og"
import { eventBrand } from "@/lib/events/brands"
import type { CertificateSettings } from "@/lib/events/certificate"

/**
 * Certificate of attendance — rendered server-side to PNG with next/og
 * (Satori), so the preview in the admin and the PDF emailed to the attendee
 * come from the same code and look identical.
 *
 * A4 landscape at 150 dpi. Design: white sheet, thin gold frame with corner
 * marks, brand logo top-left, certificate number top-right, the attendee's
 * name in Playfair Display, and up to two signature blocks.
 */

export const CERT_WIDTH = 1754
export const CERT_HEIGHT = 1240

const NAVY = "#001f3f"
const GOLD = "#c9a449"
const INK = "#0d1117"
const MUTED = "#6b7280"

export type CertificateFont = {
  name: string
  data: ArrayBuffer
  weight: 400 | 600 | 700
  style: "normal" | "italic"
}

export const CERTIFICATE_FONT_FILES: Array<Omit<CertificateFont, "data"> & { file: string }> = [
  { name: "Outfit", file: "Outfit-400.woff", weight: 400, style: "normal" },
  { name: "Outfit", file: "Outfit-600.woff", weight: 600, style: "normal" },
  { name: "Outfit", file: "Outfit-700.woff", weight: 700, style: "normal" },
  { name: "Playfair Display", file: "PlayfairDisplay-700.woff", weight: 700, style: "normal" },
  { name: "Playfair Display", file: "PlayfairDisplay-400i.woff", weight: 400, style: "italic" },
]

export type CertificateInput = {
  attendeeName: string
  eventTitle: string
  /** Already formatted, e.g. "Friday, 25 September 2026". */
  dateLabel: string | null
  venue: string | null
  brandKey: string
  /** Absolute URL of the brand logo (Satori fetches it). */
  logoSrc: string
  certificateNo: string
  settings: CertificateSettings
  fonts: CertificateFont[]
}

/** Fetch fonts from the site's own /public/fonts. Cached per process. */
const fontCache = new Map<string, Promise<ArrayBuffer>>()
export async function loadCertificateFonts(origin: string): Promise<CertificateFont[]> {
  return Promise.all(
    CERTIFICATE_FONT_FILES.map(async ({ file, ...meta }) => {
      const url = `${origin}/fonts/${file}`
      let p = fontCache.get(url)
      if (!p) {
        p = fetch(url).then((r) => {
          if (!r.ok) throw new Error(`font ${file}: HTTP ${r.status}`)
          return r.arrayBuffer()
        })
        fontCache.set(url, p)
      }
      return { ...meta, data: await p }
    }),
  )
}

function Corner({ top, left }: { top: boolean; left: boolean }) {
  // Satori parses border/position values as strings, so keys must be present
  // only when set — an `undefined` value throws inside its style parser.
  const style: Record<string, string | number> = { position: "absolute", width: 64, height: 64 }
  style[top ? "top" : "bottom"] = 74
  style[left ? "left" : "right"] = 74
  style[top ? "borderTop" : "borderBottom"] = `4px solid ${GOLD}`
  style[left ? "borderLeft" : "borderRight"] = `4px solid ${GOLD}`
  return <div style={style} />
}

export function renderCertificate(input: CertificateInput): ImageResponse {
  const brand = eventBrand(input.brandKey)
  const { settings } = input
  const sigs = settings.signatories
  const details = [input.dateLabel, input.venue].filter(Boolean).join("   ·   ")
  // Long names shrink rather than wrap: a two-line name breaks the composition.
  const nameSize = input.attendeeName.length > 30 ? 66 : input.attendeeName.length > 22 ? 78 : 92

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          background: "#ffffff",
          fontFamily: "Outfit",
          color: INK,
        }}
      >
        {/* frame */}
        <div style={{ position: "absolute", top: 48, left: 48, right: 48, bottom: 48, border: `2px solid ${GOLD}` }} />
        <div style={{ position: "absolute", top: 60, left: 60, right: 60, bottom: 60, border: `1px solid ${NAVY}`, opacity: 0.25 }} />
        <Corner top left />
        <Corner top left={false} />
        <Corner top={false} left />
        <Corner top={false} left={false} />

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            width: "100%",
            height: "100%",
            padding: "112px 150px 108px",
          }}
        >
          {/* top: logo + number */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                height: 92,
                padding: brand.logoIsWhite ? "14px 22px" : "0px",
                background: brand.logoIsWhite ? NAVY : "transparent",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={input.logoSrc} alt="" style={{ height: brand.logoIsWhite ? 56 : 84, objectFit: "contain" }} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
              <div style={{ fontSize: 15, letterSpacing: 4, textTransform: "uppercase", color: MUTED, fontWeight: 600 }}>
                Certificate No.
              </div>
              <div style={{ fontSize: 22, fontWeight: 700, color: NAVY, marginTop: 4 }}>{input.certificateNo}</div>
            </div>
          </div>

          {/* centre */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
            <div style={{ fontSize: 26, letterSpacing: 10, textTransform: "uppercase", color: GOLD, fontWeight: 700 }}>
              {settings.heading}
            </div>
            <div style={{ fontSize: 26, color: MUTED, marginTop: 34 }}>This is to certify that</div>
            <div
              style={{
                fontFamily: "Playfair Display",
                fontWeight: 700,
                fontSize: nameSize,
                color: NAVY,
                marginTop: 18,
                lineHeight: 1.1,
                maxWidth: 1380,
              }}
            >
              {input.attendeeName}
            </div>
            <div style={{ width: 180, height: 3, background: GOLD, marginTop: 26 }} />
            <div style={{ fontFamily: "Playfair Display", fontStyle: "italic", fontSize: 30, color: MUTED, marginTop: 26 }}>
              {settings.line}
            </div>
            <div style={{ fontSize: 44, fontWeight: 700, color: NAVY, marginTop: 14, maxWidth: 1300, lineHeight: 1.2 }}>
              {input.eventTitle}
            </div>
            {details && <div style={{ fontSize: 24, color: MUTED, marginTop: 18 }}>{details}</div>}
            {settings.note && (
              <div style={{ fontSize: 20, color: GOLD, fontWeight: 600, marginTop: 16, letterSpacing: 1 }}>{settings.note}</div>
            )}
          </div>

          {/* bottom: signatories + brand line */}
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: sigs.length === 2 ? "space-between" : "center" }}>
            {sigs.map((s, i) => (
              <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 420 }}>
                <div style={{ width: 340, height: 2, background: NAVY, opacity: 0.7 }} />
                <div style={{ fontSize: 24, fontWeight: 700, color: INK, marginTop: 14 }}>{s.name}</div>
                {s.title && <div style={{ fontSize: 19, color: MUTED, marginTop: 4 }}>{s.title}</div>}
              </div>
            ))}
            <div
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                bottom: 78,
                display: "flex",
                justifyContent: "center",
                fontSize: 15,
                letterSpacing: 3,
                textTransform: "uppercase",
                color: MUTED,
              }}
            >
              {brand.name} · fhiglobal.ae
            </div>
          </div>
        </div>
      </div>
    ),
    {
      width: CERT_WIDTH,
      height: CERT_HEIGHT,
      fonts: input.fonts.map((f) => ({ name: f.name, data: f.data, weight: f.weight, style: f.style })),
    },
  )
}

/** Same date style as the confirmation email, in Dubai time. */
export function certificateDateLabel(iso: string | null): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Dubai" })
}
