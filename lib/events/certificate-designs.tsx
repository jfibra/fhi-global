/* eslint-disable @next/next/no-img-element -- Satori draws <img>, not next/image */
import type { CertificateInput } from "@/lib/events/certificate-image"
import type { EventBrand } from "@/lib/events/brands"

/**
 * The three newer certificate designs (Royal Navy, Arabesque, Skyline). The
 * original "classic" design stays in certificate-image.tsx. All of them show
 * the same facts from the same input; only the art differs.
 *
 * Satori rules that shaped this file (see memory/satori-certificate-rendering):
 * every multi-child div is display:flex, no style key may be `undefined`, and
 * anything ornamental — patterns, arches, the skyline — is one SVG data URI
 * drawn by resvg, which handles gradients, patterns and paths precisely. No
 * text lives inside those SVGs (fonts aren't available there).
 */

export const W = 1754
export const H = 1240

const GOLD = "#c9a449"
const GOLD_LIGHT = "#efdda6"
const GOLD_DEEP = "#a98634"
const NAVY = "#001f3f"
const NAVY_DEEP = "#06213f"
const INK = "#0d1117"
const MUTED = "#6b7280"

export type SheetProps = { input: CertificateInput; brand: EventBrand }

const svgUri = (svg: string) => `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`

/** Full-canvas ornament layer. */
function Art({ svg }: { svg: string }) {
  return <img src={svgUri(svg)} alt="" width={W} height={H} style={{ position: "absolute", left: 0, top: 0 }} />
}

/** "Certificate of Attendance" → ["Certificate", "of Attendance"]. */
function splitHeading(heading: string): [string, string] {
  const [head, ...rest] = heading.split(" ")
  return [head, rest.join(" ")]
}

/** Font size that keeps a name on one line inside `maxWidth`, given the face's average glyph width (em). */
function fitSize(text: string, maxWidth: number, emPerChar: number, max: number, min: number): number {
  const fit = Math.floor(maxWidth / Math.max(1, text.length * emPerChar))
  return Math.max(min, Math.min(max, fit))
}

function details(input: CertificateInput): string[] {
  return [input.dateLabel, input.venue].filter((d): d is string => Boolean(d))
}

/** The brand logo for a dark sheet: the white version when the brand has one, else the logo on an ivory plaque. */
function LogoOnDark({ input, brand, height }: SheetProps & { height: number }) {
  const white = input.logoOnDarkSrc ?? (brand.logoIsWhite ? input.logoSrc : null)
  if (white) return <img src={white} alt="" style={{ height, objectFit: "contain" }} />
  return (
    <div style={{ display: "flex", alignItems: "center", padding: "14px 24px", background: "#fbf8f1", borderRadius: 6, border: `1.5px solid ${GOLD}` }}>
      <img src={input.logoSrc} alt="" style={{ height: height - 24, objectFit: "contain" }} />
    </div>
  )
}

/** The brand logo for a light sheet (white logos get a navy chip). */
function LogoOnLight({ input, brand, height }: SheetProps & { height: number }) {
  if (!brand.logoIsWhite) return <img src={input.logoSrc} alt="" style={{ height, objectFit: "contain" }} />
  return (
    <div style={{ display: "flex", alignItems: "center", padding: "14px 24px", background: NAVY, borderRadius: 4 }}>
      <img src={input.logoSrc} alt="" style={{ height: height - 32, objectFit: "contain" }} />
    </div>
  )
}

function Seal({ src, size }: { src: string; size: number }) {
  return <img src={src} alt="" width={size} height={size} style={{ width: size, height: size }} />
}

function Signature({ name, title, line, nameColor, titleColor, width = 360 }: { name: string; title: string; line: string; nameColor: string; titleColor: string; width?: number }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width }}>
      <div style={{ width: width - 50, height: 2, background: line }} />
      <div style={{ fontSize: 23, fontWeight: 700, color: nameColor, marginTop: 12 }}>{name}</div>
      {title ? <div style={{ fontSize: 17, color: titleColor, marginTop: 3 }}>{title}</div> : <div style={{ display: "flex" }} />}
    </div>
  )
}

