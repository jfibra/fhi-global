"use client"

import { forwardRef } from "react"
import FlyerLogo from "./FlyerLogo"
import { QRCodeSVG } from "qrcode.react"
import {
  MapPin,
  Phone,
  Mail,
  Home,
  Globe,
  ShieldCheck,
  Building2,
  Maximize2,
  CircleCheck,
  Bed,
  Bath,
  SquareParking,
  Scan,
  Layers2,
} from "lucide-react"
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

// Faithful inline-styled rebuild of filipinohomes-final's Template4Mosaic flyer
// (940×788 Facebook-feed size): navy top bar, hero + 3-photo thumbnail mosaic,
// price/specs row, agent card, feature bar, footer. Rendered at natural pixel
// size so html2canvas can rasterize it 1:1.

const W = FLYER_W
const H = FLYER_H

const Template4Mosaic = forwardRef<HTMLDivElement, TemplateProps>(function Template4Mosaic(
  { data, listingUrl, theme, logoUrl, logoSize, logoOutline },
  ref,
) {
  const { accent, bg, text, mode } = theme
  const currency = data.currency ?? "AED"

  // Derived tokens
  const onBg = readableOn(bg) // text/icons on the dark navy surface (bar / agent card / footer)
  // logo sits on `bg` surfaces
  const logoSrc = logoUrl ?? (onBg === "#ffffff" ? "/FHI_Branding_White.png" : "/FHI_Branding.png")
  const placeholderBg = shade(bg, 0.85) // neutral tint when no photo
  const placeholderInk = readableOn(placeholderBg)
  // QR foreground must stay dark for scannability; reuse bg when it is already dark, else a safe ink.
  const qrFg = onBg === "#ffffff" ? bg : "#141821"
  const bodyText = withAlpha(text, 0.62)
  const hairline = withAlpha(text, 0.12)
  // Photo scrim derived from bg, weighted by mode.
  const scrim =
    mode === "dark"
      ? `linear-gradient(180deg, ${withAlpha(bg, 0.5)} 0%, ${withAlpha(bg, 0)} 24%, ${withAlpha(bg, 0.1)} 50%, ${withAlpha(bg, 0.86)} 100%)`
      : `linear-gradient(180deg, ${withAlpha(shade(bg, -0.5), 0.45)} 0%, ${withAlpha(shade(bg, -0.5), 0)} 24%, ${withAlpha(shade(bg, -0.5), 0.1)} 50%, ${withAlpha(shade(bg, -0.5), 0.82)} 100%)`

  const category = (data.category || "FOR SALE").toUpperCase()
  const agentInitials = getAgentInitials(data.agent.name)

  // Hero = data.image; the 3 mosaic thumbnails = data.gallery[0..2].
  const thumbs = (data.gallery ?? []).slice(0, 3)

  const specs = [
    { value: data.specs.bedrooms, label: "Bedrooms", icon: <Bed size={22} /> },
    { value: data.specs.bathrooms, label: "Bathroom", icon: <Bath size={22} /> },
    { value: data.specs.garage, label: "Parking", icon: <SquareParking size={22} /> },
    { value: data.specs.lotArea, label: "Lot sqm", icon: <Scan size={22} /> },
    { value: data.specs.floorArea, label: "Floor sqm", icon: <Layers2 size={22} /> },
  ].filter(({ value }) => parseFloat(String(value ?? "")) > 0)

  const features = [
    { icon: <ShieldCheck size={22} />, title: "Secure Investment", sub: "Great for living or rental" },
    { icon: <MapPin size={22} />, title: "Prime Location", sub: "Accessible & convenient" },
    { icon: <Maximize2 size={22} />, title: "Spacious Layout", sub: "Well-ventilated & bright" },
    { icon: <CircleCheck size={22} />, title: "Move-in Ready", sub: "Well-maintained unit" },
  ]

  return (
    <div
      ref={ref}
      style={{
        width: W,
        height: H,
        backgroundColor: "#ffffff",
        overflow: "hidden",
        fontFamily: "var(--font-urbanist), var(--font-outfit), system-ui, sans-serif",
        position: "relative",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* ===== TOP BAR ===== */}
      <div
        style={{
          flexShrink: 0,
          height: 68,
          paddingLeft: 40,
          paddingRight: 40,
          backgroundColor: bg,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <FlyerLogo src={logoSrc} height={40} size={logoSize} outline={logoOutline} />
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            paddingLeft: 20,
            paddingRight: 20,
            paddingTop: 8,
            paddingBottom: 8,
            borderRadius: 10,
            border: `1.5px solid ${accent}`,
          }}
        >
          <Home size={20} color={accent} />
          <span
            style={{
              color: accent,
              fontSize: 15.2,
              fontWeight: 900,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              lineHeight: 1.1,
            }}
          >
            {category}
          </span>
        </div>
      </div>

      {/* ===== HERO + THUMBNAIL GALLERY ===== */}
      <div style={{ flexShrink: 0, height: 306, position: "relative", backgroundColor: placeholderBg, overflow: "hidden" }}>
        {data.image ? (
          <>
            <div
              style={{
                position: "absolute",
                top: -2,
                left: -2,
                right: -2,
                bottom: -2,
                backgroundImage: `url("${data.image}")`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }}
            />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={data.image}
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
              backgroundColor: placeholderBg,
            }}
          >
            <span style={{ color: placeholderInk, fontWeight: 600 }}>No Image Available</span>
          </div>
        )}
        <div style={{ position: "absolute", inset: 0, background: scrim, pointerEvents: "none" }} />

        {/* subtype pill */}
        <div
          style={{
            position: "absolute",
            top: 22,
            left: 28,
            display: "flex",
            alignItems: "center",
            gap: 7,
            paddingLeft: 16,
            paddingRight: 16,
            paddingTop: 7,
            paddingBottom: 7,
            borderRadius: 10,
            backgroundColor: withAlpha(bg, 0.82),
          }}
        >
          <Building2 size={18} color={onBg} />
          <span
            style={{
              fontSize: "0.85rem",
              fontWeight: 800,
              color: onBg,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              lineHeight: 1.1,
            }}
          >
            {data.subtype || category}
          </span>
        </div>

        {/* QR — top right */}
        <div
          style={{
            position: "absolute",
            top: 20,
            right: 24,
            zIndex: 2,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 5,
          }}
        >
          <div style={{ padding: 8, borderRadius: 12, backgroundColor: "#fff", boxShadow: "0 10px 26px rgba(0,0,0,0.42)" }}>
            <QRCodeSVG value={listingUrl} size={104} fgColor={qrFg} level="H" />
          </div>
          <span
            style={{
              fontSize: "0.64rem",
              fontWeight: 800,
              color: "#fff",
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              lineHeight: 1.1,
              textShadow: "0 2px 8px rgba(0,0,0,0.6)",
            }}
          >
            Scan to View
          </span>
        </div>

        {/* title + location */}
        <div style={{ position: "absolute", left: 28, bottom: 22, right: 320, zIndex: 2 }}>
          <div
            style={{
              fontSize: "1.85rem",
              fontWeight: 900,
              color: "#fff",
              lineHeight: 1.08,
              textTransform: "capitalize",
              letterSpacing: "-0.015em",
              textShadow: "0 3px 14px rgba(0,0,0,0.55)",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
              maxHeight: "2.3em",
            }}
          >
            {data.title}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 6 }}>
            <MapPin size={20} color={accent} style={{ flexShrink: 0 }} />
            <span
              style={{
                fontSize: "1rem",
                color: "rgba(255,255,255,0.92)",
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
        </div>

        {/* thumbnail gallery */}
        {thumbs.length > 0 && (
          <div style={{ position: "absolute", right: 24, bottom: 20, zIndex: 2, display: "flex", gap: 8 }}>
            {thumbs.map((t, i) => (
              <div
                key={i}
                style={{
                  width: 92,
                  height: 70,
                  borderRadius: 8,
                  overflow: "hidden",
                  border: "2px solid rgba(255,255,255,0.9)",
                  boxShadow: "0 6px 16px rgba(0,0,0,0.4)",
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
      </div>

      {/* ===== BODY (light) ===== */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          paddingLeft: 40,
          paddingRight: 40,
          paddingTop: 20,
          paddingBottom: 20,
          backgroundColor: "#f8f9fb",
        }}
      >
        {/* Price + specs */}
        <div style={{ display: "flex", alignItems: "stretch", gap: 16 }}>
          <div
            style={{
              flexShrink: 0,
              paddingRight: 16,
              borderRight: `1px solid ${hairline}`,
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
            }}
          >
            <div
              style={{
                fontSize: "0.72rem",
                fontWeight: 800,
                color: bodyText,
                textTransform: "uppercase",
                letterSpacing: "0.2em",
                lineHeight: 1.15,
                marginBottom: 4,
              }}
            >
              Price
            </div>
            <div style={{ fontSize: "2.1rem", fontWeight: 900, color: text, lineHeight: 1, letterSpacing: "-0.02em" }}>
              {formatPrice(data.price, currency)}
            </div>
          </div>
          {specs.length > 0 && (
            <div style={{ flex: 1, display: "flex", flexWrap: "nowrap", gap: 8, overflow: "hidden" }}>
              {specs.map(({ value, label, icon }) => (
                <div
                  key={label}
                  style={{
                    flex: "1 1 0",
                    minWidth: 0,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 3,
                    backgroundColor: "#fff",
                    border: `1px solid ${hairline}`,
                    boxShadow: "0 2px 8px rgba(15,23,42,0.04)",
                    paddingTop: 9,
                    paddingBottom: 9,
                    borderRadius: 12,
                  }}
                >
                  <div style={{ color: accent, display: "flex" }}>{icon}</div>
                  <div style={{ fontSize: "1.25rem", fontWeight: 800, color: text, lineHeight: 1 }}>
                    {Math.round(parseFloat(String(value)))}
                  </div>
                  <div
                    style={{
                      fontSize: "0.62rem",
                      fontWeight: 700,
                      color: bodyText,
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {label}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Agent card */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 20,
            padding: 16,
            borderRadius: 16,
            backgroundColor: bg,
            position: "relative",
            overflow: "hidden",
          }}
        >
          <div
            aria-hidden
            style={{
              position: "absolute",
              top: 14,
              left: 14,
              width: 70,
              height: 46,
              backgroundImage: `radial-gradient(circle, ${withAlpha(accent, 0.5)} 1.5px, transparent 1.5px)`,
              backgroundSize: "11px 11px",
            }}
          />
          {/* Left: avatar + name */}
          <div style={{ display: "flex", alignItems: "center", gap: 16, minWidth: 0, position: "relative" }}>
            <div
              style={{
                width: 74,
                height: 74,
                borderRadius: "50%",
                overflow: "hidden",
                flexShrink: 0,
                marginLeft: 8,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: withAlpha(accent, 0.25),
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
                <span style={{ fontSize: "1.5rem", fontWeight: 800, color: accent }}>{agentInitials}</span>
              )}
            </div>
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontSize: "0.75rem",
                  fontWeight: 800,
                  color: accent,
                  textTransform: "uppercase",
                  letterSpacing: "0.18em",
                  lineHeight: 1.1,
                }}
              >
                Get In Touch
              </div>
              <div
                style={{
                  fontSize: "1.6rem",
                  fontWeight: 800,
                  color: onBg,
                  marginTop: 4,
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

          {/* Right: contact details */}
          {(data.agent.phone || data.agent.email) && (
            <div
              style={{
                flexShrink: 0,
                display: "flex",
                flexDirection: "column",
                gap: 5,
                position: "relative",
                maxWidth: 400,
              }}
            >
              {data.agent.phone && (
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <Phone size={19} color={accent} style={{ flexShrink: 0 }} />
                  <span style={{ fontSize: "1.2rem", fontWeight: 700, color: onBg }}>{data.agent.phone}</span>
                </div>
              )}
              {data.agent.email && (
                <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                  <Mail size={19} color={accent} style={{ flexShrink: 0 }} />
                  <span
                    style={{
                      fontSize: "1.05rem",
                      fontWeight: 500,
                      color: withAlpha(onBg, 0.9),
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

        {/* Feature bar */}
        <div style={{ display: "flex", gap: 12, paddingTop: 4 }}>
          {features.map((f) => (
            <div key={f.title} style={{ flex: "1 1 0", minWidth: 0, display: "flex", alignItems: "center", gap: 8 }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: "50%",
                  flexShrink: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: withAlpha(accent, 0.12),
                  color: accent,
                }}
              >
                {f.icon}
              </div>
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontSize: "0.86rem",
                    fontWeight: 800,
                    color: text,
                    lineHeight: 1.15,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {f.title}
                </div>
                <div
                  style={{
                    fontSize: "0.68rem",
                    fontWeight: 500,
                    color: bodyText,
                    lineHeight: 1.2,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {f.sub}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ===== FOOTER ===== */}
      <div
        style={{
          flexShrink: 0,
          height: 46,
          backgroundColor: bg,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
        }}
      >
        <Globe size={18} color={accent} />
        <span
          style={{
            color: onBg,
            fontSize: "0.9rem",
            fontWeight: 800,
            letterSpacing: "0.24em",
            textTransform: "uppercase",
            lineHeight: 1.1,
          }}
        >
          fhiglobal.ae
        </span>
      </div>
    </div>
  )
})

export default Template4Mosaic
