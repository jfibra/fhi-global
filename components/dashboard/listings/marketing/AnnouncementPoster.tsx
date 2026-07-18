"use client"

import { forwardRef } from "react"
import { QRCodeSVG } from "qrcode.react"
import { Phone, Mail, Globe, Bed, Bath, Car, Maximize, LandPlot } from "lucide-react"
import { type FlyerData, formatPrice, proxied } from "@/lib/flyer/theme"

// Faithful rebuild of filipinohomes-final's PropertyAnnouncementModal poster in
// its light "Diagonal" (classic/panel) skin. 1200×800, exported 1:1.

export const POSTER_W = 1200
export const POSTER_H = 800

export type AnnouncementType = "just_listed" | "just_sold" | "officially_sold"

export const ANNOUNCEMENT_TYPES: Record<
  AnnouncementType,
  { label: string; line1: string; line2: string; tagline: string; priceLabel: string }
> = {
  just_listed: { label: "Just Listed", line1: "JUST", line2: "LISTED", tagline: "Brand new listing you'll love.", priceLabel: "ASKING PRICE" },
  just_sold: { label: "Just Sold", line1: "JUST", line2: "SOLD", tagline: "Another happy client — sold!", priceLabel: "SOLD PRICE" },
  officially_sold: { label: "Officially Sold", line1: "OFFICIALLY", line2: "SOLD", tagline: "Another happy client — sold!", priceLabel: "SOLD PRICE" },
}

// Light "Diagonal" skin tokens (mirrors SKINS.light).
const NAVY_INK = "#0f2c5c"
const BLUE_INK = "#2563eb"
const SK = {
  posterBg: "#ffffff",
  panelBack: "#b7c8e2",
  panelFront: "#ffffff",
  line1: NAVY_INK,
  line2: BLUE_INK,
  tagline: "#334155",
  underline: BLUE_INK,
  specIcon: NAVY_INK,
  specValue: NAVY_INK,
  specLabel: "#64748b",
  specDivider: "#e2e8f0",
  priceLabel: BLUE_INK,
  priceValue: NAVY_INK,
  footerBg: "#ffffff",
  footerBorder: "#eef2f7",
  agentName: NAVY_INK,
  agentRole: "#64748b",
  contactText: NAVY_INK,
  contactIcon: BLUE_INK,
  footerDivider: "#eef2f7",
}

const WEBSITE = "fhiglobal.ae"

const titleCase = (s: string) => s.replace(/\S+/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())