/** "Certificate No. FHI-2026-…" block. */
function CertNo({ no, label, value, rule }: { no: string; label: string; value: string; rule: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
      <div style={{ fontSize: 14, letterSpacing: 5, textTransform: "uppercase", color: label, fontWeight: 600 }}>Certificate No.</div>
      <div style={{ fontSize: 24, fontWeight: 700, color: value, marginTop: 6, letterSpacing: 1 }}>{no}</div>
      <div style={{ width: 96, height: 2, background: rule, marginTop: 10 }} />
    </div>
  )
}

/** Date · venue on one line, separated by small diamonds. */
function Details({ items, color, dot, size = 24 }: { items: string[]; color: string; dot: string; size?: number }) {
  if (items.length === 0) return <div style={{ display: "flex" }} />
  return (
    <div style={{ display: "flex", alignItems: "center", fontSize: size, color }}>
      {items.map((d, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center" }}>
          {i > 0 && <div style={{ width: 8, height: 8, background: dot, margin: "0 20px", transform: "rotate(45deg)" }} />}
          <div>{d}</div>
        </div>
      ))}
    </div>
  )
}

/* ─────────────────────────────── Royal Navy ─────────────────────────────── */

function royalArt(): string {
  const cx = W / 2
  const cy = 610
  // Guilloche rosette: ellipses turned around one centre, the engraving on banknotes.
  let rosette = ""
  for (let i = 0; i < 48; i++) rosette += `<ellipse cx="${cx}" cy="${cy}" rx="430" ry="150" transform="rotate(${(i * 180) / 48} ${cx} ${cy})"/>`
  let rings = ""
  for (let r = 180; r <= 520; r += 34) rings += `<circle cx="${cx}" cy="${cy}" r="${r}"/>`
  // A gold flourish for one corner, mirrored to the other three.
  const corner =
    `<path d="M0 120 L0 0 L120 0" fill="none" stroke="url(#g)" stroke-width="4"/>` +
    `<path d="M18 120 L18 18 L120 18" fill="none" stroke="url(#g)" stroke-width="1.5"/>` +
    `<path d="M30 16 l14 14 l-14 14 l-14 -14 z" fill="url(#g)"/>` +
    `<path d="M136 0 l6 6 l-6 6 l-6 -6 z M0 136 l6 6 l-6 6 l-6 -6 z" fill="${GOLD}"/>`
  const at = (x: number, y: number, sx: number, sy: number) => `<g transform="translate(${x} ${y}) scale(${sx} ${sy})">${corner}</g>`
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">` +
    `<defs>` +
    `<radialGradient id="bg" cx="50%" cy="46%" r="75%"><stop offset="0" stop-color="#0f3a6b"/><stop offset="0.55" stop-color="${NAVY_DEEP}"/><stop offset="1" stop-color="#010b18"/></radialGradient>` +
    `<linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${GOLD_LIGHT}"/><stop offset="0.5" stop-color="${GOLD}"/><stop offset="1" stop-color="${GOLD_DEEP}"/></linearGradient>` +
    `</defs>` +
    `<rect width="${W}" height="${H}" fill="url(#bg)"/>` +
    `<g opacity="0.16"><g fill="none" stroke="${GOLD}" stroke-width="1.1">${rosette}</g></g>` +
    `<g opacity="0.12"><g fill="none" stroke="${GOLD}" stroke-width="1">${rings}</g></g>` +
    // frame: heavy gold rule, a beaded line, a hairline
    `<rect x="40" y="40" width="${W - 80}" height="${H - 80}" fill="none" stroke="url(#g)" stroke-width="3"/>` +
    `<rect x="52" y="52" width="${W - 104}" height="${H - 104}" fill="none" stroke="${GOLD}" stroke-width="5" stroke-dasharray="1.5 11" stroke-linecap="round"/>` +
    `<rect x="64" y="64" width="${W - 128}" height="${H - 128}" fill="none" stroke="${GOLD}" stroke-opacity="0.55" stroke-width="1"/>` +
    at(76, 76, 1, 1) + at(W - 76, 76, -1, 1) + at(76, H - 76, 1, -1) + at(W - 76, H - 76, -1, -1) +
    `</svg>`
  )
}

