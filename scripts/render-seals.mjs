/**
 * Pre-renders the official certificate seal for each event brand to
 * public/seals/<brand>.png using headless Chrome (SVG textPath + local
 * WOFF fonts). Run after changing brands or the seal design:
 *
 *   node scripts/render-seals.mjs
 *
 * The certificate renderer only places the PNG, so nothing here runs on Vercel.
 */
import fs from "node:fs"
import path from "node:path"
import { execFileSync } from "node:child_process"

const ROOT = process.cwd()
const OUT = path.join(ROOT, "public/seals")
const CHROME = process.env.CHROME ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

// Mirrors lib/events/brands.ts (kept literal here so the script has no TS imports).
const BRANDS = [
  { key: "fhiglobal", ring: "FHI GLOBAL PROPERTY", bottom: "DUBAI", mark: "/logos/fhi-mark-gold.png", text: "FHI" },
  { key: "filipinohomes", ring: "FILIPINO HOMES", bottom: "CERTIFIED", text: "FH" },
  { key: "homesph", ring: "HOMES PH", bottom: "CERTIFIED", text: "HPH" },
  { key: "rentph", ring: "RENT PH", bottom: "CERTIFIED", text: "RPH" },
  { key: "fhipartners", ring: "FH GLOBAL PARTNERS", bottom: "CERTIFIED", text: "FHGP" },
  { key: "rentsouq", ring: "RENTSOUQ AE", bottom: "CERTIFIED", text: "RSQ" },
]

const NAVY = "#001f3f", GOLD = "#c9a449", GOLD_DEEP = "#a98634"
const SIZE = 720, R = 300, C = SIZE / 2 // 2× of the 360px placement box
const f = (n) => n.toFixed(1)
const P = (deg, r) => { const a = (Math.PI * deg) / 180; return { x: C + Math.sin(a) * r, y: C - Math.cos(a) * r } }
const dataUri = (p) => `data:image/png;base64,${fs.readFileSync(path.join(ROOT, "public", p)).toString("base64")}`
const font = (file) => `data:font/woff;base64,${fs.readFileSync(path.join(ROOT, "public/fonts", file)).toString("base64")}`