const hexAlpha = (hex: string, a: number) => {
  const c = hex.replace("#", "")
  const r = parseInt(c.slice(0, 2), 16)
  const g = parseInt(c.slice(2, 4), 16)
  const b = parseInt(c.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${a})`
}

type Props = {
  data: FlyerData & { currency?: string }
  type: AnnouncementType
  listingUrl: string
  heroUrl: string | null
}

const AnnouncementPoster = forwardRef<HTMLDivElement, Props>(function AnnouncementPoster(
  { data, type, listingUrl, heroUrl },
  ref,
) {
  const t = ANNOUNCEMENT_TYPES[type]
  const currency = data.currency ?? "AED"
  const image = heroUrl ? proxied(heroUrl) : null
  const agentAvatar = data.agent.imageUrl ? proxied(data.agent.imageUrl) : ""

  // Headline scales down for long words so it fits the copy panel.
  const headlineMax = Math.max(t.line1.length, t.line2.length)
  const headlineSize = headlineMax >= 10 ? 76 : headlineMax >= 8 ? 90 : 100

  const categoryLabel = (data.category || "").toUpperCase()

  const specDefs = [
    { Icon: Bed, value: Number(data.specs.bedrooms ?? 0), label: "Bedrooms" },
    { Icon: Bath, value: Number(data.specs.bathrooms ?? 0), label: "Bathrooms" },
    { Icon: Car, value: Number(data.specs.garage ?? 0), label: "Garage" },
    { Icon: Maximize, value: Number(data.specs.floorArea ?? 0), label: "Floor (sqm)" },
    { Icon: LandPlot, value: Number(data.specs.lotArea ?? 0), label: "Lot (sqm)" },
  ].filter((s) => s.value > 0)

  const n = specDefs.length
  const sc = n >= 6 ? 0.62 : n === 5 ? 0.78 : 1
  const r = (v: number) => Math.round(v * sc)

  return (
    <div
      ref={ref}
      style={{
        width: POSTER_W,
        height: POSTER_H,
        position: "relative",
        overflow: "hidden",
        backgroundColor: SK.posterBg,
        fontFamily: "'Outfit', system-ui, sans-serif",
      }}
    >
      {/* Photo (cover) */}
      <div style={{ position: "absolute", inset: 0, backgroundColor: SK.posterBg, overflow: "hidden" }}>
        {image && (
          <>
            <div
              style={{
                position: "absolute",
                inset: -2,
                backgroundImage: `url("${image}")`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }}
            />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={image} alt="" aria-hidden crossOrigin="anonymous" style={{ position: "absolute", width: 1, height: 1, opacity: 0 }} />
          </>
        )}
      </div>

      {/* Diagonal crossing panels (SVG — html2canvas-safe) */}
      <svg
        width={POSTER_W}
        height={POSTER_H}
        viewBox={`0 0 ${POSTER_W} ${POSTER_H}`}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block", pointerEvents: "none" }}
      >
        <polygon points={`0,0 680,0 280,${POSTER_H} 0,${POSTER_H}`} fill={SK.panelBack} />
        <polygon points={`0,0 300,0 820,${POSTER_H} 0,${POSTER_H}`} fill={SK.panelFront} />
      </svg>

      {/* Copy panel */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "58%",
          height: "100%",
          paddingLeft: 60,
          paddingRight: 60,
          paddingTop: 50,
          paddingBottom: 242,
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/FHI_Branding.png" alt="" style={{ height: 46, width: "auto", objectFit: "contain", display: "block", alignSelf: "flex-start" }} />

        {categoryLabel && (
          <div
            style={{
              alignSelf: "flex-start",
              marginTop: 14,
              paddingLeft: 14,
              paddingRight: 14,
              paddingTop: 5,
              paddingBottom: 5,
              borderRadius: 999,
              backgroundColor: hexAlpha(SK.underline, 0.14),
              color: SK.underline,
              fontWeight: 800,
              fontSize: 16,
              lineHeight: 1,
              letterSpacing: "0.5px",
              textTransform: "uppercase",
              whiteSpace: "nowrap",
            }}
          >
            {categoryLabel}
          </div>
        )}

        {/* Headline */}
        <div style={{ marginTop: 18 }}>
          <div style={{ fontFamily: "'Urbanist', sans-serif", fontWeight: 900, fontSize: headlineSize, lineHeight: 0.9, color: SK.line1, letterSpacing: "-2px" }}>{t.line1}</div>
          <div style={{ fontFamily: "'Urbanist', sans-serif", fontWeight: 900, fontSize: headlineSize, lineHeight: 0.9, color: SK.line2, letterSpacing: "-2px" }}>{t.line2}</div>
        </div>

        {/* Tagline + underline */}
        <div style={{ fontSize: 25, color: SK.tagline, marginTop: 14 }}>{t.tagline}</div>
        <div style={{ width: 110, height: 6, backgroundColor: SK.underline, borderRadius: 3, marginTop: 10 }} />

        {/* Specs (classic vertical stacks) */}
        {specDefs.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", marginTop: "auto", marginBottom: "auto" }}>
            {specDefs.map((s, i) => {
              const Icon = s.Icon
              return (
                <div key={i} style={{ display: "flex", alignItems: "center" }}>
                  {i > 0 && <div style={{ width: 1, height: r(78), backgroundColor: SK.specDivider, marginLeft: r(20), marginRight: r(20) }} />}
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: r(8), paddingLeft: r(6), paddingRight: r(6) }}>
                    <div style={{ color: SK.specIcon, display: "flex" }}>
                      <Icon size={r(34)} strokeWidth={2} />
                    </div>
                    <div style={{ fontFamily: "'Urbanist', sans-serif", fontWeight: 800, fontSize: r(30), color: SK.specValue, lineHeight: 1 }}>{s.value}</div>
                    <div style={{ fontSize: r(16), color: SK.specLabel, lineHeight: 1.1, whiteSpace: "nowrap" }}>{s.label}</div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Price — above the footer */}
      <div style={{ position: "absolute", left: 60, bottom: 156 }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: SK.priceLabel, letterSpacing: "1.5px" }}>{t.priceLabel}</div>
        <div style={{ fontFamily: "'Urbanist', sans-serif", fontWeight: 900, fontSize: 54, color: SK.priceValue, lineHeight: 1, marginTop: 6 }}>
          {formatPrice(data.price, currency)}
        </div>
      </div>

      {/* Footer bar */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          height: 140,
          backgroundColor: SK.footerBg,
          borderTop: `1px solid ${SK.footerBorder}`,
          paddingLeft: 60,
          paddingRight: 60,
          display: "flex",
          alignItems: "center",
          gap: 32,
        }}
      >
        {/* Agent */}
        <div style={{ display: "flex", alignItems: "center", gap: 18, flexShrink: 0 }}>
          <div
            style={{
              width: 82,
              height: 82,
              borderRadius: "50%",
              flexShrink: 0,
              border: `3px solid ${SK.contactIcon}`,
              backgroundImage: agentAvatar ? `url("${agentAvatar}")` : undefined,
              backgroundColor: "#cbd5e1",
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
          />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: "'Urbanist', sans-serif", fontWeight: 800, fontSize: 26, color: SK.agentName, lineHeight: 1.15, whiteSpace: "nowrap" }}>
              {titleCase(data.agent.name)}
            </div>
            <div style={{ fontSize: 18, color: SK.agentRole, marginTop: 2 }}>Real Estate Agent</div>
          </div>
        </div>

        <div style={{ width: 1, alignSelf: "stretch", marginTop: 34, marginBottom: 34, backgroundColor: SK.footerDivider }} />

        {data.agent.phone && (
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
            <Phone size={22} color={SK.contactIcon} />
            <div style={{ fontSize: 20, color: SK.contactText, whiteSpace: "nowrap" }}>{data.agent.phone}</div>
          </div>
        )}

        {data.agent.email && (
          <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
            <Mail size={22} color={SK.contactIcon} style={{ flexShrink: 0 }} />
            <div style={{ fontSize: 20, color: SK.contactText, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{data.agent.email}</div>
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginLeft: "auto", minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Globe size={20} color={SK.contactIcon} style={{ flexShrink: 0 }} />
            <div style={{ fontSize: 19, color: SK.contactText, whiteSpace: "nowrap" }}>{WEBSITE}</div>
          </div>
        </div>
      </div>

      {/* QR */}
      <div
        style={{
          position: "absolute",
          right: 60,
          bottom: 156,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 6,
          padding: 12,
          backgroundColor: "#ffffff",
          borderRadius: 14,
          border: "1px solid rgba(0,0,0,0.08)",
        }}
      >
        <QRCodeSVG value={listingUrl} size={132} bgColor="#ffffff" fgColor={NAVY_INK} level="H" />
      </div>
    </div>
  )
})

export default AnnouncementPoster
