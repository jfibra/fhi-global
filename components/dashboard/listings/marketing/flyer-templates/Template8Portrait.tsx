"use client"

import { forwardRef } from "react"
import FlyerLogo from "./FlyerLogo"
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

// ── Fixed 940×788 poster. Every region is ABSOLUTELY positioned so nothing can
//    overflow, shift, or push another block off-canvas. The agent card is
//    anchored to the bottom of the panel → it is ALWAYS fully visible. The
//    middle content sits in a fixed band and clips gracefully if ever too tall.
//    Faithful inline-styled rebuild of filipinohomes-final's Template8Portrait.
const W = FLYER_W
const H = FLYER_H
const FOOTER_H = 42
const PHOTO_W = 468 // left photo column width
const SEAM_W = 6
const PANEL_L = PHOTO_W + SEAM_W // right panel left edge (474)
const PAD = 32 // right-panel inner padding
const QR_SIZE = 104

const Template8Portrait = forwardRef<HTMLDivElement, TemplateProps>(function Template8Portrait(
  { data, listingUrl, theme, logoUrl, logoSize, logoOutline },
  ref,
) {
  const { accent, bg, text, mode } = theme

  const onAccent = readableOn(accent)
  const onBg = readableOn(bg)
  const heading = mode === "light" ? text : onBg
  const chipBg = shade(bg, mode === "dark" ? 0.1 : -0.06)
  const hair = withAlpha(onBg, 0.16)
  const soft = withAlpha(onBg, 0.62)
  const faint = withAlpha(onBg, 0.42)
  const placeholder = shade(bg, mode === "dark" ? 0.14 : -0.1)
  const logoSrc = logoUrl ?? (onBg === "#ffffff" ? "/FHI_Branding_White.png" : "/FHI_Branding.png")

  const category = (data.category || "For Sale").toUpperCase()
  const agentInitials = getAgentInitials(data.agent.name)
  const image = data.image

  const specs = [
    { value: data.specs.bedrooms, label: "Beds", icon: <Bed size={16} /> },
    { value: data.specs.bathrooms, label: "Baths", icon: <Bath size={16} /> },
    { value: data.specs.garage, label: "Parking", icon: <SquareParking size={16} /> },
    { value: data.specs.lotArea, label: "Lot m²", icon: <Scan size={16} /> },
    { value: data.specs.floorArea, label: "Floor m²", icon: <Layers2 size={16} /> },
  ].filter(({ value }) => parseFloat(String(value ?? "")) > 0)

  return (
    <div
      ref={ref}
      style={{
        width: W,
        height: H,
        position: "relative",
        overflow: "hidden",
        backgroundColor: bg,
        fontFamily: "var(--font-urbanist), var(--font-outfit), sans-serif",
      }}
    >
      {/* ───────── LEFT: photo (whole, never cropped) ───────── */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: PHOTO_W,
          bottom: FOOTER_H,
          overflow: "hidden",
          backgroundColor: placeholder,
        }}
      >
        <div style={{ position: "absolute", top: -2, left: -2, right: -2, bottom: -2 }}>
          {/* WholePhoto — shows the ENTIRE photo (contain) over a darkened cover backdrop */}
          <div style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden", backgroundColor: placeholder }}>
            {image ? (
              <>
                {/* Ambient backdrop — cover + darken, fills the frame */}
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    backgroundImage: `url("${image}")`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                  }}
                />
                <div style={{ position: "absolute", inset: 0, backgroundColor: "rgba(8,12,20,0.5)" }} />
                {/* The whole photo — uncropped */}
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    backgroundImage: `url("${image}")`,
                    backgroundSize: "contain",
                    backgroundPosition: "center",
                    backgroundRepeat: "no-repeat",
                  }}
                />
                {/* Preload so html2canvas has the bitmap ready */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={image}
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
                <span style={{ color: "#64748b", fontSize: "1.1rem", fontWeight: 600 }}>No Image</span>
              </div>
            )}
          </div>
        </div>
        {/* grounding scrims — depth top & bottom */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(180deg, rgba(0,0,0,0.34) 0%, rgba(0,0,0,0) 26%, rgba(0,0,0,0) 60%, rgba(0,0,0,0.42) 100%)",
            pointerEvents: "none",
          }}
        />
        {/* category tab */}
        <div
          style={{
            position: "absolute",
            top: 28,
            left: 28,
            backgroundColor: accent,
            paddingLeft: 15.2,
            paddingRight: 15.2,
            paddingTop: 6.8,
            paddingBottom: 6.8,
            borderRadius: 6,
            boxShadow: "0 8px 22px rgba(0,0,0,0.35)",
          }}
        >
          <span
            style={{
              display: "block",
              fontSize: "0.72rem",
              fontWeight: 900,
              color: onAccent,
              letterSpacing: "0.24em",
              lineHeight: 1.15,
            }}
          >
            {category}
          </span>
        </div>
      </div>

      {/* ───────── SEAM: thin accent line ───────── */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: PHOTO_W,
          width: SEAM_W,
          bottom: FOOTER_H,
          background: `linear-gradient(180deg, ${shade(accent, 0.22)}, ${accent}, ${shade(accent, -0.2)})`,
        }}
      />

      {/* ───────── RIGHT: solid panel ───────── */}
      <div style={{ position: "absolute", top: 0, left: PANEL_L, right: 0, bottom: FOOTER_H, backgroundColor: bg }}>
        {/* Masthead: logo + QR (anchored top) */}
        <div
          style={{
            position: "absolute",
            top: 28,
            left: PAD,
            right: PAD,
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 16,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <FlyerLogo src={logoSrc} height={32} size={logoSize} outline={logoOutline} style={{ marginTop: 4 }} />
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4.8 }}>
            <div style={{ padding: 8, backgroundColor: "#ffffff", borderRadius: 12, boxShadow: "0 10px 26px rgba(0,0,0,0.28)" }}>
              <QRCodeSVG value={listingUrl} size={QR_SIZE} fgColor="#111318" level="H" />
            </div>
            <span
              style={{
                display: "block",
                fontSize: "0.58rem",
                fontWeight: 800,
                color: soft,
                letterSpacing: "0.2em",
                textTransform: "uppercase",
              }}
            >
              Scan to View
            </span>
          </div>
        </div>

        {/* Content band — fixed region between masthead and agent; clips if ever too tall */}
        <div
          style={{
            position: "absolute",
            left: PAD,
            right: PAD,
            top: 188,
            bottom: 208,
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* accent rule */}
          <div style={{ height: 3, width: 54, borderRadius: 3, backgroundColor: accent, flexShrink: 0 }} />

          {data.subtype && (
            <span
              style={{
                display: "block",
                marginTop: 12.8,
                fontSize: "0.74rem",
                fontWeight: 800,
                color: accent,
                letterSpacing: "0.2em",
                textTransform: "uppercase",
                lineHeight: 1.2,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                flexShrink: 0,
              }}
            >
              {data.subtype}
            </span>
          )}

          {/* Title */}
          <div
            style={{
              marginTop: data.subtype ? 6.4 : 12.8,
              fontSize: "1.7rem",
              fontWeight: 900,
              color: heading,
              lineHeight: 1.1,
              letterSpacing: "-0.015em",
              textTransform: "capitalize",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
              maxHeight: "2.25em",
              flexShrink: 0,
            }}
          >
            {data.title}
          </div>

          {/* Address */}
          <div style={{ display: "flex", alignItems: "center", gap: 4.8, marginTop: 8.8, flexShrink: 0 }}>
            <MapPin size={18} color={accent} style={{ flexShrink: 0 }} />
            <div
              style={{
                fontSize: "0.96rem",
                color: soft,
                fontWeight: 500,
                textTransform: "capitalize",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {data.address}
            </div>
          </div>

          {/* Price tag */}
          <div
            style={{
              marginTop: 16,
              display: "inline-block",
              alignSelf: "flex-start",
              backgroundColor: accent,
              borderRadius: 12,
              paddingLeft: 19.2,
              paddingRight: 19.2,
              paddingTop: 8.8,
              paddingBottom: 8.8,
              boxShadow: `0 12px 28px ${withAlpha(accent, 0.35)}`,
              flexShrink: 0,
            }}
          >
            <span
              style={{
                display: "block",
                fontSize: "0.6rem",
                fontWeight: 800,
                color: withAlpha(onAccent, 0.75),
                letterSpacing: "0.26em",
                textTransform: "uppercase",
                lineHeight: 1.2,
              }}
            >
              Offered At
            </span>
            <span
              style={{
                display: "block",
                fontSize: "1.75rem",
                fontWeight: 900,
                color: onAccent,
                lineHeight: 1.1,
                letterSpacing: "-0.02em",
                marginTop: 2.4,
              }}
            >
              {formatPrice(data.price, data.currency ?? "AED")}
            </span>
          </div>

          {/* Specs */}
          {specs.length > 0 && (
            <div style={{ marginTop: 16, display: "flex", flexWrap: "wrap", gap: 7.2, flexShrink: 0 }}>
              {specs.map(({ value, label, icon }) => (
                <div
                  key={label}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 4.8,
                    backgroundColor: chipBg,
                    border: `1px solid ${hair}`,
                    paddingLeft: 9.6,
                    paddingRight: 9.6,
                    paddingTop: 5.6,
                    paddingBottom: 5.6,
                    borderRadius: 9,
                  }}
                >
                  <div style={{ color: accent, display: "flex" }}>{icon}</div>
                  <span style={{ display: "block", fontSize: "0.95rem", fontWeight: 800, color: heading, lineHeight: 1 }}>
                    {Math.round(parseFloat(String(value)))}
                  </span>
                  <span
                    style={{
                      display: "block",
                      fontSize: "0.62rem",
                      fontWeight: 700,
                      color: faint,
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      lineHeight: 1.1,
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

        {/* Agent — ANCHORED to the bottom of the panel → always fully visible */}
        <div style={{ position: "absolute", left: PAD, right: PAD, bottom: 26 }}>
          <div style={{ height: 1, backgroundColor: hair, marginBottom: 14.4 }} />
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                width: 54,
                height: 54,
                borderRadius: "50%",
                overflow: "hidden",
                flexShrink: 0,
                backgroundColor: withAlpha(accent, 0.18),
                border: `2px solid ${accent}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
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
                <span style={{ display: "block", fontSize: "1.15rem", fontWeight: 800, color: heading }}>
                  {agentInitials}
                </span>
              )}
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <span
                style={{
                  display: "block",
                  fontSize: "0.6rem",
                  fontWeight: 800,
                  color: faint,
                  textTransform: "uppercase",
                  letterSpacing: "0.2em",
                  lineHeight: 1.2,
                }}
              >
                Listing Agent
              </span>
              <div
                style={{
                  fontSize: "1.15rem",
                  fontWeight: 800,
                  color: heading,
                  marginTop: 2.4,
                  textTransform: "capitalize",
                  lineHeight: 1.15,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {data.agent.name}
              </div>
            </div>
          </div>

          {(data.agent.phone || data.agent.email) && (
            <div style={{ marginTop: 11.2, display: "flex", flexDirection: "column", gap: 4.8 }}>
              {data.agent.phone && (
                <div style={{ display: "flex", alignItems: "center", gap: 6.8, minWidth: 0 }}>
                  <Phone size={17} color={accent} style={{ flexShrink: 0 }} />
                  <div
                    style={{
                      fontSize: "0.98rem",
                      fontWeight: 700,
                      color: heading,
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
                <div style={{ display: "flex", alignItems: "center", gap: 6.8, minWidth: 0 }}>
                  <Mail size={17} color={accent} style={{ flexShrink: 0 }} />
                  <div
                    style={{
                      fontSize: "0.9rem",
                      fontWeight: 500,
                      color: soft,
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
        </div>
      </div>

      {/* ───────── FOOTER BAR ───────── */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: FOOTER_H,
          backgroundColor: accent,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <span
          style={{
            display: "block",
            fontSize: "0.78rem",
            fontWeight: 900,
            color: onAccent,
            letterSpacing: "0.32em",
            textTransform: "uppercase",
          }}
        >
          fhiglobal.ae
        </span>
      </div>
    </div>
  )
})

export default Template8Portrait
