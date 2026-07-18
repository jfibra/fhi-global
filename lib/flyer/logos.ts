// Brand logos for the marketing generators — the SAME assets the Reel Maker
// uses (public/logos + the root FHI branding). Shared by the flyer studio and
// the Just Listed/Sold editor so both offer one logo lineup.
//
// "Auto" (url:null) uses the design's own black/white FHI mark.
// `tone: "light"` = white artwork (needs a dark backdrop to be visible).

export type LogoOption = { label: string; url: string | null; tone: "dark" | "light" }

export const LOGOS: LogoOption[] = (
  [
    { label: "Auto", url: null, tone: "dark" },
    { label: "Filipino Homes", url: "/logos/Filipinohomes-logo-side-left-white.png", tone: "light" },
    { label: "Homes PH", url: "/logos/homesph-logo.png", tone: "dark" },
    { label: "Rent PH", url: "/logos/RentPh new colored logo.png", tone: "dark" },
    { label: "FH Global Partners", url: "/logos/global_partner.png", tone: "dark" },
    { label: "FHI Global", url: "/FHI_Branding_White.png", tone: "light" },
    { label: "Rentsouq AE", url: "/logos/RENTSOUQ_AE LOGO.png", tone: "dark" },
    { label: "FHI Branding", url: "/logos/FHI_Branding Set_PNG Copies-02.png", tone: "dark" },
  ] as LogoOption[]
).map((l) => (l.url ? { ...l, url: encodeURI(l.url) } : l))

export const logoTone = (url: string | null): "dark" | "light" =>
  (url ? LOGOS.find((l) => l.url === url)?.tone : undefined) ?? "dark"

// A CSS `filter` string that draws an outline hugging the logo artwork's SHAPE
// (its alpha silhouette) rather than a rectangular plate — by stacking hard
// drop-shadows around a circle. Renders natively through html-to-image's
// <foreignObject>, so it survives PNG export. Returns undefined for px<=0.
export function outlineFilter(px: number, color = "#ffffff"): string | undefined {
  if (!px || px <= 0) return undefined
  const dirs = 12
  const parts: string[] = []
  for (let i = 0; i < dirs; i++) {
    const a = (i / dirs) * Math.PI * 2
    const dx = +(Math.cos(a) * px).toFixed(2)
    const dy = +(Math.sin(a) * px).toFixed(2)
    parts.push(`drop-shadow(${dx}px ${dy}px 0 ${color})`)
  }
  return parts.join(" ")
}
