// The link-share thumbnail (og:image) for an agent site: the banner photo only
// (boss, 2026-11-09), framed exactly as the hero frames it — the position and
// zoom set in Website Builder → Hero. No title, overlay, stats or contact card.
// Rendered by next/og (Satori): flexbox only, raw hex colors, absolute URLs.
// loadOgFonts stays exported for the project share card.

import { DEFAULT_THEME, resolveThemeColors, type WebsiteData } from "../_data"

export const OG_SIZE = { width: 1200, height: 630 }

/** Fonts: serif 700 for the headline, sans 400/700 for everything else —
 *  fetched once (Google Fonts TTF via the legacy-UA trick), cached at module
 *  level. When fonts are supplied, Satori uses ONLY them, so the sans pair is
 *  required or the whole card would render serif. */
type OgFont = { name: string; data: ArrayBuffer; weight: 400 | 700; style: "normal" }
let ogFonts: OgFont[] | undefined

async function fetchTtf(cssUrl: string): Promise<ArrayBuffer | null> {
  const css = await fetch(cssUrl, { headers: { "User-Agent": "Mozilla/5.0" } }).then((r) => r.text())
  const url = css.match(/src: url\((.+?\.ttf)\)/)?.[1]
  return url ? fetch(url).then((r) => r.arrayBuffer()) : null
}

export async function loadOgFonts(): Promise<OgFont[]> {
  if (ogFonts === undefined) {
    try {
      const [serif700, sans400, sans700] = await Promise.all([
        fetchTtf("https://fonts.googleapis.com/css2?family=Noto+Serif:wght@700"),
        fetchTtf("https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400"),
        fetchTtf("https://fonts.googleapis.com/css2?family=Noto+Sans:wght@700"),
      ])
      ogFonts = []
      if (serif700) ogFonts.push({ name: "og-serif", data: serif700, weight: 700, style: "normal" })
      if (sans400) ogFonts.push({ name: "og-sans", data: sans400, weight: 400, style: "normal" })
      if (sans700) ogFonts.push({ name: "og-sans", data: sans700, weight: 700, style: "normal" })
    } catch {
      ogFonts = []
    }
  }
  return ogFonts
}

/** The element tree for ImageResponse: the banner photo, positioned and zoomed like the hero. `base` makes relative image URLs absolute. */
export function OgHero({ data, base }: { data: WebsiteData; base: string }) {
  const { hero } = data
  const t = resolveThemeColors(data.theme ?? DEFAULT_THEME)
  const posX = Math.min(100, Math.max(0, hero.posX ?? 50))
  const posY = Math.min(100, Math.max(0, hero.posY ?? 50))
  const zoom = Math.min(300, Math.max(100, hero.zoom ?? 100)) / 100
  const image = hero.image ? (/^(https?:|data:)/.test(hero.image) ? hero.image : `${base}${hero.image}`) : null
  // Zoom emulation (Satori has no transform-origin scale): oversize the image
  // by the zoom factor and shift it so the focal point stays put — identical
  // math to the page's `scale()` with `transformOrigin: posX% posY%`.
  const imgW = OG_SIZE.width * zoom
  const imgH = OG_SIZE.height * zoom
  const imgLeft = -(imgW - OG_SIZE.width) * (posX / 100)
  const imgTop = -(imgH - OG_SIZE.height) * (posY / 100)

  return (
    <div style={{ width: "100%", height: "100%", display: "flex", position: "relative", backgroundColor: t.brandTo }}>
      {image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={image}
          alt=""
          style={{
            position: "absolute",
            top: imgTop,
            left: imgLeft,
            width: imgW,
            height: imgH,
            objectFit: "cover",
            objectPosition: `${posX}% ${posY}%`,
          }}
        />
      )}
    </div>
  )
}
