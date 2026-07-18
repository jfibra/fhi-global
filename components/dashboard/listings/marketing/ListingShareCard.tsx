import type { FlyerData } from "@/lib/flyer/theme"
import { formatPrice, readableOn, withAlpha } from "@/lib/flyer/theme"
import { OG_CARD_W, OG_CARD_H, OG_THEMES, type OgCardOptions } from "@/lib/flyer/og-card"

// The share card itself — rendered by BOTH the ShareCardModal live preview
// (real DOM, captured with html-to-image) and the /og/listing/{id} route
// (satori via next/og ImageResponse). To stay pixel-identical in the two
// renderers it follows satori's rules: inline styles only (no Tailwind, no
// hooks), explicit `display: flex` on every element with children, explicit
// <img> dimensions, no boxShadow/grid, and text truncated in JS instead of
// line-clamp.

export type ListingShareCardProps = {
  data: FlyerData & { currency: string }
  options: OgCardOptions
  /** Resolved photo URL: proxied() in the dialog, raw absolute URL in the OG route. Null = no photo. */
  photoSrc: string | null
  /** FHI white logo: "/FHI_Branding_White.png" in the dialog, a data: URL in the OG route. */
  logoSrc: string
}

const PANEL_W = 560
const PHOTO_W = OG_CARD_W - PANEL_W

// FHI_Branding_White.png is 2269×835 (≈2.72:1).
const LOGO_H = 58
const LOGO_W = 158

const truncate = (s: string, max: number) => {
  const t = (s ?? "").trim()
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t
}

const PERIOD_SUFFIX: Record<string, string> = {
  month: "/ month",
  day: "/ day",
  year: "/ year",
}

