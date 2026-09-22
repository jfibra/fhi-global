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

/**
 * Award medallion as one vector: gold ribbon tails, a serrated foil edge, a
 * coin-milled outer ring, a navy inner field with a laurel of paired gold
 * leaves. Type is laid over it as normal text (SVG text has no fonts in the
 * renderer). The seal sits on the navy corner band, so the tails are gold.
 */
function sealSvg(size: number): string {
  const c = size / 2
  const R = size / 2 - 22 // medallion radius; the rest is room for the tails
  const P = (deg: number, r: number, side: 1 | -1 = 1) => {
    const a = (Math.PI * deg) / 180
    return { x: c + side * Math.sin(a) * r, y: c - Math.cos(a) * r }
  }
  const f = (n: number) => n.toFixed(1)

  // ribbon tails (drawn first, behind the disc): gold with a navy pin-stripe, V-cut ends
  const tail = (side: 1 | -1) => {
    const x0 = c + side * 18, x1 = c + side * 58
    const yTop = c + R - 30, yEnd = size - 6
    const pts = `${f(x0)},${f(yTop)} ${f(x1)},${f(yTop)} ${f(x1 + side * 14)},${f(yEnd)} ${f((x0 + x1) / 2 + side * 7)},${f(yEnd - 16)} ${f(x0 + side * 0)},${f(yEnd)}`
    const stripe = `M ${f((x0 + x1) / 2)} ${f(yTop)} L ${f((x0 + x1) / 2 + side * 7)} ${f(yEnd - 14)}`
    return `<polygon points="${pts}" fill="url(#ribbon)"/><path d="${stripe}" stroke="${NAVY}" stroke-width="3" opacity="0.7"/>`
  }

  // serrated foil edge: 96 points alternating two radii
  const teeth = Array.from({ length: 96 }, (_, i) => {
    const { x, y } = P((360 / 96) * i, i % 2 === 0 ? R : R - 7)
    return `${f(x)},${f(y)}`
  }).join(" ")

  // coin milling: 120 fine radial ticks on the outer ring
  const ticks = Array.from({ length: 120 }, (_, i) => {
    const a = (360 / 120) * i
    const p1 = P(a, R - 13), p2 = P(a, R - 24)
    return `<line x1="${f(p1.x)}" y1="${f(p1.y)}" x2="${f(p2.x)}" y2="${f(p2.y)}"/>`
  }).join("")

  // laurel: two stems with paired leaves, larger at the base, finer toward the top
  const stemR = R - 60
  const leafPair = (deg: number, side: 1 | -1, k: number) => {
    const { x, y } = P(deg, stemR, side)
    const tangent = side * deg
    const L = 24 * k, W = 9 * k
    const one = (rot: number, op: number) =>
      `<g transform="translate(${f(x)} ${f(y)}) rotate(${f(rot)})"><path d="M0,0 C${f(L * 0.25)},${f(-W)} ${f(L * 0.7)},${f(-W)} ${f(L)},0 C${f(L * 0.7)},${f(W)} ${f(L * 0.25)},${f(W)} 0,0 Z" fill="url(#leaf)" opacity="${op}"/><path d="M2,0 L${f(L - 3)},0" stroke="${GOLD_DEEP}" stroke-width="1" opacity="0.7"/></g>`
    return one(tangent - side * 145, 1) + one(tangent - side * 215, 0.92)
  }
  const laurel = [-1, 1]
    .flatMap((side) => Array.from({ length: 8 }, (_, i) => leafPair(150 - i * 13.5, side as 1 | -1, 1 - i * 0.055)))
    .join("")
  const stem = (side: 1 | -1) => {
    const a = P(152, stemR, side), b = P(52, stemR, side)
    return `<path d="M ${f(a.x)} ${f(a.y)} A ${f(stemR)} ${f(stemR)} 0 0 ${side === 1 ? 0 : 1} ${f(b.x)} ${f(b.y)}" fill="none" stroke="url(#leaf)" stroke-width="2.5"/>`
  }

  // three small stars at the base of the wreath
  const star = (cx: number, cy: number, r: number) =>
    `<polygon points="${Array.from({ length: 10 }, (_, i) => { const rr = i % 2 ? r * 0.45 : r; const a = (Math.PI * (i * 36 - 90)) / 180; return `${f(cx + Math.cos(a) * rr)},${f(cy + Math.sin(a) * rr)}` }).join(" ")}" fill="url(#leaf)"/>`
  const baseY = c + R - 56
  const stars = star(c, baseY, 8) + star(c - 22, baseY - 4, 5) + star(c + 22, baseY - 4, 5)

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">` +
    `<defs>` +
    `<linearGradient id="ribbon" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${GOLD_DEEP}"/><stop offset="0.5" stop-color="${GOLD}"/><stop offset="1" stop-color="${GOLD_DEEP}"/></linearGradient>` +
    `<linearGradient id="foil" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fbf1d8"/><stop offset="0.35" stop-color="${GOLD}"/><stop offset="0.65" stop-color="${GOLD_DEEP}"/><stop offset="1" stop-color="${GOLD}"/></linearGradient>` +
    `<radialGradient id="ring" cx="35%" cy="28%" r="80%"><stop offset="0" stop-color="#fff6dc"/><stop offset="0.45" stop-color="${GOLD}"/><stop offset="1" stop-color="${GOLD_DEEP}"/></radialGradient>` +
    `<radialGradient id="field" cx="50%" cy="38%" r="70%"><stop offset="0" stop-color="#0d3566"/><stop offset="1" stop-color="${NAVY}"/></radialGradient>` +
    `<linearGradient id="leaf" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff2cf"/><stop offset="0.5" stop-color="${GOLD}"/><stop offset="1" stop-color="${GOLD_DEEP}"/></linearGradient>` +
    `</defs>` +
    tail(-1) + tail(1) +
    `<polygon points="${teeth}" fill="url(#foil)"/>` +
    `<circle cx="${c}" cy="${c}" r="${f(R - 9)}" fill="url(#ring)"/>` +
    `<g stroke="${GOLD_DEEP}" stroke-width="1" opacity="0.55">${ticks}</g>` +
    `<circle cx="${c}" cy="${c}" r="${f(R - 27)}" fill="none" stroke="#fff7e0" stroke-width="1.5" opacity="0.9"/>` +
    `<circle cx="${c}" cy="${c}" r="${f(R - 31)}" fill="url(#field)"/>` +
    `<circle cx="${c}" cy="${c}" r="${f(R - 35)}" fill="none" stroke="${GOLD}" stroke-width="1" opacity="0.8"/>` +
    stem(1) + stem(-1) + laurel + stars +
    `</svg>`
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

function Seal({ mark, year }: { mark: string; year: string }) {
  const size = 300
  const R = size / 2 - 22
  return (
    <div style={{ position: "relative", width: size, height: size, display: "flex" }}>
      <div style={{ position: "absolute", left: size / 2 - R + 6, top: size / 2 - R + 10, width: R * 2 - 12, height: R * 2 - 12, borderRadius: R, boxShadow: "0 18px 40px rgba(0,0,0,0.35)" }} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={sealSvg(size)} alt="" width={size} height={size} style={{ position: "absolute", left: 0, top: 0 }} />
      <div style={{ position: "absolute", left: 0, top: 0, width: size, height: size, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: GOLD_LIGHT, paddingBottom: 14 }}>
        <div style={{ fontSize: 12, letterSpacing: 4, fontWeight: 700, textTransform: "uppercase", color: "#f3e3b3" }}>Certified</div>
        <div style={{ fontFamily: "Playfair Display", fontWeight: 700, fontSize: mark.length > 3 ? 44 : 60, lineHeight: 1, marginTop: 2, color: "#f7e9c4" }}>{mark}</div>
        <div style={{ fontSize: 16, letterSpacing: 4, fontWeight: 700, marginTop: 6, color: "#f3e3b3" }}>{year}</div>
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
        <div style={{ position: "absolute", right: 104, bottom: 70, display: "flex" }}>
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