/** Short gold rule with a diamond in the middle. */
function GoldDivider({ width, color = GOLD }: { width: number; color?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center" }}>
      <div style={{ width: width / 2 - 14, height: 1.5, background: `linear-gradient(90deg, rgba(201,164,73,0) 0%, ${color} 100%)` }} />
      <div style={{ width: 12, height: 12, background: color, margin: "0 8px", transform: "rotate(45deg)" }} />
      <div style={{ width: width / 2 - 14, height: 1.5, background: `linear-gradient(90deg, ${color} 0%, rgba(201,164,73,0) 100%)` }} />
    </div>
  )
}

export function RoyalSheet({ input, brand }: SheetProps) {
  const { settings } = input
  const [head, tail] = splitHeading(settings.heading)
  const sigs = settings.signatories
  const IVORY = "#f5ecd7"
  const nameSize = fitSize(input.attendeeName, 1300, 0.42, 150, 76)
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", position: "relative", overflow: "hidden", fontFamily: "Outfit", color: IVORY, background: NAVY_DEEP }}>
      <Art svg={royalArt()} />

      {/* brand mark top-left, number top-right */}
      <div style={{ position: "absolute", left: 128, top: 118, display: "flex" }}>
        <LogoOnDark input={input} brand={brand} height={92} />
      </div>
      {input.certificateNo && (
        <div style={{ position: "absolute", right: 128, top: 112, display: "flex" }}>
          <CertNo no={input.certificateNo} label="rgba(245,236,215,0.55)" value={GOLD_LIGHT} rule={GOLD} />
        </div>
      )}

      <div style={{ position: "absolute", left: 0, right: 0, top: 236, display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
        <div style={{ fontFamily: "Cinzel", fontWeight: 700, fontSize: 86, letterSpacing: 22, color: "#e7c66f", lineHeight: 1, textShadow: "0 2px 0 rgba(0,0,0,0.35)" }}>{head.toUpperCase()}</div>
        {tail && <div style={{ fontFamily: "Cinzel", fontWeight: 600, fontSize: 30, letterSpacing: 14, color: IVORY, opacity: 0.85, marginTop: 18 }}>{tail.toUpperCase()}</div>}
        <div style={{ display: "flex", marginTop: 30 }}>
          <GoldDivider width={300} />
        </div>
        <div style={{ fontFamily: "Cormorant Garamond", fontStyle: "italic", fontWeight: 500, fontSize: 36, color: IVORY, opacity: 0.8, marginTop: 30 }}>This is to certify that</div>
        <div style={{ fontFamily: "Great Vibes", fontSize: nameSize, color: "#f2d78f", lineHeight: 1.12, marginTop: 4, maxWidth: 1400, textShadow: "0 3px 10px rgba(0,0,0,0.35)" }}>{input.attendeeName}</div>
        <div style={{ width: 720, height: 2, background: `linear-gradient(90deg, rgba(201,164,73,0) 0%, ${GOLD} 22%, ${GOLD_LIGHT} 50%, ${GOLD} 78%, rgba(201,164,73,0) 100%)`, marginTop: 6 }} />
        <div style={{ fontFamily: "Cormorant Garamond", fontStyle: "italic", fontWeight: 500, fontSize: 32, color: IVORY, opacity: 0.8, marginTop: 26 }}>{settings.line}</div>
        <div style={{ fontFamily: "Cinzel", fontWeight: 600, fontSize: 44, letterSpacing: 2, color: "#ffffff", marginTop: 10, maxWidth: 1260, lineHeight: 1.22 }}>{input.eventTitle}</div>
        <div style={{ display: "flex", marginTop: 18 }}>
          <Details items={details(input)} color="rgba(245,236,215,0.86)" dot={GOLD} />
        </div>
        {settings.note && <div style={{ fontSize: 19, color: GOLD_LIGHT, fontWeight: 700, marginTop: 14, letterSpacing: 4, textTransform: "uppercase" }}>{settings.note}</div>}
      </div>

      {/* signatures flank the seal */}
      {sigs[0] && (
        <div style={{ position: "absolute", left: sigs.length === 1 ? 210 : 210, bottom: 116, display: "flex" }}>
          <Signature name={sigs[0].name} title={sigs[0].title} line={GOLD} nameColor="#ffffff" titleColor="rgba(245,236,215,0.6)" />
        </div>
      )}
      {sigs[1] && (
        <div style={{ position: "absolute", right: 210, bottom: 116, display: "flex" }}>
          <Signature name={sigs[1].name} title={sigs[1].title} line={GOLD} nameColor="#ffffff" titleColor="rgba(245,236,215,0.6)" />
        </div>
      )}
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 62, display: "flex", justifyContent: "center" }}>
        <Seal src={input.sealSrc} size={250} />
      </div>
    </div>
  )
}

