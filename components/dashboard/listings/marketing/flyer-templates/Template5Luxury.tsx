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

// Faithful inline-styled rebuild of filipinohomes-final's Template5Luxury
// flyer (940×788 Facebook-feed size). Rendered at natural pixel size so
// html2canvas can rasterize it 1:1; the preview wrapper scales it down with a
// CSS transform (which html2canvas ignores).

const W = FLYER_W
const H = FLYER_H
const HERO_H = 430

const Template5Luxury = forwardRef<HTMLDivElement, TemplateProps>(function Template5Luxury(
  { data, listingUrl, theme },
  ref,
) {
  const { accent, bg, mode } = theme
  const currency = data.currency ?? "AED"

  // Derived palette — everything keys off the three theme tokens.
  const onBg = readableOn(bg) // heading/text on dark signature surface
  const accentLight = shade(accent, 0.32) // brighter accent for the price + QR frame sheen
  const panel = shade(bg, 0.07) // slightly-raised secondary panel
  const scrimBase = mode === "dark" ? bg : shade(bg, -0.82) // keep photo scrims dark for legibility in any mode
  const logoSrc = readableOn(scrimBase) === "#ffffff" ? "/FHI_Branding_White.png" : "/FHI_Branding.png"
  const qrFg = onBg === "#ffffff" ? bg : "#141821"

  const category = (data.category || "FOR SALE").toUpperCase()
  const agentInitials = getAgentInitials(data.agent.name)
  const image = data.image

  const specs = [
    { value: data.specs.bedrooms, label: "Beds", icon: <Bed size={20} /> },
    { value: data.specs.bathrooms, label: "Baths", icon: <Bath size={20} /> },
    { value: data.specs.garage, label: "Parking", icon: <SquareParking size={20} /> },
    { value: data.specs.lotArea, label: "Lot sqm", icon: <Scan size={20} /> },
    { value: data.specs.floorArea, label: "Floor sqm", icon: <Layers2 size={20} /> },
  ].filter(({ value }) => parseFloat(String(value ?? "")) > 0)

  return (
    <div
      ref={ref}
      style={{
        width: W,
        height: H,
        backgroundColor: bg,
        overflow: "hidden",
        fontFamily: "var(--font-urbanist), var(--font-outfit), sans-serif",
        position: "relative",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* ===== HERO (whole photo) ===== */}
      <div style={{ flexShrink: 0, height: HERO_H, position: "relative" }}>
        {/* Whole photo: ambient cover backdrop + darken overlay + uncropped contain */}
        <div style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden", backgroundColor: bg }}>
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
              <div style={{ position: "absolute", inset: 0, backgroundColor: withAlpha(scrimBase, 0.66) }} />
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
              <span style={{ color: "#5b6472", fontSize: "1.1rem", fontWeight: 600 }}>No Image</span>
            </div>
          )}
        </div>

        {/* top + bottom scrims */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: `linear-gradient(180deg, ${withAlpha(scrimBase, 0.65)} 0%, ${withAlpha(scrimBase, 0)} 24%, ${withAlpha(scrimBase, 0)} 52%, ${withAlpha(scrimBase, 0.9)} 100%)`,
            pointerEvents: "none",
          }}
        />
        {/* gold baseline */}
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            height: 3,
            background: `linear-gradient(90deg, transparent, ${accent}, transparent)`,
          }}
        />

        {/* Logo + Exclusive/category — masthead lockup at hero top-left */}
        <div style={{ position: "absolute", top: 32, left: 40, zIndex: 2 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logoSrc} alt="" crossOrigin="anonymous" style={{ height: 50, display: "block" }} />
          <div style={{ marginTop: 16 }}>
            <div
              style={{
                fontSize: "0.72rem",
                fontWeight: 600,
                color: accent,
                letterSpacing: "0.32em",
                textTransform: "uppercase",
                lineHeight: 1.1,
                fontStyle: "italic",
              }}
            >
              Exclusive
            </div>
            <div style={{ marginTop: 4.8 }}>
              <span
                style={{
                  display: "block",
                  color: "#fff",
                  fontSize: "17.6px",
                  fontWeight: 900,
                  letterSpacing: "0.2em",
                  textTransform: "uppercase",
                  lineHeight: 1.3,
                  whiteSpace: "nowrap",
                  textShadow: "0 2px 10px rgba(0,0,0,0.5)",
                }}
              >
                {category}
              </span>
            </div>
          </div>
        </div>

        {/* QR — hero top-right (gold-gradient frame + solid white card) */}
        <div
          style={{
            position: "absolute",
            top: 30,
            right: 40,
            zIndex: 2,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 6.8,
          }}
        >
          <div
            style={{
              padding: 4,
              borderRadius: "8px",
              background: `linear-gradient(135deg, ${accent}, ${accentLight})`,
              boxShadow: "0 12px 30px rgba(0,0,0,0.5)",
            }}
          >
            <div style={{ padding: 8, backgroundColor: "#fff", borderRadius: "6px" }}>
              <QRCodeSVG value={listingUrl} size={132} fgColor={qrFg} level="H" />
            </div>
          </div>
          <span
            style={{
              fontSize: "0.66rem",
              fontWeight: 800,
              color: accent,
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              textShadow: "0 2px 8px rgba(0,0,0,0.6)",
            }}
          >
            Scan to View
          </span>
        </div>

        {/* Subtype */}
        {data.subtype && (
          <div
            style={{
              position: "absolute",
              bottom: 34,
              right: 40,
              zIndex: 2,
              paddingLeft: 18,
              paddingRight: 18,
              paddingTop: 7.2,
              paddingBottom: 7.2,
              backgroundColor: withAlpha(scrimBase, 0.85),
              border: `1px solid ${accent}`,
            }}
          >
            <span
              style={{
                fontSize: "0.9rem",
                fontWeight: 700,
                color: accent,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                maxWidth: 280,
                display: "block",
              }}
            >
              {data.subtype}
            </span>
          </div>
        )}

        {/* Price */}
        <div style={{ position: "absolute", bottom: 30, left: 40, zIndex: 2 }}>
          <div
            style={{
              fontSize: "0.72rem",
              fontWeight: 700,
              color: accent,
              textTransform: "uppercase",
              letterSpacing: "0.28em",
              lineHeight: 1.1,
              marginBottom: 5.6,
            }}
          >
            Listed At
          </div>
          <div
            style={{
              fontSize: "3rem",
              fontWeight: 900,
              color: accentLight,
              lineHeight: 1,
              letterSpacing: "-0.02em",
              textShadow: "0 3px 16px rgba(0,0,0,0.55)",
            }}
          >
            {formatPrice(data.price, currency)}
          </div>
        </div>
      </div>

      {/* ===== CONTENT ===== */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
          paddingLeft: 40,
          paddingRight: 40,
          paddingTop: 24,
          paddingBottom: 24,
        }}
      >
        {/* Decorative divider */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16, flexShrink: 0 }}>
          <div style={{ flex: 1, height: 1, backgroundColor: withAlpha(accent, 0.4) }} />
          <div style={{ width: 7, height: 7, borderRadius: "50%", backgroundColor: accent }} />
          <div style={{ flex: 1, height: 1, backgroundColor: withAlpha(accent, 0.4) }} />
        </div>

        {/* Title + address */}
        <div style={{ flexShrink: 0 }}>
          <div
            style={{
              fontSize: "2.05rem",
              fontWeight: 900,
              color: onBg,
              lineHeight: 1.08,
              textTransform: "capitalize",
              letterSpacing: "-0.01em",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
              maxHeight: "2.2em",
            }}
          >
            {data.title}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 4.8, marginTop: 6 }}>
            <MapPin size={20} color={accent} style={{ flexShrink: 0 }} />
            <span
              style={{
                fontSize: "1.05rem",
                color: withAlpha(onBg, 0.8),
                fontWeight: 500,
                textTransform: "capitalize",
                letterSpacing: "0.03em",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {data.address}
            </span>
          </div>
        </div>

        {/* Specs */}
        {specs.length > 0 && (
          <div style={{ marginTop: 16, display: "flex", flexWrap: "wrap", gap: 8, flexShrink: 0 }}>
            {specs.map(({ value, label, icon }) => (
              <div
                key={label}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6.4,
                  backgroundColor: panel,
                  border: `1px solid ${withAlpha(accent, 0.3)}`,
                  paddingLeft: 12,
                  paddingRight: 12,
                  paddingTop: 7.2,
                  paddingBottom: 7.2,
                  borderRadius: "999px",
                }}
              >
                <div style={{ color: accent, display: "flex" }}>{icon}</div>
                <span style={{ fontSize: "1.05rem", fontWeight: 800, color: onBg, lineHeight: 1 }}>
                  {Math.round(parseFloat(String(value)))}
                </span>
                <span
                  style={{
                    fontSize: "0.72rem",
                    fontWeight: 600,
                    color: withAlpha(onBg, 0.7),
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    whiteSpace: "nowrap",
                  }}
                >
                  {label}
                </span>
              </div>
            ))}
          </div>
        )}

        <div style={{ flex: 1, minHeight: 14 }} />

        {/* Agent — name left / contact right (QR moved to hero top-right) */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 20,
            padding: 16,
            backgroundColor: panel,
            border: `1px solid ${withAlpha(accent, 0.3)}`,
            borderRadius: "6px",
            position: "relative",
            flexShrink: 0,
          }}
        >
          <div
            style={{
              position: "absolute",
              top: -2,
              left: -2,
              width: 18,
              height: 18,
              borderTop: `2px solid ${accent}`,
              borderLeft: `2px solid ${accent}`,
            }}
          />
          <div
            style={{
              position: "absolute",
              bottom: -2,
              right: -2,
              width: 18,
              height: 18,
              borderBottom: `2px solid ${accent}`,
              borderRight: `2px solid ${accent}`,
            }}
          />

          {/* Left: avatar + name */}
          <div style={{ display: "flex", alignItems: "center", gap: 16, minWidth: 0 }}>
            <div
              style={{
                width: 70,
                height: 70,
                borderRadius: "50%",
                overflow: "hidden",
                backgroundColor: withAlpha(accent, 0.2),
                flexShrink: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
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
                <span style={{ display: "block", fontSize: "1.4rem", fontWeight: 800, color: accent }}>
                  {agentInitials}
                </span>
              )}
            </div>
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontSize: "0.68rem",
                  fontWeight: 700,
                  color: accent,
                  textTransform: "uppercase",
                  letterSpacing: "0.2em",
                  lineHeight: 1.1,
                  fontStyle: "italic",
                }}
              >
                Private Consultant
              </div>
              <div
                style={{
                  fontSize: "1.35rem",
                  fontWeight: 800,
                  color: onBg,
                  marginTop: 3.2,
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

          {/* Right: contact details stacked */}
          {(data.agent.phone || data.agent.email) && (
            <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", gap: 5.6, maxWidth: 400 }}>
              {data.agent.phone && (
                <div style={{ display: "flex", alignItems: "center", gap: 6.8, minWidth: 0 }}>
                  <Phone size={19} color={accent} style={{ flexShrink: 0 }} />
                  <span
                    style={{
                      fontSize: "1.2rem",
                      fontWeight: 700,
                      color: onBg,
                      letterSpacing: "0.01em",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {data.agent.phone}
                  </span>
                </div>
              )}
              {data.agent.email && (
                <div style={{ display: "flex", alignItems: "center", gap: 6.8, minWidth: 0 }}>
                  <Mail size={19} color={accent} style={{ flexShrink: 0 }} />
                  <span
                    style={{
                      fontSize: "1.02rem",
                      fontWeight: 500,
                      color: withAlpha(onBg, 0.85),
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
          )}
        </div>

        {/* Footer */}
        <div style={{ textAlign: "center", marginTop: 14, flexShrink: 0 }}>
          <div
            style={{
              color: accent,
              fontSize: "0.85rem",
              fontWeight: 900,
              letterSpacing: "0.3em",
              textTransform: "uppercase",
            }}
          >
            fhiglobal.ae
          </div>
          <div
            style={{
              color: withAlpha(onBg, 0.5),
              fontSize: "0.7rem",
              fontWeight: 500,
              letterSpacing: "0.12em",
              marginTop: 2.4,
              fontStyle: "italic",
            }}
          >
            Distinguished Properties in the Philippines
          </div>
        </div>
      </div>
    </div>
  )
})

export default Template5Luxury
