"use client"

import { forwardRef } from "react"
import { QRCodeSVG } from "qrcode.react"
import {
  BedDouble,
  Bath,
  SquareParking,
  Scan,
  Layers2,
  MapPin,
  Phone,
  Mail,
  Home,
  ShieldCheck,
  Users,
  Globe,
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

// Faithful inline-styled rebuild of filipinohomes-final's Template2Modern flyer
// (940×788 Facebook-feed size). Rendered at natural pixel size so html2canvas
// can rasterize it 1:1; the preview wrapper scales it down with a CSS transform.

const W = FLYER_W
const H = FLYER_H
const HERO_H = 330

const Template2Modern = forwardRef<HTMLDivElement, TemplateProps>(function Template2Modern(
  { data, listingUrl, theme },
  ref,
) {
  const { accent, bg, text, mode } = theme
  const currency = data.currency ?? "AED"

  const onAccent = readableOn(accent)
  const onBg = readableOn(bg)
  const scrim = shade(bg, -0.45) // darkened base of bg for photo scrims

  // The hero logo sits over a dark photo scrim → pick the readable variant.
  const logoSrc = readableOn(scrim) === "#ffffff" ? "/FHI_Branding_White.png" : "/FHI_Branding.png"

  const bodyText = withAlpha(text, 0.62)
  const hairline = withAlpha(text, 0.12)

  const category = (data.category || "FOR SALE").toUpperCase()
  const agentInitials = getAgentInitials(data.agent.name)
  const secondImage = data.gallery?.[0] || null

  const specs = [
    { value: data.specs.bedrooms, label: "Beds", icon: <BedDouble size={22} /> },
    { value: data.specs.bathrooms, label: "Baths", icon: <Bath size={22} /> },
    { value: data.specs.garage, label: "Parking", icon: <SquareParking size={22} /> },
    { value: data.specs.lotArea, label: "Lot (sqm)", icon: <Scan size={22} /> },
    { value: data.specs.floorArea, label: "Floor (sqm)", icon: <Layers2 size={22} /> },
  ].filter(({ value }) => parseFloat(String(value ?? "")) > 0)

  const features = [
    { icon: <MapPin size={20} />, title: "Prime Location", sub: "In a sought-after, accessible area" },
    { icon: <Home size={20} />, title: "Spacious Property", sub: "Wide lot & floor area for families" },
    { icon: <ShieldCheck size={20} />, title: "Secure Community", sub: "Gated, with 24/7 security" },
    { icon: <Users size={20} />, title: "Near Amenities", sub: "Close to schools, malls & more" },
  ]

  return (
    <div
      ref={ref}
      style={{
        width: W,
        height: H,
        backgroundColor: "#ffffff",
        overflow: "hidden",
        fontFamily: "var(--font-urbanist), var(--font-outfit), sans-serif",
        position: "relative",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* ===== DUAL-PHOTO HERO ===== */}
      <div style={{ flexShrink: 0, height: HERO_H, display: "flex", gap: secondImage ? 6 : 0, backgroundColor: "#fff" }}>
        {/* Main photo */}
        <div
          style={{
            flex: secondImage ? "2 1 0" : "1 1 0",
            position: "relative",
            backgroundColor: withAlpha(bg, 0.08),
            overflow: "hidden",
          }}
        >
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
                backgroundColor: withAlpha(bg, 0.1),
              }}
            >
              <span style={{ color: bodyText, fontWeight: 600 }}>No Image</span>
            </div>
          )}
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: `linear-gradient(180deg, ${withAlpha(scrim, mode === "dark" ? 0.6 : 0.5)} 0%, ${withAlpha(scrim, 0)} 30%, ${withAlpha(scrim, 0)} 50%, ${withAlpha(scrim, 0.82)} 100%)`,
              pointerEvents: "none",
            }}
          />
          {/* Logo */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={logoSrc}
            alt=""
            crossOrigin="anonymous"
            style={{ position: "absolute", top: 26, left: 30, height: 42, zIndex: 2 }}
          />
          {/* FOR SALE pill */}
          <div
            style={{
              position: "absolute",
              top: 80,
              left: 30,
              zIndex: 2,
              display: "flex",
              alignItems: "center",
              gap: 6,
              paddingLeft: 16,
              paddingRight: 16,
              paddingTop: 7,
              paddingBottom: 7,
              borderRadius: 10,
              backgroundColor: accent,
              boxShadow: `0 6px 16px ${withAlpha(accent, 0.4)}`,
            }}
          >
            <Home size={18} color={onAccent} />
            <span
              style={{
                color: onAccent,
                fontSize: 14.4,
                fontWeight: 900,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                lineHeight: 1.1,
              }}
            >
              {category}
            </span>
          </div>
          {/* Price */}
          <div style={{ position: "absolute", bottom: 26, left: 30, right: 20, zIndex: 2 }}>
            <div
              style={{
                fontSize: "0.75rem",
                fontWeight: 800,
                color: accent,
                textTransform: "uppercase",
                letterSpacing: "0.24em",
                lineHeight: 1.1,
                marginBottom: 4,
              }}
            >
              Price
            </div>
            <div
              style={{
                fontSize: "2.7rem",
                fontWeight: 900,
                color: "#fff",
                lineHeight: 1,
                letterSpacing: "-0.02em",
                textShadow: "0 4px 18px rgba(0,0,0,0.5)",
              }}
            >
              {formatPrice(data.price, currency)}
            </div>
          </div>
        </div>

        {/* Second photo */}
        {secondImage && (
          <div
            style={{
              flex: "1 1 0",
              position: "relative",
              backgroundColor: withAlpha(bg, 0.08),
              overflow: "hidden",
            }}
          >
            <div
              style={{
                position: "absolute",
                top: -2,
                left: -2,
                right: -2,
                bottom: -2,
                backgroundImage: `url("${secondImage}")`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }}
            />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={secondImage}
              alt=""
              aria-hidden
              crossOrigin="anonymous"
              style={{ position: "absolute", width: 1, height: 1, opacity: 0, pointerEvents: "none" }}
            />
            {data.subtype && (
              <div
                style={{
                  position: "absolute",
                  top: 20,
                  right: 20,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  paddingLeft: 14,
                  paddingRight: 14,
                  paddingTop: 6,
                  paddingBottom: 6,
                  borderRadius: 999,
                  backgroundColor: "rgba(255,255,255,0.95)",
                  maxWidth: 220,
                }}
              >
                <Home size={16} color={text} />
                <span
                  style={{
                    fontSize: "0.82rem",
                    fontWeight: 800,
                    color: text,
                    textTransform: "capitalize",
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
        )}
      </div>

      {/* ===== TWO-COLUMN BODY ===== */}
      <div style={{ flex: 1, minHeight: 0, display: "flex", paddingLeft: 32, paddingRight: 32, paddingTop: 20, paddingBottom: 20, gap: 24 }}>
        {/* LEFT */}
        <div style={{ flex: "1.55 1 0", minWidth: 0, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <div style={{ width: 26, height: 3, borderRadius: 2, backgroundColor: accent }} />
              <span
                style={{
                  color: accent,
                  fontSize: 12.8,
                  fontWeight: 900,
                  letterSpacing: "0.2em",
                  textTransform: "uppercase",
                  lineHeight: 1.1,
                }}
              >
                {category}
              </span>
            </div>
            <div
              style={{
                fontSize: "1.7rem",
                fontWeight: 900,
                color: text,
                lineHeight: 1.08,
                textTransform: "uppercase",
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
            <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 6 }}>
              <MapPin size={19} color={accent} style={{ flexShrink: 0 }} />
              <span
                style={{
                  fontSize: "0.95rem",
                  color: bodyText,
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
          </div>

          {specs.length > 0 && (
            <div style={{ display: "flex", flexWrap: "nowrap", gap: 8, overflow: "hidden" }}>
              {specs.map(({ value, label, icon }) => (
                <div
                  key={label}
                  style={{
                    flex: "1 1 0",
                    minWidth: 0,
                    display: "flex",
                    flexDirection: "column",
                    gap: 3,
                    backgroundColor: "#fff",
                    border: `1px solid ${hairline}`,
                    boxShadow: "0 2px 8px rgba(15,23,42,0.04)",
                    paddingLeft: 11,
                    paddingRight: 11,
                    paddingTop: 9,
                    paddingBottom: 9,
                    borderRadius: 12,
                  }}
                >
                  <div style={{ color: accent, display: "flex" }}>{icon}</div>
                  <div style={{ fontSize: "1.2rem", fontWeight: 800, color: text, lineHeight: 1 }}>
                    {Math.round(parseFloat(String(value)))}
                  </div>
                  <div
                    style={{
                      fontSize: "0.62rem",
                      fontWeight: 700,
                      color: bodyText,
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
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

        {/* Divider */}
        <div style={{ width: 1, backgroundColor: hairline, alignSelf: "stretch" }} />

        {/* RIGHT */}
        <div style={{ flex: "1 1 0", minWidth: 0, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div
                style={{
                  width: 58,
                  height: 58,
                  borderRadius: "50%",
                  overflow: "hidden",
                  flexShrink: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: withAlpha(accent, 0.12),
                  border: `2px solid ${accent}`,
                }}
              >
                {data.agent.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={data.agent.imageUrl}
                    alt={data.agent.name}
                    crossOrigin="anonymous"
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                ) : (
                  <span style={{ fontSize: "1.2rem", fontWeight: 800, color: accent }}>{agentInitials}</span>
                )}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: "0.68rem", fontWeight: 900, color: accent, textTransform: "uppercase", letterSpacing: "0.18em", lineHeight: 1.1 }}>
                  Listed By
                </div>
                <div
                  style={{
                    fontSize: "1.15rem",
                    fontWeight: 800,
                    color: text,
                    marginTop: 3,
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
            <div style={{ marginTop: 8 }}>
              {data.agent.phone && (
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                  <Phone size={16} color={accent} />
                  <span style={{ fontSize: "0.95rem", fontWeight: 700, color: text }}>{data.agent.phone}</span>
                </div>
              )}
              {data.agent.email && (
                <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                  <Mail size={16} color={accent} style={{ flexShrink: 0 }} />
                  <span
                    style={{
                      fontSize: "0.85rem",
                      fontWeight: 500,
                      color: bodyText,
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
          </div>

          {/* QR block */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, paddingTop: 12, borderTop: `1px solid ${hairline}` }}>
            <div style={{ padding: 8, backgroundColor: "#fff", border: `1px solid ${hairline}`, borderRadius: 10, flexShrink: 0 }}>
              <QRCodeSVG value={listingUrl} size={112} fgColor="#111318" level="H" />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: "0.82rem", fontWeight: 900, color: accent, textTransform: "uppercase", letterSpacing: "0.1em", lineHeight: 1.1 }}>
                Scan to View
              </div>
              <div style={{ fontSize: "0.78rem", fontWeight: 500, color: bodyText, marginTop: 4, lineHeight: 1.3 }}>
                Scan the QR code to view more photos and property details.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ===== FEATURE BAR ===== */}
      <div
        style={{
          flexShrink: 0,
          marginLeft: 32,
          marginRight: 32,
          marginBottom: 12,
          paddingLeft: 16,
          paddingRight: 16,
          paddingTop: 12,
          paddingBottom: 12,
          borderRadius: 14,
          backgroundColor: "#f4f6fa",
          display: "flex",
          alignItems: "center",
        }}
      >
        {features.map((f, i) => (
          <div
            key={f.title}
            style={{
              flex: "1 1 0",
              minWidth: 0,
              display: "flex",
              alignItems: "center",
              gap: 8,
              paddingLeft: i === 0 ? 0 : 12,
              borderLeft: i === 0 ? "none" : `1px solid ${hairline}`,
            }}
          >
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: "50%",
                flexShrink: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: bg,
                color: onBg,
              }}
            >
              {f.icon}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: "0.8rem", fontWeight: 800, color: text, lineHeight: 1.15, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {f.title}
              </div>
              <div style={{ fontSize: "0.64rem", fontWeight: 500, color: bodyText, lineHeight: 1.2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {f.sub}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ===== FOOTER ===== */}
      <div style={{ flexShrink: 0, height: 44, backgroundColor: bg, display: "flex", alignItems: "center", justifyContent: "center", gap: 12 }}>
        <div style={{ width: 80, height: 1, background: `linear-gradient(90deg, transparent, ${withAlpha(onBg, 0.6)})` }} />
        <Globe size={16} color={onBg} />
        <span style={{ color: onBg, fontSize: "0.82rem", fontWeight: 800, letterSpacing: "0.22em", textTransform: "uppercase", lineHeight: 1.1 }}>
          fhiglobal.ae
        </span>
        <div style={{ width: 80, height: 1, background: `linear-gradient(90deg, ${withAlpha(onBg, 0.6)}, transparent)` }} />
      </div>
    </div>
  )
})

export default Template2Modern