/* ─────────────────────────────── Arabesque ──────────────────────────────── */

/** Eight-point star (two squares) centred on (cx, cy), radius r to the tips. */
function star8(cx: number, cy: number, r: number): string {
  const s = r * Math.SQRT1_2
  const sq1 = `${cx - s},${cy - s} ${cx + s},${cy - s} ${cx + s},${cy + s} ${cx - s},${cy + s}`
  const sq2 = `${cx},${cy - r} ${cx + r},${cy} ${cx},${cy + r} ${cx - r},${cy}`
  return `<polygon points="${sq1}"/><polygon points="${sq2}"/>`
}

const BAND = 64 // width of the patterned border band
const BAND_IN = 30 // band starts this far from the edge

function arabesqueArt(): string {
  const o = BAND_IN
  const i = BAND_IN + BAND
  // arch: straight jambs up to the springline, then a pointed (two-centred) head
  const x0 = 250, x1 = W - 250, yb = H - 118, ys = 560, apex = 176
  const cx = W / 2
  const arch = (inset: number) => {
    const a0 = x0 + inset, a1 = x1 - inset, top = apex + inset * 1.15, sp = ys + inset * 0.4
    return `M${a0} ${yb} L${a0} ${sp} C${a0} ${sp - 250} ${cx - 300} ${top + 70} ${cx} ${top} C${cx + 300} ${top + 70} ${a1} ${sp - 250} ${a1} ${sp} L${a1} ${yb}`
  }
  // One pattern per band, each anchored to its own band and centred along it, so every
  // side shows whole stars meeting the corners symmetrically.
  const tileBody =
    `<rect width="${BAND}" height="${BAND}" fill="#0b2847"/>` +
    `<g fill="none" stroke="${GOLD}" stroke-width="1.6">${star8(BAND / 2, BAND / 2, 22)}` +
    `<path d="M32 0 V10 M32 54 V64 M0 32 H10 M54 32 H64"/></g>` +
    `<circle cx="32" cy="32" r="3.5" fill="${GOLD}"/>`
  const along = (len: number) => (len % BAND) / 2 // centring offset for a band of this length
  const pat = (id: string, x: number, y: number) =>
    `<pattern id="${id}" width="${BAND}" height="${BAND}" patternUnits="userSpaceOnUse" x="${x}" y="${y}">${tileBody}</pattern>`
  const hx = o + along(W - 2 * o)
  const vy = o + along(H - 2 * o)
  const tile = pat("lt", hx, o) + pat("lb", hx, H - i) + pat("ll", o, vy) + pat("lr", W - i, vy)
  const cornerStar = (x: number, y: number) =>
    `<rect x="${x - BAND / 2 - 6}" y="${y - BAND / 2 - 6}" width="${BAND + 12}" height="${BAND + 12}" fill="#0b2847" stroke="url(#g)" stroke-width="2"/>` +
    `<g fill="url(#g)" stroke="none">${star8(x, y, 30)}</g><circle cx="${x}" cy="${y}" r="7" fill="#0b2847"/>`
  const c = o + BAND / 2
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">` +
    `<defs>` +
    `<radialGradient id="bg" cx="50%" cy="45%" r="80%"><stop offset="0" stop-color="#fffdf7"/><stop offset="0.7" stop-color="#f8f0dc"/><stop offset="1" stop-color="#efe1bf"/></radialGradient>` +
    `<linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${GOLD_LIGHT}"/><stop offset="0.5" stop-color="${GOLD}"/><stop offset="1" stop-color="${GOLD_DEEP}"/></linearGradient>` +
    tile +
    `</defs>` +
    `<rect width="${W}" height="${H}" fill="url(#bg)"/>` +
    // patterned band, side by side
    `<rect x="${o}" y="${o}" width="${W - 2 * o}" height="${BAND}" fill="url(#lt)"/>` +
    `<rect x="${o}" y="${H - i}" width="${W - 2 * o}" height="${BAND}" fill="url(#lb)"/>` +
    `<rect x="${o}" y="${i}" width="${BAND}" height="${H - 2 * i}" fill="url(#ll)"/>` +
    `<rect x="${W - i}" y="${i}" width="${BAND}" height="${H - 2 * i}" fill="url(#lr)"/>` +
    `<rect x="${o}" y="${o}" width="${W - 2 * o}" height="${H - 2 * o}" fill="none" stroke="url(#g)" stroke-width="3"/>` +
    `<rect x="${i}" y="${i}" width="${W - 2 * i}" height="${H - 2 * i}" fill="none" stroke="url(#g)" stroke-width="3"/>` +
    `<rect x="${i + 14}" y="${i + 14}" width="${W - 2 * i - 28}" height="${H - 2 * i - 28}" fill="none" stroke="${GOLD}" stroke-opacity="0.6" stroke-width="1"/>` +
    cornerStar(c, c) + cornerStar(W - c, c) + cornerStar(c, H - c) + cornerStar(W - c, H - c) +
    // the arch: a lighter window, a gold rule and an inner hairline
    `<path d="${arch(0)} Z" fill="#fffdf8" fill-opacity="0.75"/>` +
    `<path d="${arch(0)}" fill="none" stroke="url(#g)" stroke-width="3"/>` +
    `<path d="${arch(16)}" fill="none" stroke="${GOLD}" stroke-opacity="0.55" stroke-width="1.2"/>` +
    // medallion at the apex
    `<g fill="#fffdf8" stroke="url(#g)" stroke-width="3">${star8(cx, apex, 62)}</g>` +
    `<circle cx="${cx}" cy="${apex}" r="44" fill="#0b2847" stroke="url(#g)" stroke-width="2"/>` +
    `</svg>`
  )
}

