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

const IVORY = "#fbf8f1"
const GOLD_DEEP = "#a98634"
const GOLD_LIGHT = "#efdda6"
const NAVY_DEEP = "#06213f"

/** Corner bands as one full-canvas SVG: exact triangles with a parallel gold edge. */
function cornerBandsSvg(): string {
  const W = CERT_WIDTH, H = CERT_HEIGHT
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">` +
    `<defs>` +
    `<linearGradient id="n" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${NAVY}"/><stop offset="1" stop-color="${NAVY_DEEP}"/></linearGradient>` +
    `<linearGradient id="g" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${GOLD_LIGHT}"/><stop offset="0.5" stop-color="${GOLD}"/><stop offset="1" stop-color="${GOLD_DEEP}"/></linearGradient>` +
    `</defs>` +
    // top-left: slim band
    `<polygon points="300,0 328,0 0,206 0,188" fill="url(#g)"/>` +
    `<polygon points="0,0 300,0 0,188" fill="url(#n)"/>` +
    // bottom-right: broad band
    `<polygon points="960,${H} 926,${H} ${W},612 ${W},640" fill="url(#g)"/>` +
    `<polygon points="960,${H} ${W},640 ${W},${H}" fill="url(#n)"/>` +
    `</svg>`
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

function CornerBands() {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={cornerBandsSvg()} alt="" width={CERT_WIDTH} height={CERT_HEIGHT} style={{ position: "absolute", left: 0, top: 0 }} />
  )
}

/** Faint stylised skyline along the bottom — crisp at any size, never muddy. */
function Skyline({ left, width, baseline, color }: { left: number; width: number; baseline: number; color: string }) {
  // [x offset, tower width, tower height]; the tall spire reads as Burj Khalifa without depicting it.
  const towers: Array<[number, number, number]> = [
    [0, 46, 110], [58, 34, 170], [104, 60, 140], [176, 40, 230], [228, 70, 120], [312, 36, 300], [358, 52, 190],
    [424, 30, 420], [466, 64, 160], [544, 44, 260], [600, 38, 130], [650, 80, 210], [744, 34, 340], [790, 56, 150],
    [860, 26, 560], [898, 60, 200], [972, 44, 280], [1030, 70, 130], [1114, 36, 180], [1164, 54, 240],
  ]
  return (
    <div style={{ position: "absolute", left, bottom: baseline, width, height: 600, display: "flex" }}>
      {towers.map(([x, w, h0], i) => {
        const h = Math.round(h0 * 0.68)
        return (
        <div key={i} style={{ position: "absolute", left: x, bottom: 0, width: w, height: h, background: color, display: "flex" }}>
          {/* setback on top, then a slimmer crown, then a spire on the tall ones — reads as buildings, not bars */}
          <div style={{ position: "absolute", left: w * 0.18, top: -h * 0.16, width: w * 0.64, height: h * 0.16 + 2, background: color }} />
          <div style={{ position: "absolute", left: w * 0.36, top: -h * 0.26, width: w * 0.28, height: h * 0.1 + 2, background: color }} />
          {h > 250 && <div style={{ position: "absolute", left: w / 2 - 2, top: -h * 0.26 - 48, width: 4, height: 50, background: color }} />}
          {/* window rhythm */}
          {[0.25, 0.5, 0.75].map((f) => (
            <div key={f} style={{ position: "absolute", left: w * f - 1, top: 8, width: 2, height: Math.max(0, h - 16), background: "rgba(255,255,255,0.35)" }} />
          ))}
        </div>
        )
      })}
      <div style={{ position: "absolute", left: 0, bottom: -2, width, height: 2, background: color }} />
    </div>
  )
}

