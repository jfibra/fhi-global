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

// Faithful Tailwind/inline-styled rebuild of filipinohomes-final's
// Template3Magazine flyer (940×788 Facebook-feed size) — a full-bleed PHOTO
// template. Rendered at natural pixel size so html2canvas can rasterize it
// 1:1; the preview wrapper scales it down with a CSS transform.

const W = FLYER_W
const H = FLYER_H

const Template3Magazine = forwardRef<HTMLDivElement, TemplateProps>(function Template3Magazine(
  { data, listingUrl, theme, logoUrl, logoSize, logoOutline },
  ref,
) {
  const { accent, bg } = theme
  const currency = data.currency ?? "AED"

  // Derived, theme-aware shades. This is a full-bleed PHOTO template, so all
  // headline/body copy sits over the photo and stays #fff + textShadow for
  // legibility. `accent` drives every color "pop" (category pill, price tag,
  // icons, labels, avatar ring). `bg` tints the near-black letterbox base +
  // the photo scrims.
  const onAccent = readableOn(accent)
  const scrim = shade(bg, -0.55) // very dark, faintly bg-tinted → photo overlays
  const placeholderBg = shade(bg, 0.06) // slightly lifted base for the null-photo case
  // Logo sits on the dark top gradient over the photo → white logo on dark surface.
  const logoSrc = logoUrl ?? (readableOn(scrim) === "#ffffff" ? "/FHI_Branding_White.png" : "/FHI_Branding.png")

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
        fontFamily: "var(--font-urbanist), var(--font-outfit), system-ui, sans-serif",
        position: "relative",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* FULL-BLEED HERO */}
      {image ? (
        <>
          {/* Overscan 2px past every edge so html2canvas's 2× subpixel rounding
              can't leave a hairline gap that reveals the near-black root bg. */}
          <div
            style={{
              position: "absolute",
              top: -2,
              left: -2,
              right: -2,
              bottom: -2,
              backgroundImage: `url("${image}")`,
              backgroundSize: "cover",
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
        <div style={{ position: "absolute", inset: 0, backgroundColor: placeholderBg }} />
      )}

      {/* Top gradient for header legibility */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 260,
          background: `linear-gradient(180deg, ${withAlpha(scrim, 0.82)} 0%, transparent 100%)`,
        }}
      />
      {/* Bottom gradient for content legibility */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: "72%",
          background: `linear-gradient(180deg, transparent 0%, ${withAlpha(scrim, 0.6)} 32%, ${withAlpha(scrim, 0.96)} 72%)`,
        }}
      />

      {/* HEADER — logo + category (left), QR (top-right) */}
      <div
        style={{
          position: "relative",
          zIndex: 2,
          paddingLeft: 48,
          paddingRight: 48,
          paddingTop: 32,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          flexShrink: 0,
        }}
      >
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <FlyerLogo src={logoSrc} height={56} size={logoSize} outline={logoOutline} />
          {/* Category pill — accent bg with a dot + label in a two-child flex row. */}
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 7.2,
              marginTop: 20,
              paddingLeft: 16,
              paddingRight: 16,
              paddingTop: 7.2,
              paddingBottom: 7.2,
              borderRadius: 999,
              backgroundColor: accent,
              boxShadow: `0 6px 16px ${withAlpha(accent, 0.45)}`,
            }}
          >
            <div style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: onAccent, flexShrink: 0 }} />
            <span
              style={{
                display: "block",
                color: onAccent,
                fontSize: 14.4,
                fontWeight: 900,
                letterSpacing: "0.16em",
                textTransform: "uppercase",
                lineHeight: 1.3,
                whiteSpace: "nowrap",
              }}
            >
              {category}
            </span>
          </div>
        </div>

        {/* QR — top right, larger. White card, never themed; dark fg for scannability. */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6.8 }}>
          <div style={{ padding: 10, borderRadius: 14, backgroundColor: "#fff", boxShadow: "0 12px 30px rgba(0,0,0,0.5)" }}>
            <QRCodeSVG value={listingUrl} size={132} fgColor="#111318" level="H" />
          </div>
          <span
            style={{
              fontSize: "0.68rem",
              fontWeight: 800,
              color: "#fff",
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              textShadow: "0 2px 8px rgba(0,0,0,0.6)",
            }}
          >
            Scan to View
          </span>
        </div>
      </div>

      {/* BOTTOM CONTENT BLOCK */}
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, zIndex: 2, paddingLeft: 48, paddingRight: 48, paddingBottom: 32 }}>
        {data.subtype && (
          <div
            style={{
              color: accent,
              fontSize: "0.95rem",
              fontWeight: 800,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              marginBottom: 8,
              textShadow: "0 2px 8px rgba(0,0,0,0.6)",
            }}
          >
            {data.subtype}
          </div>
        )}

        <div
          style={{
            color: "#fff",
            fontSize: "3rem",
            fontWeight: 900,
            lineHeight: 1.05,
            textTransform: "capitalize",
            letterSpacing: "-0.02em",
            marginBottom: 12,
            textShadow: "0 4px 16px rgba(0,0,0,0.5)",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
            maxHeight: "2.15em",
          }}
        >
          {data.title}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 6.4, marginBottom: 20 }}>
          <MapPin size={24} color={accent} style={{ flexShrink: 0 }} />
          <span
            style={{
              color: "rgba(255,255,255,0.9)",
              fontSize: "1.15rem",
              fontWeight: 500,
              textTransform: "capitalize",
              textShadow: "0 2px 8px rgba(0,0,0,0.5)",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {data.address}
          </span>
        </div>

        {/* Price + specs row */}
        <div style={{ display: "flex", alignItems: "flex-end", flexWrap: "wrap", gap: 16, marginBottom: 20 }}>
          <div style={{ backgroundColor: accent, color: onAccent, paddingLeft: 24, paddingRight: 24, paddingTop: 12, paddingBottom: 12, borderRadius: 14, boxShadow: "0 12px 30px rgba(0,0,0,0.5)" }}>
            <div style={{ fontSize: "0.78rem", fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", opacity: 0.95, lineHeight: 1.1 }}>Price</div>
            <div style={{ fontSize: "2.3rem", fontWeight: 900, lineHeight: 1.1, marginTop: 2.4, letterSpacing: "-0.02em" }}>{formatPrice(data.price, currency)}</div>
          </div>
          {specs.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, flex: 1, minWidth: 0 }}>
              {specs.map(({ value, label, icon }) => (
                <div
                  key={label}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6.4,
                    backgroundColor: "rgba(255,255,255,0.12)",
                    border: "1px solid rgba(255,255,255,0.2)",
                    paddingLeft: 12,
                    paddingRight: 12,
                    paddingTop: 8,
                    paddingBottom: 8,
                    borderRadius: 12,
                  }}
                >
                  <div style={{ color: accent, display: "flex" }}>{icon}</div>
                  <div style={{ fontSize: "1.05rem", fontWeight: 800, color: "#fff" }}>{Math.round(parseFloat(String(value)))}</div>
                  <div style={{ fontSize: "0.78rem", fontWeight: 600, color: "rgba(255,255,255,0.75)", textTransform: "uppercase", letterSpacing: "0.05em", whiteSpace: "nowrap" }}>{label}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Agent — name & contact stacked vertically */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 24,
            padding: 16,
            borderRadius: 18,
            backgroundColor: "rgba(255,255,255,0.08)",
            border: "1px solid rgba(255,255,255,0.14)",
          }}
        >
          {/* Left: avatar + name */}
          <div style={{ display: "flex", alignItems: "center", gap: 20, minWidth: 0 }}>
            <div
              style={{
                width: 78,
                height: 78,
                borderRadius: "50%",
                overflow: "hidden",
                backgroundColor: withAlpha(accent, 0.4),
                flexShrink: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: `3px solid ${accent}`,
              }}
            >
              {data.agent.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={data.agent.imageUrl} alt="" crossOrigin="anonymous" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                <span style={{ fontSize: "1.5rem", fontWeight: 800, color: "#fff" }}>{agentInitials}</span>
              )}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: "0.72rem", fontWeight: 700, color: accent, textTransform: "uppercase", letterSpacing: "0.18em", lineHeight: 1.1 }}>
                Your Agent
              </div>
              <div style={{ fontSize: "1.65rem", fontWeight: 800, color: "#fff", marginTop: 4.8, textTransform: "capitalize", lineHeight: 1.15, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {data.agent.name}
              </div>
            </div>
          </div>

          {/* Right: contact details */}
          {(data.agent.phone || data.agent.email) && (
            <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", gap: 5.6, maxWidth: 400 }}>
              {data.agent.phone && (
                <div style={{ display: "flex", alignItems: "center", gap: 6.8 }}>
                  <Phone size={21} color={accent} style={{ flexShrink: 0 }} />
                  <span style={{ fontSize: "1.28rem", fontWeight: 700, color: "#fff", letterSpacing: "0.01em" }}>{data.agent.phone}</span>
                </div>
              )}
              {data.agent.email && (
                <div style={{ display: "flex", alignItems: "center", gap: 6.8, minWidth: 0 }}>
                  <Mail size={21} color={accent} style={{ flexShrink: 0 }} />
                  <span style={{ fontSize: "1.08rem", fontWeight: 500, color: "rgba(255,255,255,0.9)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{data.agent.email}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
})

export default Template3Magazine
