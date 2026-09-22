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

type Style = Record<string, string | number>

const IVORY = "#fbf8f1"
const GOLD_DEEP = "#a98634"
const GOLD_LIGHT = "#e9d59a"

/** Corner mark inside the frame — keys added only when set (Satori rejects undefined). */
function Corner({ top, left }: { top: boolean; left: boolean }) {
  const style: Style = { position: "absolute", width: 72, height: 72 }
  style[top ? "top" : "bottom"] = 86
  style[left ? "left" : "right"] = 86
  style[top ? "borderTop" : "borderBottom"] = `3px solid ${GOLD_DEEP}`
  style[left ? "borderLeft" : "borderRight"] = `3px solid ${GOLD_DEEP}`
  return <div style={style} />
}

/** Gold-foil seal with ribbon tails: brand initials, year, "certified". */
function Seal({ initials, year }: { initials: string; year: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 230, position: "relative" }}>
      {/* ribbon tails, behind the disc */}
      <div style={{ position: "absolute", top: 118, left: 62, width: 44, height: 96, background: NAVY, transform: "rotate(18deg)" }} />
      <div style={{ position: "absolute", top: 118, left: 124, width: 44, height: 96, background: NAVY, transform: "rotate(-18deg)" }} />
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 176,
          height: 176,
          borderRadius: 88,
          background: `radial-gradient(circle at 38% 32%, ${GOLD_LIGHT} 0%, ${GOLD} 45%, ${GOLD_DEEP} 100%)`,
          boxShadow: "0 10px 26px rgba(0,0,0,0.18)",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            width: 146,
            height: 146,
            borderRadius: 73,
            border: `2px solid ${IVORY}`,
            color: NAVY,
          }}
        >
          <div style={{ fontSize: 12, letterSpacing: 4, fontWeight: 700, textTransform: "uppercase", opacity: 0.85 }}>Certified</div>
          <div style={{ fontFamily: "Playfair Display", fontWeight: 700, fontSize: initials.length > 3 ? 34 : 46, lineHeight: 1, marginTop: 4 }}>{initials}</div>
          <div style={{ fontSize: 15, letterSpacing: 3, fontWeight: 700, marginTop: 6 }}>{year}</div>
        </div>
      </div>
    </div>
  )
}

function Signature({ name, title }: { name: string; title: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 430 }}>
      <div style={{ width: 360, height: 2, background: NAVY }} />
      <div style={{ fontSize: 25, fontWeight: 700, color: INK, marginTop: 14 }}>{name}</div>
      {title && <div style={{ fontSize: 19, color: MUTED, marginTop: 4 }}>{title}</div>}
    </div>
  )
}

export function renderCertificate(input: CertificateInput): ImageResponse {
  const brand = eventBrand(input.brandKey)
  const { settings } = input
  const sigs = settings.signatories
  const details = [input.dateLabel, input.venue].filter(Boolean).join("   ·   ")
  // Long names shrink rather than wrap: a two-line name breaks the composition.
  const nameSize = input.attendeeName.length > 30 ? 74 : input.attendeeName.length > 22 ? 90 : 108
  // "Certificate of Attendance" → "CERTIFICATE" + "of Attendance"; other headings split on the first space.
  const [headWord, ...rest] = settings.heading.split(" ")
  const headTail = rest.join(" ")
  const initials = brand.seal
  const year = (input.dateLabel?.match(/\d{4}/) ?? [String(new Date().getFullYear())])[0]

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          background: `radial-gradient(ellipse at center, #ffffff 0%, ${IVORY} 70%, #f3eddc 100%)`,
          fontFamily: "Outfit",
          color: INK,
        }}
      >
        {/* double frame */}
        <div style={{ position: "absolute", top: 40, left: 40, right: 40, bottom: 40, border: `10px solid ${NAVY}` }} />
        <div style={{ position: "absolute", top: 62, left: 62, right: 62, bottom: 62, border: `2px solid ${GOLD_DEEP}` }} />
        <Corner top left />
        <Corner top left={false} />
        <Corner top={false} left />
        <Corner top={false} left={false} />

        {/* header band */}
        <div
          style={{
            position: "absolute",
            top: 64,
            left: 64,
            right: 64,
            height: 172,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 96px",
            background: `linear-gradient(90deg, ${NAVY} 0%, #062b55 100%)`,
            borderBottom: `4px solid ${GOLD}`,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              height: 96,
              padding: brand.logoIsWhite ? "0px" : "12px 22px",
              background: brand.logoIsWhite ? "transparent" : "#ffffff",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={input.logoSrc} alt="" style={{ height: brand.logoIsWhite ? 74 : 70, objectFit: "contain" }} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
            <div style={{ fontSize: 14, letterSpacing: 5, textTransform: "uppercase", color: GOLD, fontWeight: 700 }}>Certificate No.</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: "#ffffff", marginTop: 6, letterSpacing: 1 }}>{input.certificateNo}</div>
          </div>
        </div>

        {/* body */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            width: "100%",
            height: "100%",
            padding: "282px 150px 112px",
          }}
        >
          <div style={{ display: "flex", flex: 1, flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", paddingBottom: 40 }}>
            <div style={{ fontFamily: "Playfair Display", fontWeight: 700, fontSize: 64, letterSpacing: 14, textTransform: "uppercase", color: NAVY, lineHeight: 1 }}>
              {headWord}
            </div>
            {headTail && (
              <div style={{ fontFamily: "Playfair Display", fontStyle: "italic", fontSize: 32, color: GOLD_DEEP, marginTop: 10 }}>{headTail}</div>
            )}
            <div style={{ fontSize: 24, letterSpacing: 4, textTransform: "uppercase", color: MUTED, marginTop: 40, fontWeight: 600 }}>
              This is to certify that
            </div>
            <div
              style={{
                fontFamily: "Playfair Display",
                fontWeight: 700,
                fontSize: nameSize,
                color: NAVY,
                marginTop: 16,
                lineHeight: 1.1,
                maxWidth: 1400,
              }}
            >
              {input.attendeeName}
            </div>
            {/* gold rule with a diamond */}
            <div style={{ display: "flex", alignItems: "center", marginTop: 22 }}>
              <div style={{ width: 200, height: 2, background: GOLD_DEEP }} />
              <div style={{ width: 12, height: 12, background: GOLD_DEEP, transform: "rotate(45deg)", margin: "0 14px" }} />
              <div style={{ width: 200, height: 2, background: GOLD_DEEP }} />
            </div>
            <div style={{ fontFamily: "Playfair Display", fontStyle: "italic", fontSize: 30, color: MUTED, marginTop: 22 }}>{settings.line}</div>
            <div style={{ fontSize: 46, fontWeight: 700, color: NAVY, marginTop: 12, maxWidth: 1320, lineHeight: 1.2 }}>{input.eventTitle}</div>
            {details && <div style={{ fontSize: 24, color: MUTED, marginTop: 16 }}>{details}</div>}
            {settings.note && (
              <div style={{ fontSize: 20, color: GOLD_DEEP, fontWeight: 700, marginTop: 14, letterSpacing: 2, textTransform: "uppercase" }}>{settings.note}</div>
            )}
          </div>

          {/* signatures + seal */}
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", position: "relative" }}>
            {sigs[0] ? <Signature name={sigs[0].name} title={sigs[0].title} /> : <div style={{ width: 430 }} />}
            <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "center", flex: 1 }}>
              <Seal initials={initials} year={year} />
            </div>
            {sigs[1] ? <Signature name={sigs[1].name} title={sigs[1].title} /> : <div style={{ width: 430 }} />}
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