/** Laurel wreath as inline SVG (data URI) — smooth leaves, unlike stacked divs. */
function laurelSvg(size: number, color: string): string {
  const c = size / 2
  const r = size / 2 - 22
  const leaf = (deg: number, side: 1 | -1) => {
    const a = (Math.PI * deg) / 180
    const x = c + side * Math.sin(a) * r
    const y = c - Math.cos(a) * r
    const rot = side * deg
    return `<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="15" ry="6" transform="rotate(${rot.toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)})"/>` +
      `<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="15" ry="6" transform="rotate(${(rot + side * 34).toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)})" opacity="0.7"/>`
  }
  const arc = (side: 1 | -1) => {
    const a0 = (Math.PI * 38) / 180, a1 = (Math.PI * 152) / 180
    const p = (a: number) => `${(c + side * Math.sin(a) * r).toFixed(1)} ${(c - Math.cos(a) * r).toFixed(1)}`
    return `<path d="M ${p(a0)} A ${r} ${r} 0 0 ${side === 1 ? 1 : 0} ${p(a1)}" fill="none" stroke="${color}" stroke-width="2.5"/>`
  }
  const leaves = [-1, 1].flatMap((side) => Array.from({ length: 8 }, (_, i) => leaf(44 + i * 15, side as 1 | -1)))
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">` +
    `${arc(1)}${arc(-1)}<g fill="${color}">${leaves.join("")}</g></svg>`
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

function Seal({ mark, year }: { mark: string; year: string }) {
  const R = 118
  return (
    <div style={{ position: "relative", width: R * 2, height: R * 2, display: "flex" }}>
      <div
        style={{
          position: "absolute", left: 0, top: 0, width: R * 2, height: R * 2, borderRadius: R,
          background: `radial-gradient(circle at 36% 30%, #f7ead0 0%, ${GOLD_LIGHT} 22%, ${GOLD} 58%, ${GOLD_DEEP} 100%)`,
          boxShadow: "0 14px 34px rgba(0,0,0,0.22)",
        }}
      />
      <div style={{ position: "absolute", left: 12, top: 12, width: R * 2 - 24, height: R * 2 - 24, borderRadius: R - 12, border: "2px solid rgba(255,255,255,0.7)" }} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={laurelSvg(R * 2, "#8a6b22")} alt="" width={R * 2} height={R * 2} style={{ position: "absolute", left: 0, top: 0 }} />
      <div style={{ position: "absolute", left: 0, top: 0, width: R * 2, height: R * 2, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: NAVY }}>
        <div style={{ fontSize: 13, letterSpacing: 4, fontWeight: 700, textTransform: "uppercase" }}>Certified</div>
        <div style={{ fontFamily: "Playfair Display", fontWeight: 700, fontSize: mark.length > 3 ? 44 : 60, lineHeight: 1, marginTop: 4 }}>{mark}</div>
        <div style={{ fontSize: 17, letterSpacing: 3, fontWeight: 700, marginTop: 8 }}>{year}</div>
        <div style={{ width: 10, height: 10, background: NAVY, transform: "rotate(45deg)", marginTop: 12, opacity: 0.8 }} />
      </div>
    </div>
  )
}

function Signature({ name, title }: { name: string; title: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 380 }}>
      <div style={{ width: 320, height: 2, background: NAVY }} />
      <div style={{ fontSize: 23, fontWeight: 700, color: INK, marginTop: 12 }}>{name}</div>
      {title && <div style={{ fontSize: 17, color: MUTED, marginTop: 3 }}>{title}</div>}
    </div>
  )
}