export function ArabesqueSheet({ input, brand }: SheetProps) {
  const { settings } = input
  const [head, tail] = splitHeading(settings.heading)
  const sigs = settings.signatories
  const nameSize = fitSize(input.attendeeName, 1080, 0.56, 108, 56)
  const apex = 176
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", position: "relative", overflow: "hidden", fontFamily: "Outfit", color: INK, background: "#f8f0dc" }}>
      <Art svg={arabesqueArt()} />

      {/* the brand's emblem sits in the medallion at the apex */}
      <div style={{ position: "absolute", left: W / 2 - 30, top: apex - 30, width: 60, height: 60, display: "flex", alignItems: "center", justifyContent: "center" }}>
        {input.sealMarkSrc ? (
          <img src={input.sealMarkSrc} alt="" style={{ height: 52, objectFit: "contain" }} />
        ) : (
          <div style={{ width: 14, height: 14, background: GOLD, transform: "rotate(45deg)" }} />
        )}
      </div>

      <div style={{ position: "absolute", left: 140, top: 136, display: "flex" }}>
        <LogoOnLight input={input} brand={brand} height={brand.logoIsWhite ? 104 : 96} />
      </div>
      {input.certificateNo && (
        <div style={{ position: "absolute", right: 140, top: 132, display: "flex" }}>
          <CertNo no={input.certificateNo} label={MUTED} value={NAVY} rule={GOLD} />
        </div>
      )}

      <div style={{ position: "absolute", left: 0, right: 0, top: 318, display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
        <div style={{ fontFamily: "Cinzel", fontWeight: 700, fontSize: 72, letterSpacing: 18, color: NAVY, lineHeight: 1 }}>{head.toUpperCase()}</div>
        {tail && <div style={{ fontFamily: "Cinzel", fontWeight: 600, fontSize: 26, letterSpacing: 13, color: GOLD_DEEP, marginTop: 16 }}>{tail.toUpperCase()}</div>}
        <div style={{ fontFamily: "Cormorant Garamond", fontStyle: "italic", fontWeight: 500, fontSize: 32, color: "#5b6470", marginTop: 40 }}>This is to certify that</div>
        <div style={{ fontFamily: "Playfair Display", fontWeight: 700, fontSize: nameSize, color: NAVY, marginTop: 10, lineHeight: 1.1, maxWidth: 1180 }}>{input.attendeeName}</div>
        <div style={{ display: "flex", marginTop: 20 }}>
          <GoldDivider width={560} color={GOLD} />
        </div>
        <div style={{ fontFamily: "Cormorant Garamond", fontStyle: "italic", fontWeight: 500, fontSize: 30, color: "#5b6470", marginTop: 22 }}>{settings.line}</div>
        <div style={{ fontFamily: "Cinzel", fontWeight: 700, fontSize: 40, letterSpacing: 1.5, color: NAVY, marginTop: 8, maxWidth: 1120, lineHeight: 1.22 }}>{input.eventTitle}</div>
        <div style={{ display: "flex", marginTop: 16 }}>
          <Details items={details(input)} color={MUTED} dot={GOLD} size={23} />
        </div>
        {settings.note && <div style={{ fontSize: 18, color: GOLD_DEEP, fontWeight: 700, marginTop: 12, letterSpacing: 3, textTransform: "uppercase" }}>{settings.note}</div>}
      </div>

      {sigs[0] && (
        <div style={{ position: "absolute", left: 330, bottom: 150, display: "flex" }}>
          <Signature name={sigs[0].name} title={sigs[0].title} line={NAVY} nameColor={INK} titleColor={MUTED} width={330} />
        </div>
      )}
      {sigs[1] && (
        <div style={{ position: "absolute", right: 330, bottom: 150, display: "flex" }}>
          <Signature name={sigs[1].name} title={sigs[1].title} line={NAVY} nameColor={INK} titleColor={MUTED} width={330} />
        </div>
      )}
      {/* the seal sits on the base of the arch */}
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 52, display: "flex", justifyContent: "center" }}>
        <Seal src={input.sealSrc} size={232} />
      </div>
    </div>
  )
}

