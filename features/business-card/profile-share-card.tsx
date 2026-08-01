import {
  PROFILE_OG_H,
  PROFILE_OG_THEMES,
  PROFILE_OG_W,
  type ProfileOgCard,
} from "@/lib/profile-og-card"

/**
 * The link-preview card itself — rendered by BOTH the Link Preview tab's live
 * preview (real DOM) and the /og/business-card/{id} route (satori via next/og).
 *
 * To stay pixel-identical across the two renderers it follows satori's rules,
 * exactly as ListingShareCard does: inline styles only (no Tailwind, no hooks),
 * an explicit `display: flex` on every element with children, explicit <img>
 * dimensions, no boxShadow or grid, and text truncated in JS rather than with
 * line-clamp.
 */

export type ProfileShareCardProps = {
  name: string
  role: string
  tagline: string
  phone: string
  email: string
  /** Resolved photo URL: proxied in the dialog, absolute in the OG route. */
  photoSrc: string | null
  /** FHI white mark: a public path in the dialog, a data: URL in the OG route. */
  logoSrc: string
  options: ProfileOgCard
}

const PANEL_W = 640
const PHOTO_W = PROFILE_OG_W - PANEL_W

// FHI_Branding_White.png is 2269×835 (≈2.72:1).
const LOGO_H = 52
const LOGO_W = 141

const truncate = (s: string, max: number) => {
  const t = (s ?? "").trim()
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t
}

/** Initials stand in when there is no photo — never an empty grey box. */
function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return "?"
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase()
}

export default function ProfileShareCard({
  name,
  role,
  tagline,
  phone,
  email,
  photoSrc,
  logoSrc,
  options,
}: ProfileShareCardProps) {
  const theme = PROFILE_OG_THEMES[options.theme]
  const accent = options.accent

  const showRole = !options.hide.includes("role") && !!role
  const showTagline = !options.hide.includes("tagline") && !!tagline
  const showPhone = !options.hide.includes("phone") && !!phone
  const showEmail = !options.hide.includes("email") && !!email
  const centred = options.layout === "center"

  // Long names wrap to two lines; the size steps down so three-part Filipino
  // names don't overflow the panel.
  const displayName = truncate(name, 38)
  const nameSize = displayName.length > 26 ? 52 : displayName.length > 18 ? 62 : 72

  const contactRow = (label: string, value: string) => (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <div
        style={{
          display: "flex",
          width: 8,
          height: 8,
          borderRadius: 4,
          background: accent,
        }}
      />
      <div style={{ display: "flex", fontSize: 25, color: "rgba(255,255,255,0.88)" }}>
        {truncate(value, 40)}
      </div>
      <div style={{ display: "none" }}>{label}</div>
    </div>
  )

  const portrait = (size: number, radius: number) =>
    photoSrc ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={photoSrc}
        alt=""
        width={size}
        height={size}
        style={{ width: size, height: size, borderRadius: radius, objectFit: "cover" }}
      />
    ) : (
      <div
        style={{
          display: "flex",
          width: size,
          height: size,
          borderRadius: radius,
          background: theme.panel,
          border: `4px solid ${accent}`,
          alignItems: "center",
          justifyContent: "center",
          fontSize: size * 0.36,
          fontWeight: 700,
          color: accent,
        }}
      >
        {initialsOf(name)}
      </div>
    )

  // ── Centred: round portrait above the name, everything stacked. ─────────
  if (centred) {
    return (
      <div
        style={{
          width: PROFILE_OG_W,
          height: PROFILE_OG_H,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 20,
          background: theme.bg,
          fontFamily: "Arial, Helvetica, sans-serif",
          position: "relative",
        }}
      >
        {/* Accent rule along the top, the one piece of chrome both layouts share. */}
        <div
          style={{ display: "flex", position: "absolute", top: 0, left: 0, width: PROFILE_OG_W, height: 10, background: accent }}
        />
        {portrait(200, 100)}
        <div
          style={{
            display: "flex",
            fontSize: nameSize > 62 ? 62 : nameSize,
            fontWeight: 700,
            color: "#ffffff",
            textAlign: "center",
          }}
        >
          {displayName}
        </div>
        {showRole && (
          <div style={{ display: "flex", fontSize: 27, fontWeight: 700, color: accent, letterSpacing: 3 }}>
            {truncate(role.toUpperCase(), 40)}
          </div>
        )}
        {showTagline && (
          <div style={{ display: "flex", fontSize: 25, color: "rgba(255,255,255,0.78)", textAlign: "center", maxWidth: 900 }}>
            {truncate(tagline, 90)}
          </div>
        )}
        <div style={{ display: "flex", gap: 34, marginTop: 6 }}>
          {showPhone && contactRow("phone", phone)}
          {showEmail && contactRow("email", email)}
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={logoSrc}
          alt="FHI Global"
          width={LOGO_W}
          height={LOGO_H}
          style={{ width: LOGO_W, height: LOGO_H, objectFit: "contain", position: "absolute", bottom: 34 }}
        />
      </div>
    )
  }

  // ── Split: photo panel on the left, details on the right. ───────────────
  return (
    <div
      style={{
        width: PROFILE_OG_W,
        height: PROFILE_OG_H,
        display: "flex",
        background: theme.bg,
        fontFamily: "Arial, Helvetica, sans-serif",
      }}
    >
      <div
        style={{
          display: "flex",
          width: PHOTO_W,
          height: PROFILE_OG_H,
          background: theme.panel,
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
        }}
      >
        {photoSrc ? (
          // Fills the panel rather than sitting in it — a face bled to the edge
          // is what reads at feed size, where the card is ~500px wide.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photoSrc}
            alt=""
            width={PHOTO_W}
            height={PROFILE_OG_H}
            style={{ width: PHOTO_W, height: PROFILE_OG_H, objectFit: "cover" }}
          />
        ) : (
          portrait(260, 130)
        )}
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: PANEL_W,
          height: PROFILE_OG_H,
          padding: "56px 56px 44px",
          justifyContent: "center",
          gap: 18,
          borderLeft: `10px solid ${accent}`,
        }}
      >
        {showRole && (
          <div style={{ display: "flex", fontSize: 24, fontWeight: 700, color: accent, letterSpacing: 3 }}>
            {truncate(role.toUpperCase(), 34)}
          </div>
        )}
        <div style={{ display: "flex", fontSize: nameSize, fontWeight: 700, color: "#ffffff", lineHeight: 1.05 }}>
          {displayName}
        </div>
        {showTagline && (
          <div style={{ display: "flex", fontSize: 25, color: "rgba(255,255,255,0.76)", lineHeight: 1.35 }}>
            {truncate(tagline, 96)}
          </div>
        )}
        {(showPhone || showEmail) && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 8 }}>
            {showPhone && contactRow("phone", phone)}
            {showEmail && contactRow("email", email)}
          </div>
        )}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={logoSrc}
          alt="FHI Global"
          width={LOGO_W}
          height={LOGO_H}
          style={{ width: LOGO_W, height: LOGO_H, objectFit: "contain", marginTop: 18 }}
        />
      </div>
    </div>
  )
}
