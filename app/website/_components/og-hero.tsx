// The link-share thumbnail (og:image) for an agent site: the hero at card
// size — banner photo, headline + description, the stat strip, AND the broker
// contact/RERA card at the bottom right (which the live page no longer shows).
// Rendered by next/og (Satori), so: flexbox only, raw hex colors (no CSS
// vars), absolute image URLs, and every multi-child element display:flex.

import { createElement } from "react"
import {
  DEFAULT_THEME, HERO_STAT_ICON_FALLBACK, NAVY, resolveThemeColors,
  type WebsiteData,
} from "../_data"
import { OG_ICON_NODES } from "./og-icon-nodes"

export const OG_SIZE = { width: 1200, height: 630 }

/** #rrggbb → rgba() — local so this file never touches CSS-var constants. */
function rgba(hex: string, alpha: number): string {
  const n = parseInt(hex.replace("#", ""), 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`
}

/** Draw a lucide icon from its extracted geometry — every element carries
 *  explicit stroke attributes, which Satori renders reliably. */
function OgIcon({ name, size, color, strokeWidth = 1.8 }: { name: string; size: number; color: string; strokeWidth?: number }) {
  const nodes = OG_ICON_NODES[name] ?? []
  return (
    <svg viewBox="0 0 24 24" width={size} height={size}>
      {nodes.map(([tag, attrs], i) =>
        createElement(tag, {
          ...attrs,
          key: i,
          fill: "none",
          stroke: color,
          strokeWidth,
          strokeLinecap: "round",
          strokeLinejoin: "round",
        }),
      )}
    </svg>
  )
}

/** WhatsApp glyph inlined for Satori (ui.tsx's version is identical). */
function WaGlyph({ size, color }: { size: number; color: string }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill={color}>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.52.149-.174.198-.298.297-.497.1-.198.05-.371-.025-.52-.074-.149-.668-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" />
    </svg>
  )
}

/** The element tree for ImageResponse. `base` makes relative image URLs absolute. */
export function OgHero({ data, base }: { data: WebsiteData; base: string }) {
  const { agent, hero } = data
  const t = resolveThemeColors(data.theme ?? DEFAULT_THEME)
  const overlay = Math.min(100, Math.max(0, hero.overlay ?? 0)) / 100
  const posX = Math.min(100, Math.max(0, hero.posX ?? 50))
  const posY = Math.min(100, Math.max(0, hero.posY ?? 50))
  const image = hero.image ? (hero.image.startsWith("http") ? hero.image : `${base}${hero.image}`) : null
  const headlineLines = hero.headline.split("\n").filter(Boolean)
  const stats = hero.stats.slice(0, 4)

  const contactRows: { icon: "wa" | "phone" | "mail"; text: string }[] = [
    { icon: "wa", text: agent.whatsapp },
    { icon: "phone", text: agent.phone },
    { icon: "mail", text: agent.email },
  ]

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        position: "relative",
        backgroundColor: t.brandTo,
        fontFamily: "sans-serif",
      }}
    >
      {image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={image}
          alt=""
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: `${posX}% ${posY}%`,
          }}
        />
      )}
      {overlay > 0 && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            display: "flex",
            background: `linear-gradient(90deg, rgba(0,0,0,${overlay}) 0%, rgba(0,0,0,${overlay * 0.55}) 38%, rgba(0,0,0,0) 68%)`,
          }}
        />
      )}

      {/* Headline + description */}
      <div
        style={{
          position: "absolute",
          top: 64,
          left: 64,
          width: 620,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", fontSize: 58, fontWeight: 700, lineHeight: 1.12, color: hero.headlineColor || NAVY }}>
          {headlineLines.map((line, i) => (
            <div key={i} style={{ display: "flex" }}>
              {i === headlineLines.length - 1 ? (
                <div style={{ display: "flex" }}>
                  <span>{line}</span>
                  <span style={{ color: hero.headlineAccentColor || t.gold, marginLeft: 14 }}>{hero.headlineAccent}</span>
                </div>
              ) : (
                <span>{line}</span>
              )}
            </div>
          ))}
          {headlineLines.length === 0 && (
            <span style={{ color: hero.headlineAccentColor || t.gold }}>{hero.headlineAccent}</span>
          )}
        </div>
        <div style={{ display: "flex", marginTop: 20, width: 400, fontSize: 19, lineHeight: 1.5, color: hero.descriptionColor || "#3d4451" }}>
          {hero.description}
        </div>
      </div>

      {/* Stat strip — glass band along the bottom left */}
      {stats.length > 0 && (
        <div
          style={{
            position: "absolute",
            left: 64,
            bottom: 48,
            display: "flex",
            alignItems: "center",
            gap: 34,
            padding: "18px 30px 18px 22px",
            backgroundColor: rgba(t.brandTo, 0.45),
            borderTop: "1px solid rgba(255,255,255,0.14)",
            borderBottom: "1px solid rgba(255,255,255,0.14)",
          }}
        >
          {stats.map(({ icon, value, label }, i) => {
            const iconKey = icon ?? HERO_STAT_ICON_FALLBACK[i % HERO_STAT_ICON_FALLBACK.length]
            return (
              <div key={`${label}-${i}`} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 44,
                    height: 44,
                    borderRadius: 22,
                    border: `1px solid ${t.gold}`,
                  }}
                >
                  <OgIcon name={iconKey} size={19} color={t.gold} strokeWidth={1.6} />
                </div>
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <span style={{ fontSize: 21, fontWeight: 700, color: "#ffffff", lineHeight: 1.1 }}>{value}</span>
                  <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.6, color: "rgba(255,255,255,0.62)" }}>
                    {label.toUpperCase()}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Broker card — the contact + RERA panel, bottom right (thumbnail-only) */}
      <div
        style={{
          position: "absolute",
          right: 48,
          bottom: 48,
          width: 300,
          display: "flex",
          flexDirection: "column",
          padding: 24,
          backgroundColor: rgba(t.brandTo, 0.82),
          border: "1px solid rgba(255,255,255,0.16)",
        }}
      >
        <span style={{ fontSize: 15, fontWeight: 700, letterSpacing: 2.2, color: "#ffffff" }}>
          {agent.name.toUpperCase()}
        </span>
        {agent.title && (
          <span style={{ marginTop: 5, fontSize: 12, color: "rgba(255,255,255,0.7)" }}>{agent.title}</span>
        )}
        <div style={{ display: "flex", flexDirection: "column", marginTop: 14, gap: 8 }}>
          {contactRows.map(({ icon, text }) => (
            <div key={icon} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {icon === "wa" && <WaGlyph size={14} color={t.gold} />}
              {icon === "phone" && <OgIcon name="phone" size={14} color={t.gold} />}
              {icon === "mail" && <OgIcon name="mail" size={14} color={t.gold} />}
              <span style={{ fontSize: 13, color: "rgba(255,255,255,0.85)" }}>{text}</span>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", marginTop: 14, height: 1, width: "100%", backgroundColor: "rgba(255,255,255,0.15)" }} />
        {agent.brn && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 13 }}>
            <OgIcon name="shield-check" size={15} color={t.gold} />
            <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1.2, color: t.gold }}>RERA BRN: {agent.brn}</span>
          </div>
        )}
        {agent.orn && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 11 }}>
            <OgIcon name="file-text" size={15} color={t.gold} />
            <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1.2, color: t.gold }}>RERA ORN: {agent.orn}</span>
          </div>
        )}
      </div>
    </div>
  )
}