/* ──────────────────────────────── Skyline ───────────────────────────────── */

const PANEL = 660 // width of the navy panel

/** The Dubai skyline as gold silhouettes: two layers for depth, landmarks up front. */
function skylineArt(): string {
  const base = H
  // back layer: a dense band of towers
  const back: Array<[number, number, number]> = [
    [0, 50, 220], [46, 40, 300], [82, 56, 250], [134, 34, 360], [166, 60, 280], [222, 44, 330], [262, 52, 240],
    [310, 38, 390], [344, 58, 300], [398, 42, 260], [436, 54, 340], [486, 40, 230], [522, 64, 290], [582, 46, 250], [624, 40, 200],
  ]
  const backRects = back.map(([x, w, h]) => `<rect x="${x}" y="${base - h}" width="${w}" height="${h}"/>`).join("")
  // Burj Khalifa: stepped setbacks narrowing to a spire
  const bk = (x: number) => {
    const steps: Array<[number, number]> = [[64, 104], [52, 88], [40, 80], [30, 72], [22, 64], [14, 56], [8, 48]]
    let y = base
    let out = ""
    for (const [w, h] of steps) { out += `<rect x="${x - w / 2}" y="${y - h}" width="${w}" height="${h}"/>`; y -= h }
    out += `<polygon points="${x - 4},${y} ${x + 4},${y} ${x},${y - 96}"/>`
    return out
  }
  // Burj Al Arab: the sail, with its mast
  const sail = (x: number) =>
    `<path d="M${x} ${base} L${x} ${base - 280} C${x + 36} ${base - 280} ${x + 136} ${base - 190} ${x + 142} ${base} Z"/>` +
    `<rect x="${x - 9}" y="${base - 336}" width="9" height="336"/>` +
    `<rect x="${x + 34}" y="${base - 232}" width="62" height="7" fill="#0a2d55" fill-opacity="0.55"/>`
  // Dubai Frame: two towers and the bridge
  const frame = (x: number) =>
    `<path fill-rule="evenodd" d="M${x} ${base} V${base - 330} H${x + 150} V${base} Z M${x + 26} ${base} V${base - 300} H${x + 124} V${base} Z"/>`
  // Museum of the Future: the torus
  const museum = (x: number) =>
    `<path fill-rule="evenodd" d="M${x - 66} ${base} C${x - 66} ${base - 176} ${x + 66} ${base - 176} ${x + 66} ${base} Z M${x - 36} ${base} C${x - 36} ${base - 104} ${x + 36} ${base - 104} ${x + 36} ${base} Z"/>`
  // front layer: landmarks with mid-rise towers between them
  const front =
    frame(22) +
    `<rect x="184" y="${base - 190}" width="40" height="190"/>` +
    bk(276) +
    `<rect x="322" y="${base - 240}" width="34" height="240"/>` +
    museum(428) +
    sail(512)
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">` +
    `<defs>` +
    `<linearGradient id="nv" x1="0" y1="0" x2="0.4" y2="1"><stop offset="0" stop-color="#0a2d55"/><stop offset="1" stop-color="#020f20"/></linearGradient>` +
    `<linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${GOLD_LIGHT}"/><stop offset="0.55" stop-color="${GOLD}"/><stop offset="1" stop-color="${GOLD_DEEP}"/></linearGradient>` +
    `<linearGradient id="paper" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#f6f3ec"/></linearGradient>` +
    `<pattern id="dg" width="22" height="22" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="1" height="22" fill="#ffffff" fill-opacity="0.04"/></pattern>` +
    `</defs>` +
    `<rect width="${W}" height="${H}" fill="url(#paper)"/>` +
    `<rect width="${PANEL}" height="${H}" fill="url(#nv)"/>` +
    `<rect width="${PANEL}" height="${H}" fill="url(#dg)"/>` +
    `<g fill="#174a80" opacity="0.55">${backRects}</g>` +
    `<g fill="url(#g)">${front}</g>` +
    // gold seam and a fine frame round the paper side
    `<rect x="${PANEL}" y="0" width="6" height="${H}" fill="url(#g)"/>` +
    `<rect x="${PANEL + 40}" y="40" width="${W - PANEL - 80}" height="${H - 80}" fill="none" stroke="${GOLD}" stroke-opacity="0.55" stroke-width="1.5"/>` +
    `</svg>`
  )
}

