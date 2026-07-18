"use client"

import { forwardRef } from "react"
import { QRCodeSVG } from "qrcode.react"
import { Bed, Bath, SquareParking, Scan, Layers2, MapPin, Phone, Mail } from "lucide-react"
import {
  type TemplateProps,
  FLYER_W,
  FLYER_H,
  formatPrice,
  getAgentInitials,
  readableOn,
  shade,
  withAlpha,
} from "@/lib/flyer/theme"

// Faithful inline-styled rebuild of filipinohomes-final's Template9Luxe flyer
// (940×788 Facebook-feed size) — a cinematic glass-panel showcase. Rendered at
// natural pixel size so html2canvas can rasterize it 1:1.

const W = FLYER_W
const H = FLYER_H
const QR_SIZE = 104

const Template9Luxe = forwardRef<HTMLDivElement, TemplateProps>(function Template9Luxe(
  { data, listingUrl, theme },
  ref,
) {
  const { accent, bg, mode } = theme
  const currency = data.currency ?? "AED"

  // ── Derived luxe palette ──────────────────────────────────────────────────
  // Force a deep, dramatic base for the glass/scrim regardless of the chosen
  // bg (light themes get darkened so the "dark luxe" identity holds).
  const ink = mode === "dark" ? bg : shade(bg, -0.84)
  const inkDeep = shade(ink, -0.35)
  const glass = withAlpha(ink, 0.55) // floating translucent panels
  const glassSolid = withAlpha(ink, 0.74) // slightly denser for the agent bar
  const hair = withAlpha(accent, 0.55) // 1px accent hairline borders
  const hairSoft = withAlpha(accent, 0.28)
  const onGlass = readableOn(ink) // text/icons over the dark glass
  const onGlassSoft = withAlpha(onGlass, 0.82)
  const onGlassFaint = withAlpha(onGlass, 0.6)
  const onAccent = readableOn(accent)
  const accentGlow = shade(accent, 0.26) // lightened accent for price/lines

  // Logo sits on a dark scrim over the photo → always the white mark.
  const logoSrc = readableOn(ink) === "#ffffff" ? "/FHI_Branding_White.png" : "/FHI_Branding.png"

  const category = (data.category || "For Sale").toUpperCase()
  const agentInitials = getAgentInitials(data.agent.name)
  const photo = data.image
  // 3 slots: hero (data.image) + two additional photos (gallery[0], gallery[1]).
  const thumbs = [data.gallery?.[0], data.gallery?.[1]].filter(Boolean) as string[]

  const specs = [
    { value: data.specs.bedrooms, label: "Beds", icon: <Bed size={18} /> },
    { value: data.specs.bathrooms, label: "Baths", icon: <Bath size={18} /> },
    { value: data.specs.garage, label: "Parking", icon: <SquareParking size={18} /> },
    { value: data.specs.lotArea, label: "Lot sqm", icon: <Scan size={18} /> },
    { value: data.specs.floorArea, label: "Floor sqm", icon: <Layers2 size={18} /> },
  ].filter(({ value }) => parseFloat(String(value ?? "")) > 0)

  return (
    <div
      ref={ref}
      style={{
        width: W,
        height: H,
        position: "relative",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        backgroundColor: inkDeep,
        fontFamily: "var(--font-urbanist), var(--font-outfit), system-ui, sans-serif",
      }}
    >
      {/* ===== FULL-BLEED PHOTO (overscanned 2px) ===== */}
      {photo ? (
        <div style={{ position: "absolute", top: -2, left: -2, right: -2, bottom: -2 }}>
          <div
            style={{
              position: "absolute",
              inset: 0,
              backgroundColor: ink,
              backgroundImage: `url("${photo}")`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
          />
          <div style={{ position: "absolute", inset: 0, backgroundColor: withAlpha(inkDeep, 0.55) }} />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photo}
            alt=""
            aria-hidden
            crossOrigin="anonymous"
            style={{ position: "absolute", width: 1, height: 1, opacity: 0, pointerEvents: "none" }}
          />
        </div>
      ) : (
        <div
          style={{
            position: "absolute",
            top: -2,
            left: -2,
            right: -2,
            bottom: -2,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: `linear-gradient(135deg, ${shade(ink, 0.06)} 0%, ${inkDeep} 100%)`,
          }}
        >
          <span
            style={{
              display: "block",
              color: withAlpha(onGlass, 0.7),
              fontSize: "1.15rem",
              fontWeight: 600,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              lineHeight: 1.2,
            }}
          >
            No Image
          </span>
        </div>
      )}

      {/* Dramatic dark scrim — heavier top & bottom for text legibility */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          background: `linear-gradient(180deg, ${withAlpha(ink, 0.82)} 0%, ${withAlpha(ink, 0.2)} 22%, ${withAlpha(ink, 0.28)} 48%, ${withAlpha(ink, 0.9)} 100%)`,
        }}
      />
      {/* Left-side cinematic vignette */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          background: `linear-gradient(90deg, ${withAlpha(ink, 0.72)} 0%, ${withAlpha(ink, 0)} 46%)`,
        }}
      />

      {/* Thin accent frame — inset luxe border */}
      <div
        style={{
          position: "absolute",
          top: 22,
          left: 22,
          right: 22,
          bottom: 22,
          border: `1px solid ${hairSoft}`,
          pointerEvents: "none",
          zIndex: 3,
        }}
      />
      {/* Top accent glow line */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 4,
          zIndex: 3,
          background: `linear-gradient(90deg, transparent, ${accent}, transparent)`,
        }}
      />

      {/* ===== CONTENT ===== */}
      <div
        style={{
          position: "relative",
          zIndex: 4,
          flex: 1,
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
          paddingLeft: 48,
          paddingRight: 48,
          paddingTop: 26,
          paddingBottom: 26,
        }}
      >
        {/* ---- TOP ROW: masthead + QR ---- */}
        <div style={{ flexShrink: 0, display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 24 }}>
          {/* Masthead lockup */}
          <div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logoSrc} alt="" crossOrigin="anonymous" style={{ height: 40, display: "block" }} />
            <div style={{ display: "flex", alignItems: "center", gap: 9.6, marginTop: 16 }}>
              <div style={{ width: 34, height: 2, backgroundColor: accent }} />
              <span
                style={{
                  display: "block",
                  fontSize: "0.72rem",
                  fontWeight: 700,
                  color: accentGlow,
                  letterSpacing: "0.34em",
                  textTransform: "uppercase",
                  fontStyle: "italic",
                  lineHeight: 1.2,
                  textShadow: `0 2px 10px ${withAlpha(ink, 0.7)}`,
                }}
              >
                Private Collection
              </span>
            </div>
          </div>

          {/* QR — gold-gradient frame + solid white card */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 7.2, flexShrink: 0 }}>
            <div
              style={{
                padding: 3,
                borderRadius: 14,
                background: `linear-gradient(135deg, ${accent}, ${accentGlow})`,
                boxShadow: `0 14px 34px ${withAlpha(inkDeep, 0.6)}`,
              }}
            >
              <div style={{ padding: 8.8, backgroundColor: "#ffffff", borderRadius: 11 }}>
                <QRCodeSVG value={listingUrl} size={QR_SIZE} fgColor="#111318" level="H" />
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 4.8 }}>
              <div style={{ width: 5, height: 5, borderRadius: "50%", backgroundColor: accent }} />
              <span
                style={{
                  display: "block",
                  fontSize: "0.66rem",
                  fontWeight: 800,
                  color: onGlass,
                  letterSpacing: "0.24em",
                  textTransform: "uppercase",
                  textShadow: `0 2px 8px ${withAlpha(ink, 0.85)}`,
                }}
              >
                Scan to View
              </span>
            </div>
          </div>
        </div>

        {/* flexible gap so the top row and the panels never collide; the panels
            never shrink (flexShrink 0) so their content can't cram/overlap. */}
        <div style={{ flex: 1, minHeight: 16 }} />

        {/* ---- BOTTOM CLUSTER: thumbnails + glass panels ---- */}
        <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", gap: 8.8 }}>
          {/* Thumbnail strip */}
          {thumbs.length > 0 && (
            <div style={{ display: "flex", gap: 9.6 }}>
              {thumbs.map((t, i) => (
                <div
                  key={i}
                  style={{
                    position: "relative",
                    width: 104,
                    height: 60,
                    borderRadius: 10,
                    overflow: "hidden",
                    border: `1px solid ${hair}`,
                    boxShadow: `0 10px 24px ${withAlpha(inkDeep, 0.55)}`,
                    backgroundImage: `url("${t}")`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={t}
                    alt=""
                    aria-hidden
                    crossOrigin="anonymous"
                    style={{ position: "absolute", width: 1, height: 1, opacity: 0, pointerEvents: "none" }}
                  />
                </div>
              ))}
            </div>
          )}

          {/* Panels row */}
          <div style={{ display: "flex", alignItems: "stretch", gap: 16 }}>
            {/* LEFT — details glass panel */}
            <div
              style={{
                flex: "1.55 1 0",
                minWidth: 0,
                backgroundColor: glass,
                border: `1px solid ${hair}`,
                borderRadius: 18,
                boxShadow: `0 20px 48px ${withAlpha(inkDeep, 0.55)}`,
                padding: 18,
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
              }}
            >
              {/* Category pill + subtype eyebrow */}
              <div style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 11.2, flexWrap: "wrap" }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 5.6,
                    backgroundColor: accent,
                    paddingLeft: 12.8,
                    paddingRight: 12.8,
                    paddingTop: 5.6,
                    paddingBottom: 5.6,
                    borderRadius: 999,
                  }}
                >
                  <div style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: onAccent }} />
                  <span
                    style={{
                      display: "block",
                      fontSize: "0.72rem",
                      fontWeight: 900,
                      color: onAccent,
                      letterSpacing: "0.18em",
                      textTransform: "uppercase",
                      lineHeight: 1.15,
                    }}
                  >
                    {category}
                  </span>
                </div>
                {data.subtype && (
                  <span
                    style={{
                      display: "block",
                      fontSize: "0.74rem",
                      fontWeight: 700,
                      color: accentGlow,
                      letterSpacing: "0.16em",
                      textTransform: "uppercase",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      maxWidth: 300,
                    }}
                  >
                    {data.subtype}
                  </span>
                )}
              </div>

              {/* Title */}
              <div
                style={{
                  flexShrink: 0,
                  marginTop: 8,
                  fontSize: "1.6rem",
                  fontWeight: 900,
                  color: onGlass,
                  lineHeight: 1.08,
                  letterSpacing: "-0.015em",
                  textTransform: "capitalize",
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                  maxHeight: "2.2em",
                }}
              >
                {data.title}
              </div>

              {/* Address */}
              <div style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 4.8, marginTop: 7.2 }}>
                <MapPin size={19} color={accent} style={{ flexShrink: 0 }} />
                <span
                  style={{
                    fontSize: "1rem",
                    color: onGlassSoft,
                    fontWeight: 500,
                    textTransform: "capitalize",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {data.address}
                </span>
              </div>

              {/* Accent divider */}
              <div
                style={{
                  flexShrink: 0,
                  marginTop: 10.4,
                  marginBottom: 10.4,
                  height: 1,
                  background: `linear-gradient(90deg, ${accent}, ${withAlpha(accent, 0)})`,
                }}
              />

              {/* Price + specs */}
              <div style={{ flexShrink: 0, display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
                {/* Price */}
                <div style={{ display: "flex", alignItems: "stretch", gap: 11.2 }}>
                  <div style={{ width: 4, borderRadius: 2, backgroundColor: accent, flexShrink: 0 }} />
                  <div>
                    <span
                      style={{
                        display: "block",
                        fontSize: "0.68rem",
                        fontWeight: 800,
                        color: onGlassFaint,
                        letterSpacing: "0.26em",
                        textTransform: "uppercase",
                        lineHeight: 1.2,
                        marginBottom: 4.8,
                      }}
                    >
                      Guide Price
                    </span>
                    <div
                      style={{
                        fontSize: "2rem",
                        fontWeight: 900,
                        color: accentGlow,
                        lineHeight: 1,
                        letterSpacing: "-0.02em",
                        textShadow: `0 3px 16px ${withAlpha(inkDeep, 0.6)}`,
                      }}
                    >
                      {formatPrice(data.price, currency)}
                    </div>
                  </div>
                </div>

                {/* Specs */}
                {specs.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 7.2, justifyContent: "flex-end" }}>
                    {specs.map(({ value, label, icon }) => (
                      <div
                        key={label}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 5.6,
                          backgroundColor: withAlpha(onGlass, 0.06),
                          border: `1px solid ${hairSoft}`,
                          paddingLeft: 10.4,
                          paddingRight: 10.4,
                          paddingTop: 6.4,
                          paddingBottom: 6.4,
                          borderRadius: 999,
                        }}
                      >
                        <div style={{ color: accent, display: "flex" }}>{icon}</div>
                        <span style={{ display: "block", fontSize: "1rem", fontWeight: 800, color: onGlass, lineHeight: 1.15 }}>
                          {Math.round(parseFloat(String(value)))}
                        </span>
                        <span
                          style={{
                            display: "block",
                            fontSize: "0.64rem",
                            fontWeight: 700,
                            color: onGlassFaint,
                            textTransform: "uppercase",
                            letterSpacing: "0.06em",
                            lineHeight: 1.15,
                            whiteSpace: "nowrap",
                          }}
                        >
                          {label}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* RIGHT — agent glass panel */}
            <div
              style={{
                flex: "1 1 0",
                minWidth: 0,
                backgroundColor: glassSolid,
                border: `1px solid ${hair}`,
                borderRadius: 18,
                boxShadow: `0 20px 48px ${withAlpha(inkDeep, 0.55)}`,
                padding: 18,
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                overflow: "hidden",
              }}
            >
              <span
                style={{
                  display: "block",
                  fontSize: "0.66rem",
                  fontWeight: 800,
                  color: accentGlow,
                  letterSpacing: "0.22em",
                  textTransform: "uppercase",
                  fontStyle: "italic",
                  lineHeight: 1.2,
                }}
              >
                Private Consultant
              </span>

              <div style={{ display: "flex", alignItems: "center", gap: 12.8, marginTop: 11.2 }}>
                <div
                  style={{
                    width: 62,
                    height: 62,
                    borderRadius: "50%",
                    overflow: "hidden",
                    flexShrink: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: withAlpha(accent, 0.22),
                    border: `2px solid ${accent}`,
                  }}
                >
                  {data.agent.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={data.agent.imageUrl}
                      alt=""
                      crossOrigin="anonymous"
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  ) : (
                    <span style={{ fontSize: "1.3rem", fontWeight: 800, color: accentGlow }}>{agentInitials}</span>
                  )}
                </div>
                <div
                  style={{
                    fontSize: "1.3rem",
                    fontWeight: 800,
                    color: onGlass,
                    textTransform: "capitalize",
                    lineHeight: 1.15,
                    minWidth: 0,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {data.agent.name}
                </div>
              </div>

              {(data.agent.phone || data.agent.email) && (
                <div style={{ marginTop: 14.4, display: "flex", flexDirection: "column", gap: 7.2 }}>
                  {data.agent.phone && (
                    <div style={{ display: "flex", alignItems: "center", gap: 7.2, minWidth: 0 }}>
                      <Phone size={18} color={accent} style={{ flexShrink: 0 }} />
                      <span style={{ fontSize: "1.05rem", fontWeight: 700, color: onGlass, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {data.agent.phone}
                      </span>
                    </div>
                  )}
                  {data.agent.email && (
                    <div style={{ display: "flex", alignItems: "center", gap: 7.2, minWidth: 0 }}>
                      <Mail size={18} color={accent} style={{ flexShrink: 0 }} />
                      <span style={{ fontSize: "0.92rem", fontWeight: 500, color: onGlassSoft, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {data.agent.email}
                      </span>
                    </div>
                  )}
                </div>
              )}

              <div style={{ marginTop: 16, paddingTop: 12.8, borderTop: `1px solid ${hairSoft}`, display: "flex", alignItems: "center", gap: 6.4 }}>
                <div style={{ width: 5, height: 5, borderRadius: "50%", backgroundColor: accent }} />
                <span
                  style={{
                    display: "block",
                    fontSize: "0.74rem",
                    fontWeight: 900,
                    color: onGlass,
                    letterSpacing: "0.24em",
                    textTransform: "uppercase",
                  }}
                >
                  fhiglobal.ae
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
})

export default Template9Luxe