export default function ListingShareCard({ data, options, photoSrc, logoSrc }: ListingShareCardProps) {
  const theme = OG_THEMES[options.theme]
  const gold = "#d6b357"

  const showPrice = !options.hide.includes("price")
  const showSpecs = !options.hide.includes("specs")
  const showLocation = !options.hide.includes("location")

  const isRent = data.category.toUpperCase().includes("RENT")
  const badgeLabel = isRent ? "FOR RENT" : "FOR SALE"

  const priceText = formatPrice(data.price, data.currency)
  const hasRealPrice = Boolean(data.price) && !Number.isNaN(data.price)
  const periodSuffix = hasRealPrice && options.period ? PERIOD_SUFFIX[options.period] : null

  const specBits: string[] = []
  if (data.subtype) specBits.push(truncate(data.subtype, 24))
  const beds = Number(data.specs.bedrooms ?? 0)
  const baths = Number(data.specs.bathrooms ?? 0)
  const sqm = Number(data.specs.floorArea ?? 0)
  if (beds > 0) specBits.push(beds === 1 ? "1 Bed" : `${beds} Beds`)
  if (baths > 0) specBits.push(baths === 1 ? "1 Bath" : `${baths} Baths`)
  if (sqm > 0) specBits.push(`${sqm} sqm`)

  const address = truncate(data.address, 58)
  const title = truncate(data.title, 64)
  const agentPhone = (data.agent.phone ?? "").trim()

  const badgeColored = options.badge === "color"

  return (
    <div
      style={{
        width: OG_CARD_W,
        height: OG_CARD_H,
        display: "flex",
        flexDirection: options.flip ? "row-reverse" : "row",
        background: theme.bg,
        fontFamily: "Arial, Helvetica, sans-serif",
        overflow: "hidden",
      }}
    >
      {/* Content panel */}
      <div
        style={{
          width: PANEL_W,
          height: OG_CARD_H,
          display: "flex",
          flexDirection: "column",
          padding: "40px 44px",
        }}
      >
        {/* Header row: logo left, category badge right (same line). */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logoSrc} alt="FHI Global" width={LOGO_W} height={LOGO_H} style={{ width: LOGO_W, height: LOGO_H, objectFit: "contain" }} />
          <div
            style={{
              display: "flex",
              padding: "7px 16px",
              borderRadius: 999,
              fontSize: 17,
              fontWeight: 700,
              letterSpacing: 2,
              background: badgeColored ? gold : "rgba(255,255,255,0.08)",
              border: badgeColored ? "2px solid rgba(0,0,0,0)" : "2px solid rgba(255,255,255,0.65)",
              color: badgeColored ? readableOn(gold) : "#ffffff",
            }}
          >
            {badgeLabel}
          </div>
        </div>

        {/* Details — vertically centered between the header and the bottom. */}
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", flexGrow: 1 }}>
          <div
            style={{
              display: "flex",
              fontSize: 38,
              lineHeight: 1.18,
              fontWeight: 800,
              color: "#ffffff",
            }}
          >
            {title}
          </div>

          {showLocation && address ? (
            <div
              style={{
                display: "flex",
                marginTop: 12,
                fontSize: 21,
                color: "rgba(255,255,255,0.72)",
              }}
            >
              {address}
            </div>
          ) : null}

          {showPrice ? (
            <div style={{ display: "flex", alignItems: "flex-end", marginTop: 22 }}>
              <div style={{ display: "flex", fontSize: hasRealPrice ? 50 : 36, fontWeight: 800, color: options.priceColor, lineHeight: 1 }}>
                {priceText}
              </div>
              {periodSuffix ? (
                <div style={{ display: "flex", marginLeft: 10, fontSize: 24, fontWeight: 600, color: withAlpha(options.priceColor, 0.8), paddingBottom: 4 }}>
                  {periodSuffix}
                </div>
              ) : null}
            </div>
          ) : null}

          {showSpecs && specBits.length ? (
            <div
              style={{
                display: "flex",
                marginTop: 18,
                fontSize: 22,
                color: "rgba(255,255,255,0.85)",
              }}
            >
              {specBits.join("  ·  ")}
            </div>
          ) : null}
        </div>

        {options.agent && data.agent.name ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              borderTop: `2px solid ${withAlpha(gold, 0.45)}`,
              paddingTop: 16,
            }}
          >
            <div style={{ display: "flex", fontSize: 15, fontWeight: 700, letterSpacing: 2, color: gold }}>LISTED BY</div>
            <div style={{ display: "flex", marginTop: 5, fontSize: 22, fontWeight: 700, color: "#ffffff" }}>
              {truncate(data.agent.name, 34)}
            </div>
            {agentPhone ? (
              <div style={{ display: "flex", marginTop: 2, fontSize: 19, color: "rgba(255,255,255,0.78)" }}>{agentPhone}</div>
            ) : null}
          </div>
        ) : null}
      </div>

      {/* Photo side */}
      <div
        style={{
          width: PHOTO_W,
          height: OG_CARD_H,
          display: "flex",
          position: "relative",
          background: theme.panel,
        }}
      >
        {photoSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photoSrc}
            alt=""
            width={PHOTO_W}
            height={OG_CARD_H}
            style={{ width: PHOTO_W, height: OG_CARD_H, objectFit: "cover", position: "absolute", top: 0, left: 0 }}
          />
        ) : (
          <div
            style={{
              display: "flex",
              width: PHOTO_W,
              height: OG_CARD_H,
              alignItems: "center",
              justifyContent: "center",
              opacity: 0.16,
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logoSrc} alt="" width={330} height={121} style={{ width: 330, height: 121, objectFit: "contain" }} />
          </div>
        )}
        {photoSrc ? (
          <div
            style={{
              display: "flex",
              position: "absolute",
              top: 0,
              left: 0,
              width: PHOTO_W,
              height: OG_CARD_H,
              background: options.flip
                ? `linear-gradient(270deg, ${theme.bg} 0%, rgba(0,0,0,0) 24%)`
                : `linear-gradient(90deg, ${theme.bg} 0%, rgba(0,0,0,0) 24%)`,
            }}
          />
        ) : null}
      </div>
    </div>
  )
}