export function SkylineSheet({ input, brand }: SheetProps) {
  const { settings } = input
  const [head, tail] = splitHeading(settings.heading)
  const sigs = settings.signatories
  const left = PANEL + 110
  const textWidth = W - left - 120
  const nameSize = fitSize(input.attendeeName, textWidth, 0.56, 118, 52)
  // one line when it fits; very long titles settle at 36px over two lines
  const titleSize = fitSize(input.eventTitle, textWidth, 0.52, 50, 36)
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", position: "relative", overflow: "hidden", fontFamily: "Outfit", color: INK, background: "#ffffff" }}>
      <Art svg={skylineArt()} />

      {/* navy panel: brand, then the heading set big */}
      <div style={{ position: "absolute", left: 80, top: 96, display: "flex" }}>
        <LogoOnDark input={input} brand={brand} height={88} />
      </div>
      <div style={{ position: "absolute", left: 80, top: 330, width: PANEL - 140, display: "flex", flexDirection: "column" }}>
        <div style={{ width: 64, height: 5, background: GOLD }} />
        <div style={{ fontSize: 70, fontWeight: 700, letterSpacing: 6, color: "#ffffff", lineHeight: 1, marginTop: 28 }}>{head.toUpperCase()}</div>
        {tail && <div style={{ fontSize: 30, fontWeight: 600, letterSpacing: 10, color: GOLD_LIGHT, marginTop: 18 }}>{tail.toUpperCase()}</div>}
      </div>

      {input.certificateNo && (
        <div style={{ position: "absolute", right: 110, top: 100, display: "flex" }}>
          <CertNo no={input.certificateNo} label={MUTED} value={NAVY} rule={GOLD} />
        </div>
      )}

      {/* paper side: the facts, left-aligned */}
      <div style={{ position: "absolute", left, top: 324, width: textWidth, display: "flex", flexDirection: "column" }}>
        <div style={{ fontSize: 21, letterSpacing: 7, textTransform: "uppercase", color: MUTED, fontWeight: 600 }}>This is to certify that</div>
        <div style={{ fontFamily: "Playfair Display", fontWeight: 700, fontSize: nameSize, color: NAVY, marginTop: 20, lineHeight: 1.08 }}>{input.attendeeName}</div>
        <div style={{ display: "flex", marginTop: 30 }}>
          <div style={{ width: 120, height: 6, background: GOLD }} />
          <div style={{ width: 40, height: 6, background: NAVY, marginLeft: 6 }} />
        </div>
        <div style={{ fontSize: 22, letterSpacing: 5, textTransform: "uppercase", color: MUTED, fontWeight: 600, marginTop: 50 }}>{settings.line}</div>
        <div style={{ fontSize: titleSize, fontWeight: 700, color: NAVY, marginTop: 14, lineHeight: 1.2 }}>{input.eventTitle}</div>
        <div style={{ display: "flex", marginTop: 22 }}>
          <Details items={details(input)} color={MUTED} dot={GOLD} size={23} />
        </div>
        {settings.note && <div style={{ fontSize: 18, color: GOLD_DEEP, fontWeight: 700, marginTop: 14, letterSpacing: 3, textTransform: "uppercase" }}>{settings.note}</div>}
      </div>

      {sigs.length > 0 && (
        <div style={{ position: "absolute", left, bottom: 118, display: "flex" }}>
          {sigs.map((sg, i) => (
            <div key={i} style={{ display: "flex", marginRight: 60 }}>
              <Signature name={sg.name} title={sg.title} line={NAVY} nameColor={INK} titleColor={MUTED} width={320} />
            </div>
          ))}
        </div>
      )}
      <div style={{ position: "absolute", right: 96, bottom: 84, display: "flex" }}>
        <Seal src={input.sealSrc} size={250} />
      </div>
    </div>
  )
}
