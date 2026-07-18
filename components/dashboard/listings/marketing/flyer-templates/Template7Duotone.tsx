"use client"

import { forwardRef } from "react"
import { QRCodeSVG } from "qrcode.react"
import { MapPin, Phone, Mail, Bed, Bath, SquareParking, Scan, Layers2 } from "lucide-react"
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

// Faithful inline-styled rebuild of filipinohomes-final's Template7Duotone
// flyer (940×788 Facebook-feed size). Bold duotone gradient poster: a
// full-bleed uncropped photo under accent→bg diagonal tints, with headline,
// price tag, and a solid theme agent bar.

const W = FLYER_W
const H = FLYER_H
const QR_SIZE = 126

const Template7Duotone = forwardRef<HTMLDivElement, TemplateProps>(function Template7Duotone(
  { data, listingUrl, theme },
  ref,
) {
  const { accent, bg, text, mode } = theme
  const currency = data.currency ?? "AED"

  const category = (data.category || "For Sale").toUpperCase()
  const agentInitials = getAgentInitials(data.agent.name)
  const photo = data.image

  // Derived tokens — every shade comes from the resolved theme.
  const onAccent = readableOn(accent)
  const onBg = readableOn(bg)
  // A guaranteed-dark ink for the photo scrims so #fff text stays legible even
  // when the theme bg is a light surface. If bg is already dark, reuse it.
  const inkScrim = onBg === "#ffffff" ? bg : shade(bg, -0.85)
  // White FH logo sits over a dark bottom scrim → always the white mark.
  const logoSrc = "/FHI_Branding_White.png"
  const accentTop = shade(accent, mode === "dark" ? 0.08 : -0.04)
  const placeholderBg = shade(bg, mode === "dark" ? -0.18 : -0.4)

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
        backgroundColor: inkScrim,
        fontFamily: "var(--font-urbanist), var(--font-outfit), sans-serif",
      }}
    >
      {/* ===== FULL-BLEED PHOTO (whole photo, never cropped) ===== */}
      <div style={{ position: "absolute", top: -2, left: -2, right: -2, bottom: -2 }}>
        <div style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden", backgroundColor: placeholderBg }}>
          {photo ? (
            <>
              {/* Ambient backdrop — cover + darken, fills the frame */}
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  backgroundImage: `url("${photo}")`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }}
              />
              <div style={{ position: "absolute", inset: 0, backgroundColor: withAlpha(inkScrim, 0.4) }} />
              {/* The whole photo — uncropped */}
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  backgroundImage: `url("${photo}")`,
                  backgroundSize: "contain",
                  backgroundPosition: "center",
                  backgroundRepeat: "no-repeat",
                }}
              />
              {/* Preload so html2canvas has the bitmap ready */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo}
                alt=""
                aria-hidden
                crossOrigin="anonymous"
                style={{ position: "absolute", width: 1, height: 1, opacity: 0, pointerEvents: "none" }}
              />
            </>
          ) : (
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "#e5e7eb",
              }}
            >
              <span style={{ color: "#6b7280", fontSize: "1.1rem", fontWeight: 600 }}>No Image</span>
            </div>
          )}
        </div>
      </div>

      {/* ===== DUOTONE WASH (accent → bg diagonal tint, faked, no blur) ===== */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `linear-gradient(135deg, ${withAlpha(accentTop, 0.66)} 0%, ${withAlpha(
            shade(accent, -0.4),
            0.4,
          )} 44%, ${withAlpha(shade(bg, -0.1), 0.9)} 100%)`,
          pointerEvents: "none",
        }}
      />
      {/* Accent color-grade lift on the highlights */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `linear-gradient(315deg, ${withAlpha(accent, 0.28)} 0%, ${withAlpha(accent, 0)} 45%)`,
          pointerEvents: "none",
        }}
      />
      {/* Top scrim for masthead legibility */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 220,
          background: `linear-gradient(180deg, ${withAlpha(inkScrim, 0.82)} 0%, ${withAlpha(inkScrim, 0)} 100%)`,
          pointerEvents: "none",
        }}
      />
      {/* Bottom scrim anchoring the headline / price block */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          height: 520,
          background: `linear-gradient(0deg, ${inkScrim} 0%, ${withAlpha(inkScrim, 0.94)} 30%, ${withAlpha(
            inkScrim,
            0.55,
          )} 62%, ${withAlpha(inkScrim, 0)} 100%)`,
          pointerEvents: "none",
        }}
      />

      {/* ===== CONTENT LAYER ===== */}
      <div style={{ position: "relative", zIndex: 2, height: "100%", display: "flex", flexDirection: "column" }}>
        {/* --- MASTHEAD --- */}
        <div
          style={{
            flexShrink: 0,
            paddingLeft: 48,
            paddingRight: 48,
            paddingTop: 40,
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
          }}
        >
          <div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logoSrc} alt="" crossOrigin="anonymous" style={{ height: 46, display: "block" }} />
            <div
              style={{
                marginTop: 16,
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                height: 8,
              }}
            >
              <div style={{ width: 46, height: 4, borderRadius: 2, backgroundColor: accent }} />
              <div style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: accent }} />
            </div>
          </div>

          {/* QR — solid white card, never themed */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 7.2 }}>
            <div
              style={{
                padding: 8,
                backgroundColor: "#ffffff",
                borderRadius: 14,
                boxShadow: `0 16px 40px ${withAlpha(inkScrim, 0.55)}`,
                border: `3px solid ${accent}`,
              }}
            >
              <QRCodeSVG value={listingUrl} size={QR_SIZE} fgColor="#111318" level="H" />
            </div>
            <span
              style={{
                display: "block",
                fontSize: "0.68rem",
                fontWeight: 900,
                color: "#ffffff",
                letterSpacing: "0.24em",
                textTransform: "uppercase",
                lineHeight: 1.2,
                textShadow: `0 2px 10px ${withAlpha(inkScrim, 0.8)}`,
              }}
            >
              Scan to View
            </span>
          </div>
        </div>

        {/* --- FLEXIBLE PHOTO SPACE --- */}
        <div style={{ flex: 1, minHeight: 0 }} />

        {/* --- HEADLINE / PRICE BLOCK --- */}
        <div style={{ flexShrink: 0, paddingLeft: 48, paddingRight: 48, paddingBottom: 16 }}>
          {/* Eyebrow pills */}
          <div style={{ display: "flex", alignItems: "center", gap: 9.6, flexWrap: "wrap", marginBottom: 12.8 }}>
            <div
              style={{
                paddingLeft: 14.4,
                paddingRight: 14.4,
                paddingTop: 5.6,
                paddingBottom: 5.6,
                borderRadius: 8,
                backgroundColor: accent,
                boxShadow: `0 8px 22px ${withAlpha(accent, 0.5)}`,
              }}
            >
              <span
                style={{
                  display: "block",
                  fontSize: "0.82rem",
                  fontWeight: 900,
                  color: onAccent,
                  letterSpacing: "0.2em",
                  textTransform: "uppercase",
                  lineHeight: 1.2,
                }}
              >
                {category}
              </span>
            </div>
            {data.subtype && (
              <div
                style={{
                  paddingLeft: 14.4,
                  paddingRight: 14.4,
                  paddingTop: 5.6,
                  paddingBottom: 5.6,
                  borderRadius: 8,
                  backgroundColor: withAlpha(inkScrim, 0.5),
                  border: `1.5px solid ${withAlpha("#ffffff", 0.35)}`,
                  maxWidth: 420,
                }}
              >
                <span
                  style={{
                    display: "block",
                    fontSize: "0.82rem",
                    fontWeight: 800,
                    color: "#ffffff",
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                    lineHeight: 1.2,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {data.subtype}
                </span>
              </div>
            )}
          </div>

          {/* Huge condensed headline */}
          <div
            style={{
              fontSize: "3.7rem",
              fontWeight: 900,
              color: "#ffffff",
              lineHeight: 1.06,
              textTransform: "uppercase",
              letterSpacing: "-0.02em",
              textShadow: `0 6px 30px ${withAlpha(inkScrim, 0.85)}`,
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
          <div style={{ display: "flex", alignItems: "center", gap: 5.6, marginTop: 9.6 }}>
            <MapPin size={22} color={accent} style={{ flexShrink: 0 }} />
            <div
              style={{
                fontSize: "1.1rem",
                fontWeight: 600,
                color: withAlpha("#ffffff", 0.92),
                textTransform: "capitalize",
                letterSpacing: "0.02em",
                textShadow: `0 2px 10px ${withAlpha(inkScrim, 0.7)}`,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {data.address}
            </div>
          </div>

          {/* Specs + Price */}
          <div
            style={{
              marginTop: 19.2,
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "space-between",
              gap: 16,
            }}
          >
            {specs.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, minWidth: 0 }}>
                {specs.map(({ value, label, icon }) => (
                  <div
                    key={label}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6.4,
                      paddingLeft: 11.2,
                      paddingRight: 11.2,
                      paddingTop: 6.8,
                      paddingBottom: 6.8,
                      borderRadius: 10,
                      backgroundColor: withAlpha(inkScrim, 0.55),
                      border: `1.5px solid ${withAlpha(accent, 0.55)}`,
                    }}
                  >
                    <div style={{ color: accent, display: "flex" }}>{icon}</div>
                    <div style={{ fontSize: "1.05rem", fontWeight: 900, color: "#ffffff", lineHeight: 1 }}>
                      {Math.round(parseFloat(String(value)))}
                    </div>
                    <div
                      style={{
                        fontSize: "0.64rem",
                        fontWeight: 700,
                        color: withAlpha("#ffffff", 0.75),
                        textTransform: "uppercase",
                        letterSpacing: "0.06em",
                        lineHeight: 1.2,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {label}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Oversized price tag on accent */}
            <div
              style={{
                flexShrink: 0,
                paddingLeft: 20.8,
                paddingRight: 20.8,
                paddingTop: 8.8,
                paddingBottom: 8.8,
                borderRadius: 14,
                backgroundColor: accent,
                boxShadow: `0 14px 38px ${withAlpha(accent, 0.5)}`,
              }}
            >
              <span
                style={{
                  display: "block",
                  fontSize: "0.68rem",
                  fontWeight: 800,
                  color: withAlpha(onAccent, 0.85),
                  textTransform: "uppercase",
                  letterSpacing: "0.28em",
                  lineHeight: 1.2,
                  marginBottom: 2.4,
                }}
              >
                Price
              </span>
              <span
                style={{
                  display: "block",
                  fontSize: "2.7rem",
                  fontWeight: 900,
                  color: onAccent,
                  lineHeight: 1,
                  letterSpacing: "-0.02em",
                }}
              >
                {formatPrice(data.price, currency)}
              </span>
            </div>
          </div>
        </div>

        {/* --- AGENT BAR (solid theme surface) --- */}
        <div
          style={{
            flexShrink: 0,
            backgroundColor: bg,
            borderTop: `4px solid ${accent}`,
            paddingLeft: 48,
            paddingRight: 48,
            paddingTop: 17.6,
            paddingBottom: 17.6,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 20,
          }}
        >
          {/* Agent identity */}
          <div style={{ display: "flex", alignItems: "center", gap: 16, minWidth: 0 }}>
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
                backgroundColor: withAlpha(accent, 0.2),
                border: `3px solid ${accent}`,
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
                <div style={{ fontSize: "1.3rem", fontWeight: 900, color: accent }}>{agentInitials}</div>
              )}
            </div>
            <div style={{ minWidth: 0 }}>
              <span
                style={{
                  display: "block",
                  fontSize: "0.66rem",
                  fontWeight: 900,
                  color: accent,
                  textTransform: "uppercase",
                  letterSpacing: "0.22em",
                  lineHeight: 1.2,
                }}
              >
                Listed By
              </span>
              <div
                style={{
                  fontSize: "1.3rem",
                  fontWeight: 800,
                  color: onBg,
                  marginTop: 2.8,
                  textTransform: "capitalize",
                  lineHeight: 1.1,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {data.agent.name}
              </div>
            </div>
          </div>

          {/* Contact + brand */}
          <div style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 24 }}>
            {(data.agent.phone || data.agent.email) && (
              <div style={{ display: "flex", flexDirection: "column", gap: 4.8, maxWidth: 340 }}>
                {data.agent.phone && (
                  <div style={{ display: "flex", alignItems: "center", gap: 7.2, minWidth: 0 }}>
                    <Phone size={18} color={accent} style={{ flexShrink: 0 }} />
                    <div
                      style={{
                        fontSize: "1.05rem",
                        fontWeight: 700,
                        color: onBg,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {data.agent.phone}
                    </div>
                  </div>
                )}
                {data.agent.email && (
                  <div style={{ display: "flex", alignItems: "center", gap: 7.2, minWidth: 0 }}>
                    <Mail size={18} color={accent} style={{ flexShrink: 0 }} />
                    <div
                      style={{
                        fontSize: "0.92rem",
                        fontWeight: 500,
                        color: withAlpha(onBg, 0.8),
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {data.agent.email}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
              <div style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: accent }} />
              <span
                style={{
                  display: "block",
                  fontSize: "0.82rem",
                  fontWeight: 900,
                  color: onBg,
                  letterSpacing: "0.16em",
                  textTransform: "uppercase",
                  lineHeight: 1.2,
                }}
              >
                fhiglobal.ae
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
})

export default Template7Duotone