function sealSvg(b) {
  // ribbon tails with a shaded fold and V-cut ends
  const tail = (side) => {
    const x0 = C + side * 44, x1 = C + side * 140
    const yTop = C + R - 68, yEnd = SIZE - 8
    const body = `${f(x0)},${f(yTop)} ${f(x1)},${f(yTop)} ${f(x1 + side * 32)},${f(yEnd)} ${f((x0 + x1) / 2 + side * 16)},${f(yEnd - 36)} ${f(x0)},${f(yEnd)}`
    const fold = `${f(x0)},${f(yTop)} ${f(x1)},${f(yTop)} ${f(x1 + side * 4)},${f(yTop + 26)} ${f(x0)},${f(yTop + 26)}`
    return `<g filter="url(#softShadow)"><polygon points="${body}" fill="url(#ribbon)"/></g>` +
      `<polygon points="${fold}" fill="#000" opacity="0.22"/>` +
      `<path d="M ${f((x0 + x1) / 2)} ${f(yTop)} L ${f((x0 + x1) / 2 + side * 16)} ${f(yEnd - 32)}" stroke="${NAVY}" stroke-width="5" opacity="0.6"/>`
  }
  const teeth = Array.from({ length: 108 }, (_, i) => { const { x, y } = P((360 / 108) * i, i % 2 === 0 ? R : R - 16); return `${f(x)},${f(y)}` }).join(" ")
  const ticks = (n, r1, r2) => Array.from({ length: n }, (_, i) => { const a = (360 / n) * i; const p1 = P(a, r1), p2 = P(a, r2); return `<line x1="${f(p1.x)}" y1="${f(p1.y)}" x2="${f(p2.x)}" y2="${f(p2.y)}"/>` }).join("")
  // twisted rope border: alternating tilted beads around the band edge
  const rope = (r, n) => Array.from({ length: n }, (_, i) => {
    const a = (360 / n) * i
    const { x, y } = P(a, r)
    return `<rect x="${f(x - 7)}" y="${f(y - 3.2)}" width="14" height="6.4" rx="3.2" fill="url(#leaf)" transform="rotate(${f(a + (i % 2 ? 38 : -38))} ${f(x)} ${f(y)})"/>`
  }).join("")
  // pearl border: small polished beads
  const pearls = (r, n) => Array.from({ length: n }, (_, i) => { const { x, y } = P((360 / n) * i, r); return `<circle cx="${f(x)}" cy="${f(y)}" r="3" fill="url(#pearl)"/>` }).join("")
  const star = (cx, cy, r) => `<polygon points="${Array.from({ length: 10 }, (_, i) => { const rr = i % 2 ? r * 0.42 : r; const a = (Math.PI * (i * 36 - 90)) / 180; return `${f(cx + Math.cos(a) * rr)},${f(cy + Math.sin(a) * rr)}` }).join(" ")}" fill="url(#leaf)"/>`
  const textR = R - 92
  const arcTop = `M ${f(C - textR)} ${f(C)} A ${textR} ${textR} 0 0 1 ${f(C + textR)} ${f(C)}`
  const arcBottom = `M ${f(C - textR)} ${f(C)} A ${textR} ${textR} 0 0 0 ${f(C + textR)} ${f(C)}`
  const baseY = C + R - 192
  const engraved = [0.28, 0.42, 0.56, 0.7, 0.84].map((k) => `<circle cx="${C}" cy="${C}" r="${f((R - 160) * k)}" fill="none" stroke="${GOLD}" stroke-width="1" opacity="0.14"/>`).join("")
  const centre = b.mark
    ? `<image href="${dataUri(b.mark)}" x="${C - 96}" y="${C - 120}" width="192" height="192" preserveAspectRatio="xMidYMid meet" filter="url(#emblemGlow)"/>`
    : `<text x="${C}" y="${C + 8}" text-anchor="middle" dominant-baseline="middle" font-family="Playfair Display" font-weight="700" font-size="${b.text.length > 3 ? 96 : 132}" fill="#f7e9c4" filter="url(#emblemGlow)">${b.text}</text>`
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">
<defs>
  <style>
    @font-face { font-family: "Outfit"; font-weight: 700; src: url("${font("Outfit-700.woff")}") format("woff"); }
    @font-face { font-family: "Playfair Display"; font-weight: 700; src: url("${font("PlayfairDisplay-700.woff")}") format("woff"); }
  </style>
  <linearGradient id="ribbon" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${GOLD_DEEP}"/><stop offset="0.45" stop-color="#e2c27a"/><stop offset="0.6" stop-color="${GOLD}"/><stop offset="1" stop-color="#8a6b22"/></linearGradient>
  <linearGradient id="foil" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fdf3dc"/><stop offset="0.3" stop-color="${GOLD}"/><stop offset="0.55" stop-color="${GOLD_DEEP}"/><stop offset="0.75" stop-color="#e2c27a"/><stop offset="1" stop-color="#8a6b22"/></linearGradient>
  <radialGradient id="bevel" cx="35%" cy="28%" r="80%"><stop offset="0" stop-color="#fff8e3"/><stop offset="0.45" stop-color="${GOLD}"/><stop offset="1" stop-color="#8a6b22"/></radialGradient>
  <radialGradient id="bezel" cx="65%" cy="70%" r="80%"><stop offset="0" stop-color="#fff2cf"/><stop offset="0.6" stop-color="${GOLD}"/><stop offset="1" stop-color="#7d611d"/></radialGradient>
  <radialGradient id="band" cx="50%" cy="50%" r="60%"><stop offset="0" stop-color="#0d3566"/><stop offset="1" stop-color="${NAVY}"/></radialGradient>
  <radialGradient id="field" cx="50%" cy="38%" r="72%"><stop offset="0" stop-color="#16437a"/><stop offset="0.7" stop-color="#062648"/><stop offset="1" stop-color="#001430"/></radialGradient>
  <linearGradient id="leaf" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff2cf"/><stop offset="0.5" stop-color="${GOLD}"/><stop offset="1" stop-color="${GOLD_DEEP}"/></linearGradient>
  <radialGradient id="pearl" cx="35%" cy="30%" r="70%"><stop offset="0" stop-color="#fffaf0"/><stop offset="0.6" stop-color="#e2c27a"/><stop offset="1" stop-color="${GOLD_DEEP}"/></radialGradient>
  <linearGradient id="gloss" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0.16"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
  <filter id="shadow" x="-25%" y="-25%" width="150%" height="160%"><feDropShadow dx="0" dy="20" stdDeviation="20" flood-color="#000" flood-opacity="0.38"/></filter>
  <filter id="softShadow" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="8" stdDeviation="8" flood-color="#000" flood-opacity="0.35"/></filter>
  <filter id="brushed" x="0" y="0" width="100%" height="100%">
    <feTurbulence type="fractalNoise" baseFrequency="0.02 0.9" numOctaves="2" seed="7" result="noise"/>
    <feColorMatrix in="noise" type="saturate" values="0" result="grey"/>
    <feComponentTransfer in="grey" result="soft"><feFuncA type="linear" slope="0.22"/></feComponentTransfer>
    <feBlend in="SourceGraphic" in2="soft" mode="multiply" result="metal"/>
    <feComposite in="metal" in2="SourceAlpha" operator="in"/>
  </filter>
  <filter id="inset" x="-20%" y="-20%" width="140%" height="140%">
    <feOffset dx="0" dy="4"/><feGaussianBlur stdDeviation="5" result="blur"/>
    <feComposite operator="out" in="SourceGraphic" in2="blur" result="inv"/>
    <feFlood flood-color="#000" flood-opacity="0.55"/><feComposite operator="in" in2="inv" result="sh"/>
    <feComposite operator="over" in="sh" in2="SourceGraphic"/>
  </filter>
  <filter id="emblemGlow" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="0" stdDeviation="10" flood-color="#f2d27a" flood-opacity="0.45"/></filter>
  <path id="arcTop" d="${arcTop}"/><path id="arcBottom" d="${arcBottom}"/>
</defs>
${tail(-1)}${tail(1)}
<g filter="url(#shadow)"><polygon points="${teeth}" fill="url(#foil)" filter="url(#brushed)"/></g>
<circle cx="${C}" cy="${C}" r="${f(R - 20)}" fill="url(#bevel)" filter="url(#brushed)"/>
<g stroke="${GOLD_DEEP}" stroke-width="2" opacity="0.45">${ticks(150, R - 24, R - 44)}</g>
<circle cx="${C}" cy="${C}" r="${f(R - 52)}" fill="none" stroke="#fff7e0" stroke-width="3" opacity="0.9"/>
<circle cx="${C}" cy="${C}" r="${f(R - 56)}" fill="url(#band)" filter="url(#inset)"/>
${rope(R - 60, 72)}
${pearls(R - 122, 96)}
<circle cx="${C}" cy="${C}" r="${f(R - 128)}" fill="url(#bezel)"/>
<g stroke="#7d611d" stroke-width="2" opacity="0.6">${ticks(120, R - 132, R - 148)}</g>
<circle cx="${C}" cy="${C}" r="${f(R - 156)}" fill="url(#field)" filter="url(#inset)"/>
<circle cx="${C}" cy="${C}" r="${f(R - 160)}" fill="none" stroke="${GOLD}" stroke-width="2" opacity="0.7"/>
${engraved}
<g stroke="${GOLD}" stroke-width="2" opacity="0.16">${ticks(72, R - 164, R - 250)}</g>
<ellipse cx="${C}" cy="${f(C - 60)}" rx="${f(R - 170)}" ry="${f((R - 170) * 0.55)}" fill="url(#gloss)"/>
<text font-family="Outfit" font-weight="700" font-size="30" letter-spacing="7" fill="#f6e7bd"><textPath href="#arcTop" startOffset="50%" text-anchor="middle" dominant-baseline="middle">${b.ring}</textPath></text>
<text font-family="Outfit" font-weight="700" font-size="30" letter-spacing="7" fill="#f6e7bd"><textPath href="#arcBottom" startOffset="50%" text-anchor="middle" dominant-baseline="middle">${b.bottom}</textPath></text>
${[90, 270].map((d) => { const { x, y } = P(d, textR); return `<rect x="${f(x - 8)}" y="${f(y - 8)}" width="16" height="16" fill="url(#leaf)" transform="rotate(45 ${f(x)} ${f(y)})"/>` }).join("")}
${centre}
${star(C, baseY, 14)}${star(C - 40, baseY - 6, 9)}${star(C + 40, baseY - 6, 9)}
</svg>`
}

for (const b of BRANDS) {
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;background:transparent}</style></head><body>${sealSvg(b)}</body></html>`
  const tmp = path.join(OUT, `.${b.key}.html`)
  fs.writeFileSync(tmp, html)
  const out = path.join(OUT, `${b.key}.png`)
  execFileSync(CHROME, [
    "--headless=new", "--disable-gpu", "--hide-scrollbars", "--default-background-color=00000000",
    `--window-size=${SIZE},${SIZE}`, "--virtual-time-budget=4000", `--screenshot=${out}`, `file://${tmp}`,
  ], { stdio: "ignore" })
  fs.unlinkSync(tmp)
  console.log("  wrote", path.relative(ROOT, out), fs.statSync(out).size, "bytes")
}
