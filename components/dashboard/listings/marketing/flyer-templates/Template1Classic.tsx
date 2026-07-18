"use client"

import { forwardRef } from "react"
import FlyerLogo from "./FlyerLogo"
import { QRCodeSVG } from "qrcode.react"
import {
  MapPin,
  Phone,
  Mail,
  Home,
  ShieldCheck,
  Lock,
  Trees,
  Globe,
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

// Faithful Tailwind/inline-styled rebuild of filipinohomes-final's
// Template1Classic flyer (940×788 Facebook-feed size). Rendered at natural
// pixel size so html2canvas can rasterize it 1:1; the preview wrapper scales
// it down with a CSS transform (which html2canvas ignores).

const W = FLYER_W
const H = FLYER_H

const Template1Classic = forwardRef<HTMLDivElement, TemplateProps>(function Template1Classic(
  { data, listingUrl, theme, logoUrl, logoSize, logoOutline },
  ref,
) {
  const { accent, bg, text, mode } = theme
  const currency = data.currency ?? "AED"

  const onBg = readableOn(bg)
  const logoSrc = logoUrl ?? (onBg === "#ffffff" ? "/FHI_Branding_White.png" : "/FHI_Branding.png")
  const qrFg = onBg === "#ffffff" ? bg : "#141821"
  const bodyText = withAlpha(text, 0.62)
  const hairline = withAlpha(text, 0.12)
  const scrimHex = shade(bg, mode === "dark" ? 0 : -0.6)

  const category = (data.category || "FOR SALE").toUpperCase()
  const agentInitials = getAgentInitials(data.agent.name)
  const image = data.image

  const specs = [
    { value: data.specs.bedrooms, label: "Beds", icon: <Bed size={22} /> },
    { value: data.specs.bathrooms, label: "Baths", icon: <Bath size={22} /> },
    { value: data.specs.garage, label: "Parking", icon: <SquareParking size={22} /> },
    { value: data.specs.lotArea, label: "sqm Lot", icon: <Scan size={22} /> },
    { value: data.specs.floorArea, label: "sqm Floor", icon: <Layers2 size={22} /> },
  ].filter(({ value }) => parseFloat(String(value ?? "")) > 0)

  const features = [
    { icon: <ShieldCheck size={22} />, title: "Prime Location", sub: "In a sought-after, accessible area" },
    { icon: <Home size={22} />, title: "Spacious Property", sub: "Generous lot & floor area" },
    { icon: <Lock size={22} />, title: "Secure Community", sub: "Safe, well-managed neighborhood" },
    { icon: <Trees size={22} />, title: "Near Amenities", sub: "Close to schools, malls & more" },
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
        color: text,
      }}
    >
      {/* ===== TOP BAR ===== */}
      <div
        style={{
          flexShrink: 0,
          height: 66,
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

      {/* ===== HERO ===== */}
      <div style={{ flexShrink: 0, height: 336, position: "relative", backgroundColor: "#e5e7eb", overflow: "hidden" }}>
        {image ? (
          <>
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
              backgroundColor: withAlpha(bg, 0.1),
            }}
          >
            <span style={{ color: bodyText, fontWeight: 600 }}>No Image Available</span>
          </div>
        )}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: `linear-gradient(180deg, ${withAlpha(scrimHex, 0.15)} 0%, ${withAlpha(scrimHex, 0)} 40%, ${withAlpha(scrimHex, 0.86)} 100%)`,
            pointerEvents: "none",
          }}
        />

        {/* subtype + price (bottom-left) */}
        <div style={{ position: "absolute", left: 32, bottom: 26, right: 220, zIndex: 2 }}>
          {data.subtype && (
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 7,
                marginBottom: 10,
                paddingLeft: 16,
                paddingRight: 16,
                paddingTop: 7,
                paddingBottom: 7,
                borderRadius: 10,
                backgroundColor: withAlpha(scrimHex, 0.85),
              }}
            >
              <Home size={18} color={accent} />
              <span
                style={{
                  fontSize: "0.85rem",
                  fontWeight: 800,
                  color: "#fff",
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  lineHeight: 1.1,
                  whiteSpace: "nowrap",
                }}
              >
                {data.subtype}
              </span>
            </div>
          )}
          <div
            style={{
              fontSize: "0.78rem",
              fontWeight: 800,
              color: accent,
              textTransform: "uppercase",
              letterSpacing: "0.24em",
              lineHeight: 1.1,
              marginBottom: 5,
            }}
          >
            Price
          </div>
          <div
            style={{
              fontSize: "3rem",
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

        {/* QR (right) */}
        <div
          style={{
            position: "absolute",
            bottom: 26,
            right: 32,
            zIndex: 2,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 6,
          }}
        >
          <div style={{ padding: 10, borderRadius: 14, backgroundColor: "#fff", boxShadow: "0 12px 30px rgba(0,0,0,0.4)" }}>
            {/* No centre logo: a relative <image> href inside the serialized
                SVG can taint or drop on html2canvas export — a clean QR always
                scans. */}
            <QRCodeSVG value={listingUrl} size={144} fgColor={qrFg} level="H" />
          </div>
          <div style={{ paddingLeft: 14, paddingRight: 14, paddingTop: 4, paddingBottom: 4, borderRadius: 999, backgroundColor: bg }}>
            <span
              style={{
                fontSize: "0.68rem",
                fontWeight: 800,
                color: onBg,
                letterSpacing: "0.16em",
                textTransform: "uppercase",
                lineHeight: 1.1,
              }}
            >
              Scan to View
            </span>
          </div>
        </div>
      </div>

      {/* ===== BODY ===== */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          paddingLeft: 40,
          paddingRight: 40,
          paddingTop: 18,
          paddingBottom: 18,
        }}
      >
        {/* Title + location */}
        <div>
          <div
            style={{
              fontSize: "1.55rem",
              fontWeight: 900,
              color: text,
              lineHeight: 1.12,
              textTransform: "uppercase",
              letterSpacing: "-0.005em",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
              maxHeight: "2.3em",
            }}
          >
            {data.title}
          </div>
          {data.address && (
            <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 5 }}>
              <MapPin size={20} color={accent} style={{ flexShrink: 0 }} />
              <span
                style={{
                  fontSize: "1rem",
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
          )}
        </div>

        {/* Spec cards */}
        {specs.length > 0 && (
          <div style={{ display: "flex", flexWrap: "nowrap", gap: 8, overflow: "hidden" }}>
            {specs.map(({ value, label, icon }) => (
              <div
                key={label}
                style={{
                  flex: "1 1 0",
                  minWidth: 0,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  backgroundColor: "#fff",
                  border: `1px solid ${hairline}`,
                  boxShadow: "0 2px 8px rgba(15,23,42,0.04)",
                  paddingLeft: 12,
                  paddingRight: 12,
                  paddingTop: 8,
                  paddingBottom: 8,
                  borderRadius: 12,
                }}
              >
                <div style={{ color: accent, display: "flex", flexShrink: 0 }}>{icon}</div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: "1.2rem", fontWeight: 800, color: text, lineHeight: 1 }}>
                    {Math.round(parseFloat(String(value)))}
                  </div>
                  <div
                    style={{
                      fontSize: "0.66rem",
                      fontWeight: 700,
                      color: bodyText,
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                      marginTop: 2,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {label}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Agent bar (Listed by) */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            padding: 12,
            borderRadius: 16,
            background: `linear-gradient(90deg, ${withAlpha(accent, 0.1)} 0%, ${withAlpha(bg, 0.06)} 100%)`,
            border: `1px solid ${hairline}`,
          }}
        >
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: "50%",
              overflow: "hidden",
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: withAlpha(accent, 0.14),
              border: "3px solid #fff",
              boxShadow: `0 4px 14px ${withAlpha(bg, 0.18)}`,
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
              <span style={{ fontSize: "1.4rem", fontWeight: 800, color: text }}>{agentInitials}</span>
            )}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: "0.7rem", fontWeight: 800, color: accent, textTransform: "uppercase", letterSpacing: "0.18em", lineHeight: 1.1 }}>
              Listed By
            </div>
            <div
              style={{
                fontSize: "1.25rem",
                fontWeight: 800,
                color: text,
                marginTop: 3,
                textTransform: "capitalize",
                lineHeight: 1.15,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {data.agent.name}
            </div>
            <div style={{ display: "flex", gap: 16, marginTop: 3, minWidth: 0 }}>
              {data.agent.phone && (
                <div style={{ display: "flex", alignItems: "center", gap: 5, flexShrink: 0 }}>
                  <Phone size={16} color={accent} />
                  <span style={{ fontSize: "0.98rem", fontWeight: 700, color: text }}>{data.agent.phone}</span>
                </div>
              )}
              {data.agent.email && (
                <div style={{ display: "flex", alignItems: "center", gap: 5, minWidth: 0 }}>
                  <Mail size={16} color={accent} style={{ flexShrink: 0 }} />
                  <span
                    style={{
                      fontSize: "0.95rem",
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
        </div>

        {/* Feature bar */}
        <div style={{ display: "flex", alignItems: "center", borderRadius: 14, backgroundColor: bg, paddingLeft: 16, paddingRight: 16, paddingTop: 12, paddingBottom: 12 }}>
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
                borderLeft: i === 0 ? "none" : `1px solid ${withAlpha(onBg, 0.14)}`,
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
                  backgroundColor: withAlpha(accent, 0.16),
                  color: accent,
                }}
              >
                {f.icon}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: "0.82rem", fontWeight: 800, color: onBg, lineHeight: 1.15, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {f.title}
                </div>
                <div style={{ fontSize: "0.64rem", fontWeight: 500, color: withAlpha(onBg, 0.7), lineHeight: 1.2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {f.sub}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ===== FOOTER ===== */}
      <div style={{ flexShrink: 0, height: 42, display: "flex", alignItems: "center", justifyContent: "center", gap: 12 }}>
        <div style={{ width: 90, height: 1, background: `linear-gradient(90deg, transparent, ${accent})` }} />
        <Globe size={16} color={text} />
        <span style={{ color: text, fontSize: "0.82rem", fontWeight: 800, letterSpacing: "0.22em", textTransform: "uppercase", lineHeight: 1.1 }}>
          fhiglobal.ae
        </span>
        <div style={{ width: 90, height: 1, background: `linear-gradient(90deg, ${accent}, transparent)` }} />
      </div>
    </div>
  )
})

export default Template1Classic
