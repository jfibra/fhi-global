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

// ── EDITORIAL ──────────────────────────────────────────────────────────
// A minimalist high-end magazine spread: a colored MAT (bg) frames a light
// editorial SHEET on which the whole story is set in ink (text). `accent`
// is used sparingly — thin hairline rules, small pills, spec icons, the QR
// keyline and the price marker — for understated, Kinfolk-style luxury.
//
// Token map:
//   bg    → the mat / colophon band the sheet is mounted on (readableOn(bg) for it)
//   text  → primary ink on the light SHEET (title / price / labels)
//   accent→ the single "pop": hairlines, eyebrow, icons, price tick, QR frame
//   SHEET → a constant warm-white neutral the template controls (holds `text`)

const W = FLYER_W
const H = FLYER_H

const Template6Editorial = forwardRef<HTMLDivElement, TemplateProps>(function Template6Editorial(
  { data, listingUrl, theme },
  ref,
) {
  const { accent, bg, text, mode } = theme
  const currency = data.currency ?? "AED"

  const SHEET = "#fdfcfa" // warm paper white — the neutral surface for ink text
  const ink = text
  const muted = withAlpha(text, 0.55)
  const faint = withAlpha(text, 0.4)
  const rule = withAlpha(accent, 0.85) // crisp hairline
  const ruleSoft = withAlpha(accent, 0.28) // whisper-thin divider
  const onMat = readableOn(bg) // colophon text sits on the mat
  // The sheet is always a light paper → dark logo. (Both mapped per contract.)
  const logoSrc = readableOn(SHEET) === "#ffffff" ? "/FHI_Branding_White.png" : "/FHI_Branding.png"
  const placeholderBg = shade(SHEET, mode === "dark" ? -0.08 : -0.05)

  const category = (data.category || "For Sale").toUpperCase()
  const agentInitials = getAgentInitials(data.agent.name)
  const image = data.image

  const specs = [
    { value: data.specs.bedrooms, label: "Bedrooms", icon: <Bed size={19} /> },
    { value: data.specs.bathrooms, label: "Bathrooms", icon: <Bath size={19} /> },
    { value: data.specs.garage, label: "Parking", icon: <SquareParking size={19} /> },
    { value: data.specs.lotArea, label: "Lot / sqm", icon: <Scan size={19} /> },
    { value: data.specs.floorArea, label: "Floor / sqm", icon: <Layers2 size={19} /> },
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
        backgroundColor: bg,
        fontFamily: "var(--font-urbanist), var(--font-outfit), sans-serif",
      }}
    >
      {/* ===== SHEET (paper mounted on the mat) ===== */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          margin: "26px 26px 0 26px",
          backgroundColor: SHEET,
          borderRadius: 3,
          boxShadow: `0 6px 30px ${withAlpha("#000000", 0.14)}`,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          position: "relative",
        }}
      >
        {/* inner keyline for a mounted-print feel */}
        <div
          style={{
            position: "absolute",
            top: 14,
            left: 14,
            right: 14,
            bottom: 14,
            border: `1px solid ${ruleSoft}`,
            borderRadius: 1,
            pointerEvents: "none",
          }}
        />

        <div
          style={{
            flex: 1,
            minHeight: 0,
            display: "flex",
            flexDirection: "column",
            paddingLeft: 52,
            paddingRight: 52,
            paddingTop: 40,
            paddingBottom: 40,
            position: "relative",
            zIndex: 1,
          }}
        >
          {/* ── Masthead ── */}
          <div style={{ flexShrink: 0, display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logoSrc} alt="" crossOrigin="anonymous" style={{ height: 30, display: "block" }} />
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 6, height: 6, backgroundColor: accent, flexShrink: 0 }} />
              <span
                style={{
                  display: "block",
                  fontSize: "0.72rem",
                  fontWeight: 700,
                  color: muted,
                  letterSpacing: "0.32em",
                  textTransform: "uppercase",
                  lineHeight: 1.2,
                }}
              >
                {category}
              </span>
            </div>
          </div>

          {/* full-width hairline */}
          <div style={{ flexShrink: 0, height: 1, backgroundColor: rule, marginTop: 18 }} />

          {/* ── Editorial headline ── */}
          <div style={{ flexShrink: 0, marginTop: 26 }}>
            {data.subtype && (
              <span
                style={{
                  display: "block",
                  fontSize: "0.74rem",
                  fontWeight: 800,
                  color: accent,
                  letterSpacing: "0.3em",
                  textTransform: "uppercase",
                  lineHeight: 1.2,
                  marginBottom: 12,
                }}
              >
                {data.subtype}
              </span>
            )}
            <div
              style={{
                fontSize: "2.85rem",
                fontWeight: 300,
                color: ink,
                lineHeight: 1.06,
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
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 12 }}>
              <MapPin size={19} color={accent} style={{ flexShrink: 0 }} />
              <span
                style={{
                  fontSize: "1.02rem",
                  fontWeight: 400,
                  color: muted,
                  letterSpacing: "0.02em",
                  textTransform: "capitalize",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {data.address}
              </span>
            </div>
          </div>

          {/* ── Framed hero (tasteful, not full-bleed) ── */}
          <div
            style={{
              flex: 1,
              minHeight: 0,
              marginTop: 26,
              position: "relative",
              padding: 8,
              border: `1px solid ${ruleSoft}`,
              borderRadius: 2,
            }}
          >
            <div
              style={{
                position: "absolute",
                inset: 0,
                margin: 8,
                overflow: "hidden",
                borderRadius: 1,
                backgroundColor: placeholderBg,
              }}
            >
              {image ? (
                <>
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      backgroundImage: `url("${image}")`,
                      backgroundSize: "cover",
                      backgroundPosition: "center",
                    }}
                  />
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      backgroundColor: withAlpha(text, 0.06),
                      pointerEvents: "none",
                    }}
                  />
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
                  }}
                >
                  <span
                    style={{
                      display: "block",
                      fontSize: "0.8rem",
                      fontWeight: 600,
                      color: faint,
                      letterSpacing: "0.22em",
                      textTransform: "uppercase",
                    }}
                  >
                    Photography on request
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* ── Spec strip ── */}
          {specs.length > 0 && (
            <div
              style={{
                flexShrink: 0,
                marginTop: 24,
                paddingTop: 16,
                paddingBottom: 16,
                borderTop: `1px solid ${ruleSoft}`,
                borderBottom: `1px solid ${ruleSoft}`,
                display: "flex",
              }}
            >
              {specs.map(({ value, label, icon }, i) => (
                <div
                  key={label}
                  style={{
                    flex: "1 1 0",
                    minWidth: 0,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 3,
                    borderLeft: i === 0 ? "none" : `1px solid ${ruleSoft}`,
                  }}
                >
                  <div style={{ color: accent, display: "flex", marginBottom: 2 }}>{icon}</div>
                  <div style={{ fontSize: "1.5rem", fontWeight: 500, color: ink, lineHeight: 1 }}>
                    {Math.round(parseFloat(String(value)))}
                  </div>
                  <span
                    style={{
                      display: "block",
                      fontSize: "0.62rem",
                      fontWeight: 700,
                      color: muted,
                      letterSpacing: "0.16em",
                      textTransform: "uppercase",
                      lineHeight: 1.2,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {label}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* ── Footer of the sheet: price · agent · QR ── */}
          <div
            style={{
              flexShrink: 0,
              marginTop: 26,
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "space-between",
              gap: 24,
            }}
          >
            {/* Price */}
            <div style={{ minWidth: 0, flexShrink: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <div style={{ width: 22, height: 2, backgroundColor: accent, flexShrink: 0 }} />
                <span
                  style={{
                    display: "block",
                    fontSize: "0.68rem",
                    fontWeight: 800,
                    color: accent,
                    letterSpacing: "0.26em",
                    textTransform: "uppercase",
                    lineHeight: 1.2,
                  }}
                >
                  Guide Price
                </span>
              </div>
              <div
                style={{
                  fontSize: "2.3rem",
                  fontWeight: 500,
                  color: ink,
                  lineHeight: 1,
                  letterSpacing: "-0.02em",
                  whiteSpace: "nowrap",
                }}
              >
                {formatPrice(data.price, currency)}
              </div>
            </div>

            {/* Agent */}
            <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 13, justifyContent: "flex-end" }}>
              <div style={{ minWidth: 0, textAlign: "right" }}>
                <span
                  style={{
                    display: "block",
                    fontSize: "0.62rem",
                    fontWeight: 700,
                    color: faint,
                    letterSpacing: "0.22em",
                    textTransform: "uppercase",
                    lineHeight: 1.3,
                    marginBottom: 3,
                  }}
                >
                  Presented By
                </span>
                <div
                  style={{
                    fontSize: "1.12rem",
                    fontWeight: 700,
                    color: ink,
                    lineHeight: 1.15,
                    textTransform: "capitalize",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {data.agent.name}
                </div>
                {data.agent.phone && (
                  <div style={{ display: "flex", alignItems: "center", gap: 5, justifyContent: "flex-end", marginTop: 5 }}>
                    <Phone size={15} color={accent} style={{ flexShrink: 0 }} />
                    <span style={{ fontSize: "0.86rem", fontWeight: 600, color: muted, whiteSpace: "nowrap" }}>
                      {data.agent.phone}
                    </span>
                  </div>
                )}
                {data.agent.email && (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 5,
                      justifyContent: "flex-end",
                      marginTop: 3,
                      minWidth: 0,
                    }}
                  >
                    <Mail size={15} color={accent} style={{ flexShrink: 0 }} />
                    <span
                      style={{
                        fontSize: "0.8rem",
                        fontWeight: 500,
                        color: muted,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {data.agent.email}
                    </span>
                  </div>
                )}
              </div>
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
                  backgroundColor: withAlpha(accent, 0.14),
                  border: `1px solid ${withAlpha(accent, 0.55)}`,
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
                  <span style={{ display: "block", fontSize: "1.15rem", fontWeight: 700, color: accent }}>
                    {agentInitials}
                  </span>
                )}
              </div>
            </div>

            {/* QR — solid white card with an accent keyline (never themed) */}
            <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
              <div
                style={{
                  padding: 8,
                  backgroundColor: "#ffffff",
                  borderRadius: 6,
                  border: `1px solid ${withAlpha(accent, 0.5)}`,
                  boxShadow: `0 4px 16px ${withAlpha("#000000", 0.1)}`,
                }}
              >
                <QRCodeSVG value={listingUrl} size={104} fgColor="#111318" bgColor="#ffffff" level="H" />
              </div>
              <span
                style={{
                  display: "block",
                  fontSize: "0.58rem",
                  fontWeight: 800,
                  color: muted,
                  letterSpacing: "0.2em",
                  textTransform: "uppercase",
                  lineHeight: 1.2,
                }}
              >
                Scan to View
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ===== COLOPHON (on the mat) ===== */}
      <div style={{ flexShrink: 0, height: 46, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span
          style={{
            display: "block",
            fontSize: "0.72rem",
            fontWeight: 700,
            color: onMat,
            letterSpacing: "0.34em",
            textTransform: "uppercase",
            lineHeight: 1.2,
          }}
        >
          fhiglobal.ae — Curated Properties
        </span>
      </div>
    </div>
  )
})

export default Template6Editorial