export function renderCertificate(input: CertificateInput): ImageResponse {
  const brand = eventBrand(input.brandKey)
  const { settings } = input
  const sigs = settings.signatories
  const details = [input.dateLabel, input.venue].filter(Boolean)
  const nameSize = input.attendeeName.length > 30 ? 74 : input.attendeeName.length > 22 ? 90 : 106
  const [headWord, ...rest] = settings.heading.split(" ")
  const headTail = rest.join(" ")
  const year = (input.dateLabel?.match(/\d{4}/) ?? [String(new Date().getFullYear())])[0]
  const taglineLines = settings.tagline.split(/\s*[·/|]\s*/).map((t) => t.trim()).filter(Boolean).slice(0, 3)

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%", height: "100%", display: "flex", position: "relative", overflow: "hidden",
          background: `linear-gradient(135deg, #ffffff 0%, ${IVORY} 55%, #f4eee0 100%)`,
          fontFamily: "Outfit", color: INK,
        }}
      >
        <Skyline left={470} width={1220} baseline={44} color="rgba(0,31,63,0.065)" />

        <CornerBands />

        {/* hairline frame */}
        <div style={{ position: "absolute", top: 34, left: 34, right: 34, bottom: 34, border: `1.5px solid ${GOLD}`, opacity: 0.8 }} />

        {/* logo */}
        <div style={{ position: "absolute", left: 156, top: 98, display: "flex", alignItems: "center", height: 130, padding: brand.logoIsWhite ? "16px 26px" : "0px", background: brand.logoIsWhite ? NAVY : "transparent" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={input.logoSrc} alt="" style={{ height: brand.logoIsWhite ? 84 : 124, objectFit: "contain" }} />
        </div>

        {/* certificate number */}
        <div style={{ position: "absolute", right: 130, top: 92, display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
          <div style={{ fontSize: 14, letterSpacing: 5, textTransform: "uppercase", color: MUTED, fontWeight: 600 }}>Certificate No.</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: NAVY, marginTop: 6, letterSpacing: 1 }}>{input.certificateNo}</div>
          <div style={{ width: 96, height: 2, background: GOLD, marginTop: 10 }} />
        </div>

        {/* centre stack */}
        <div style={{ position: "absolute", left: 0, right: 0, top: 262, display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
          <div style={{ fontFamily: "Playfair Display", fontWeight: 700, fontSize: 72, letterSpacing: 18, textTransform: "uppercase", color: NAVY, lineHeight: 1 }}>{headWord}</div>
          {headTail && <div style={{ fontSize: 30, letterSpacing: 12, textTransform: "uppercase", color: GOLD_DEEP, fontWeight: 600, marginTop: 16 }}>{headTail}</div>}
          <div style={{ width: 70, height: 2, background: GOLD, marginTop: 26 }} />
          <div style={{ fontSize: 22, letterSpacing: 6, textTransform: "uppercase", color: MUTED, marginTop: 40, fontWeight: 500 }}>This is to certify that</div>
          <div style={{ fontFamily: "Playfair Display", fontWeight: 700, fontSize: nameSize, color: NAVY, marginTop: 14, lineHeight: 1.1, maxWidth: 1360 }}>{input.attendeeName}</div>
          <div style={{ width: 640, height: 2, background: `linear-gradient(90deg, rgba(201,164,73,0) 0%, ${GOLD} 20%, ${GOLD} 80%, rgba(201,164,73,0) 100%)`, marginTop: 22 }} />
          <div style={{ fontSize: 20, letterSpacing: 6, textTransform: "uppercase", color: MUTED, marginTop: 30, fontWeight: 500 }}>{settings.line}</div>
          <div style={{ fontSize: 46, fontWeight: 700, color: NAVY, marginTop: 12, maxWidth: 1240, lineHeight: 1.2 }}>{input.eventTitle}</div>
          {details.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", fontSize: 24, color: MUTED, marginTop: 16 }}>
              {details.map((d, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center" }}>
                  {i > 0 && <div style={{ width: 6, height: 6, borderRadius: 3, background: GOLD, margin: "0 18px" }} />}
                  <div>{d}</div>
                </div>
              ))}
            </div>
          )}
          {settings.note && <div style={{ fontSize: 19, color: GOLD_DEEP, fontWeight: 700, marginTop: 14, letterSpacing: 3, textTransform: "uppercase" }}>{settings.note}</div>}
        </div>

        {/* tagline, bottom-left */}
        {taglineLines.length > 0 && (
          <div style={{ position: "absolute", left: 130, bottom: 118, display: "flex", flexDirection: "column" }}>
            {taglineLines.map((t, i) => (
              <div key={i} style={{ fontSize: 17, letterSpacing: 5, textTransform: "uppercase", color: GOLD_DEEP, fontWeight: 600, marginTop: i ? 10 : 0 }}>{t}</div>
            ))}
          </div>
        )}

        {/* signatures, bottom-centre */}
        {sigs.length > 0 && (
          <div style={{ position: "absolute", left: 400, right: 770, bottom: 92, display: "flex", justifyContent: sigs.length === 2 ? "space-between" : "center" }}>
            {sigs.map((sg, i) => <Signature key={i} name={sg.name} title={sg.title} />)}
          </div>
        )}

        {/* seal, bottom-right, over the band */}
        <div style={{ position: "absolute", right: 122, bottom: 96, display: "flex" }}>
          <Seal mark={brand.seal} year={year} />
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
