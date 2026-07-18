"use client"

import type React from "react"
import { forwardRef } from "react"
import { QRCodeSVG } from "qrcode.react"
import { Phone, Mail, Globe, Bed, Bath, Car, Maximize, LandPlot } from "lucide-react"
import { type FlyerData, formatPrice } from "@/lib/flyer/theme"
import { LOGOS, type LogoOption } from "@/lib/flyer/logos"

export { LOGOS, type LogoOption }

// Faithful multi-skin rebuild of filipinohomes-final's PropertyAnnouncementModal
// poster. 1200×(800|630), exported 1:1. Four skins × three layouts, custom
// accent / background / panel color, logo selection, resizable/rotatable photo
// layers, adjustable text sizes and QR.

export const POSTER_W = 1200
export type PosterSize = "default" | "og"
export const POSTER_HEIGHTS: Record<PosterSize, number> = { default: 800, og: 630 }
export const POSTER_H = POSTER_HEIGHTS.default
const RAIL_W = 468
const GOLD = "#d4af6a"
const NAVY_INK = "#0f2c5c"
const BLUE_INK = "#2563eb"

export type PosterTheme = "light" | "black" | "green" | "railnavy"
export type AnnouncementType = "just_listed" | "just_sold" | "officially_sold"

// A placed photo on the poster. Multiple layers stack (later = on top); each is
// selectable and has its own transform.
export type Layer = {
  id: string
  name: string
  url: string
  tx: number
  ty: number
  sx: number
  sy: number
  rot: number
  aspect: number
}

export type LogoConfig = { url: string | null; size: number; outline: number }
export type QrConfig = { on: boolean; size: number }
export type TextScales = { title: number; tagline: number; spec: number; price: number }

export const ANNOUNCEMENT_TYPES: Record<
  AnnouncementType,
  { label: string; line1: string; line2: string; tagline: string; priceLabel: string }
> = {
  just_listed: { label: "Just Listed", line1: "JUST", line2: "LISTED", tagline: "Brand new listing you'll love.", priceLabel: "ASKING PRICE" },
  just_sold: { label: "Just Sold", line1: "JUST", line2: "SOLD", tagline: "Another happy client — sold!", priceLabel: "SOLD PRICE" },
  officially_sold: { label: "Officially Sold", line1: "OFFICIALLY", line2: "SOLD", tagline: "Another happy client — sold!", priceLabel: "SOLD PRICE" },
}

export const SKIN_LABELS: Record<PosterTheme, string> = {
  light: "Diagonal",
  black: "Fade",
  green: "Transparent",
  railnavy: "Rail",
}

type Skin = {
  layout: "classic" | "overlay" | "rail"
  panel: "panel" | "fade"
  posterBg: string
  scrimRGB: string
  panelBack: string
  panelFront: string
  overlay: string
  logo: "black" | "white"
  line1: string
  line2: string
  tagline: string
  underline: string
  specIcon: string
  specValue: string
  specLabel: string
  specDivider: string
  priceLabel: string
  priceValue: string
  priceBox: string
  pillBg: string
  footerBg: string
  footerBorder: string
  agentName: string
  agentRole: string
  contactText: string
  contactIcon: string
  footerDivider: string
}

const SKINS: Record<PosterTheme, Skin> = {
  light: {
    layout: "classic", panel: "panel", posterBg: "#ffffff", scrimRGB: "",
    panelBack: "#b7c8e2", panelFront: "#ffffff", overlay: "", pillBg: "",
    logo: "black", line1: NAVY_INK, line2: BLUE_INK, tagline: "#334155", underline: BLUE_INK,
    specIcon: NAVY_INK, specValue: NAVY_INK, specLabel: "#64748b", specDivider: "#e2e8f0",
    priceLabel: BLUE_INK, priceValue: NAVY_INK, priceBox: "",
    footerBg: "#ffffff", footerBorder: "#eef2f7", agentName: NAVY_INK, agentRole: "#64748b",
    contactText: NAVY_INK, contactIcon: BLUE_INK, footerDivider: "#eef2f7",
  },
  black: {
    layout: "classic", panel: "fade", posterBg: "#0a0d13", scrimRGB: "10,13,19",
    panelBack: "", panelFront: "", pillBg: "",
    overlay: "linear-gradient(105deg, #0a0d13 0%, #0a0d13 33%, rgba(10,13,19,0.5) 54%, rgba(10,13,19,0) 78%)",
    logo: "white", line1: GOLD, line2: GOLD, tagline: "#cbd5e1", underline: GOLD,
    specIcon: GOLD, specValue: "#ffffff", specLabel: "#9ca3af", specDivider: "rgba(212,175,106,0.3)",
    priceLabel: GOLD, priceValue: "#ffffff", priceBox: "rgba(212,175,106,0.55)",
    footerBg: "#0a0d13", footerBorder: "rgba(212,175,106,0.28)", agentName: "#ffffff", agentRole: "#9ca3af",
    contactText: "#e5e7eb", contactIcon: GOLD, footerDivider: "rgba(212,175,106,0.3)",
  },
  green: {
    layout: "overlay", panel: "fade", posterBg: "#e8eef0", scrimRGB: "10,18,12",
    panelBack: "", panelFront: "", pillBg: "rgba(28,54,38,0.74)",
    overlay: "linear-gradient(to top, rgba(10,18,12,0.62) 0%, rgba(10,18,12,0.28) 16%, rgba(10,18,12,0) 34%)",
    logo: "white", line1: "#ffffff", line2: "#4ade80", tagline: "#ffffff", underline: "#4ade80",
    specIcon: "#d3e6d7", specValue: "#ffffff", specLabel: "#ffffff", specDivider: "transparent",
    priceLabel: "#d3e6d7", priceValue: "#ffffff", priceBox: "",
    footerBg: "transparent", footerBorder: "transparent", agentName: "#ffffff", agentRole: "#e5efe8",
    contactText: "#ffffff", contactIcon: "#ffffff", footerDivider: "rgba(255,255,255,0.3)",
  },
  railnavy: {
    layout: "rail", panel: "panel", posterBg: "#0b1f3a", scrimRGB: "",
    panelBack: "#0b1f3a", panelFront: "#0b1f3a", overlay: "", pillBg: "",
    logo: "white", line1: "#ffffff", line2: GOLD, tagline: "#c8d4e6", underline: GOLD,
    specIcon: GOLD, specValue: "#ffffff", specLabel: "#9fb3d1", specDivider: "rgba(212,175,106,0.3)",
    priceLabel: GOLD, priceValue: "#ffffff", priceBox: "rgba(212,175,106,0.6)",
    footerBg: "#0b1f3a", footerBorder: "rgba(212,175,106,0.28)", agentName: "#ffffff", agentRole: "#9fb3d1",
    contactText: "#e5ebf5", contactIcon: GOLD, footerDivider: "rgba(212,175,106,0.3)",
  },
}

export const ACCENTS = ["#d4af6a", "#2563eb", "#0f2c5c", "#e11d48", "#10b981", "#0891b2", "#7c3aed", "#f59e0b"]
export const BACKGROUNDS = ["#0a0d13", "#0e1b34", "#14261c", "#2b1533", "#3a1720", "#0d2b2e", "#1f2430"]
export const RAIL_COLORS = ["#0b1f3a", "#0a0d13", "#14261c", "#3a1720", "#2b1533", "#1f2430", "#0d2b2e", "#f4f1ea", "#ffffff"]

const WEBSITE = "fhiglobal.ae"

const hexToRgb = (hex: string) => {
  const c = hex.replace("#", "")
  const f = c.length === 3 ? c.split("").map((x) => x + x).join("") : c
  return `${parseInt(f.slice(0, 2), 16) || 0},${parseInt(f.slice(2, 4), 16) || 0},${parseInt(f.slice(4, 6), 16) || 0}`
}
const isLightHex = (hex: string) => {
  const [r, g, b] = hexToRgb(hex).split(",").map(Number)
  return 0.299 * r + 0.587 * g + 0.114 * b > 150
}
const mix = (hex: string, pct: number) => {
  const [r, g, b] = hexToRgb(hex).split(",").map(Number)
  const t = pct < 0 ? 0 : 255
  const p = Math.min(Math.abs(pct), 1)
  const h = (n: number) => Math.max(0, Math.min(255, Math.round((t - n) * p + n))).toString(16).padStart(2, "0")
  return `#${h(r)}${h(g)}${h(b)}`
}
const darken = (hex: string, amt: number) => mix(hex, -amt)
const lighten = (hex: string, amt: number) => mix(hex, amt)
const titleCase = (s: string) => s.replace(/\S+/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())

const LIGHT_PANEL_INK: Partial<Skin> = {
  logo: "black", line1: NAVY_INK, line2: BLUE_INK, tagline: "#334155", underline: BLUE_INK,
  specIcon: NAVY_INK, specValue: NAVY_INK, specLabel: "#64748b", specDivider: "#e2e8f0",
  priceLabel: BLUE_INK, priceValue: NAVY_INK, priceBox: "", agentName: NAVY_INK, agentRole: "#64748b",
  contactText: NAVY_INK, contactIcon: BLUE_INK, footerDivider: "#e2e8f0", footerBorder: "#e2e8f0",
}
const DARK_PANEL_INK: Partial<Skin> = {
  logo: "white", line1: "#ffffff", line2: GOLD, tagline: "#c8d4e6", underline: GOLD,
  specIcon: GOLD, specValue: "#ffffff", specLabel: "#9fb3d1", specDivider: "rgba(212,175,106,0.3)",
  priceLabel: GOLD, priceValue: "#ffffff", agentName: "#ffffff", agentRole: "#9fb3d1",
  contactText: "#e5ebf5", contactIcon: GOLD, footerDivider: "rgba(212,175,106,0.3)", footerBorder: "rgba(212,175,106,0.28)",
}

export function resolveSkin(
  theme: PosterTheme,
  opts: { accent?: string; bgColor?: string; railColor?: string; backDark?: number },
): Skin {
  const { accent, bgColor, railColor, backDark = 35 } = opts
  let base = SKINS[theme]
  const panelSkin = base.layout === "rail" || (base.layout === "classic" && base.panel === "panel")
  if (panelSkin && railColor) {
    base = {
      ...base,
      panelFront: railColor,
      posterBg: railColor,
      footerBg: railColor,
      ...(isLightHex(railColor) ? LIGHT_PANEL_INK : DARK_PANEL_INK),
    }
  }
  let sk: Skin = accent
    ? {
        ...base,
        line1: base.line1 === base.line2 ? accent : base.line1,
        line2: accent,
        underline: base.underline ? accent : base.underline,
        specIcon: accent,
        priceLabel: accent,
        contactIcon: accent,
        priceBox: base.priceBox ? accent : base.priceBox,
      }
    : base
  if (bgColor && sk.scrimRGB) {
    sk = { ...sk, scrimRGB: hexToRgb(bgColor), posterBg: bgColor, footerBg: bgColor }
  }
  if (sk.layout === "classic" && sk.panel === "panel") {
    sk = { ...sk, panelBack: darken(sk.panelFront, (backDark / 100) * 0.6) }
  }
  return sk
}

// Contained rect a layer occupies inside the poster (before its own transform).
export function layerBase(aspect: number, posterH: number) {
  const ratio = POSTER_W / posterH
  const w = aspect >= ratio ? POSTER_W : posterH * aspect
  const h = aspect >= ratio ? POSTER_W / aspect : posterH
  return { w, h }
}

type Props = {
  data: FlyerData & { currency?: string }
  type: AnnouncementType
  listingUrl: string
  size: PosterSize
  skin: Skin
  layers: Layer[]
  logo: LogoConfig
  qr: QrConfig
  text: TextScales
  interactive?: boolean
  selectedId?: string | null
  onLayerPointerDown?: (id: string, e: React.PointerEvent<HTMLImageElement>) => void
  onBackgroundPointerDown?: (e: React.PointerEvent<HTMLDivElement>) => void
  onLayerAspect?: (id: string, aspect: number) => void
}

const AnnouncementPoster = forwardRef<HTMLDivElement, Props>(function AnnouncementPoster(
  { data, type, listingUrl, size, skin: sk, layers, logo, qr, text, interactive = false, selectedId = null, onLayerPointerDown, onBackgroundPointerDown, onLayerAspect },
  ref,
) {
  const posterH = POSTER_HEIGHTS[size]
  const t = ANNOUNCEMENT_TYPES[type]
  const currency = data.currency ?? "AED"
  const agentAvatar = data.agent.imageUrl
  const sz = (base: number, pct: number) => Math.round((base * pct) / 100)

  const headlineMax = Math.max(t.line1.length, t.line2.length)
  const headlineBase = headlineMax >= 10 ? 76 : headlineMax >= 8 ? 90 : 100
  const headlineSize = sz(headlineBase, text.title)
  const railHeadlineBase = headlineMax >= 10 ? 46 : headlineMax >= 8 ? 54 : 62
  const railHeadlineSize = sz(railHeadlineBase, text.title)
  const categoryLabel = (data.category || "").toUpperCase()

  const specDefs = [
    { Icon: Bed, value: Number(data.specs.bedrooms ?? 0), label: "Bedrooms", pill: `${Number(data.specs.bedrooms ?? 0)} Bedrooms` },
    { Icon: Bath, value: Number(data.specs.bathrooms ?? 0), label: "Bathrooms", pill: `${Number(data.specs.bathrooms ?? 0)} Bathrooms` },
    { Icon: Car, value: Number(data.specs.garage ?? 0), label: "Garage", pill: `${Number(data.specs.garage ?? 0)} Car Garage` },
    { Icon: Maximize, value: Number(data.specs.floorArea ?? 0), label: "Floor (sqm)", pill: `${Number(data.specs.floorArea ?? 0)} sqm Floor` },
    { Icon: LandPlot, value: Number(data.specs.lotArea ?? 0), label: "Lot (sqm)", pill: `${Number(data.specs.lotArea ?? 0)} sqm Lot` },
  ].filter((s) => s.value > 0)

  const contentPb = sk.layout === "overlay" ? 170 : sk.priceBox ? 272 : 242
  const logoSrc = logo.url ?? (sk.logo === "white" ? "/FHI_Branding_White.png" : "/FHI_Branding.png")
  // White logo artwork disappears on a light copy panel — sit it on a dark chip
  // there (mirrors the Reel Maker's logoIsWhite behaviour).
  const logoIsWhite = logo.url ? LOGOS.find((l) => l.url === logo.url)?.tone === "light" : sk.logo === "white"
  const logoNeedsChip = logoIsWhite && sk.layout !== "overlay" && isLightHex(sk.panelFront || sk.posterBg)
  const logoBg = logoNeedsChip ? NAVY_INK : logo.outline > 0 ? "#ffffff" : "transparent"
  const logoPad = logoNeedsChip ? 10 : logo.outline
  const railBg =
    sk.layout === "rail"
      ? `linear-gradient(180deg, ${lighten(sk.panelFront, 0.1)} 0%, ${sk.panelFront} 34%, ${darken(sk.panelFront, 0.22)} 100%)`
      : sk.panelFront

  const LogoEl = (
    <div
      style={{
        alignSelf: "flex-start",
        display: "inline-flex",
        padding: logoPad > 0 ? logoPad : 0,
        backgroundColor: logoBg,
        borderRadius: logoPad > 0 ? 10 : 0,
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={logoSrc} alt="" crossOrigin="anonymous" style={{ height: logo.size, width: "auto", objectFit: "contain", display: "block" }} />
    </div>
  )

  const Chip = categoryLabel ? (
    <div
      style={{
        alignSelf: "flex-start", marginTop: 14, paddingLeft: 14, paddingRight: 14, paddingTop: 5, paddingBottom: 5,
        borderRadius: 999,
        backgroundColor: sk.layout === "overlay" ? sk.pillBg : `rgba(${hexToRgb(sk.underline || sk.line2)},0.14)`,
        color: sk.layout === "overlay" ? sk.specValue : sk.underline || sk.line2,
        fontWeight: 800, fontSize: 16, lineHeight: 1, letterSpacing: "0.5px", textTransform: "uppercase", whiteSpace: "nowrap",
      }}
    >
      {categoryLabel}
    </div>
  ) : null

  const priceStr = formatPrice(data.price, currency)

  const QR = qr.on ? (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, padding: 12, backgroundColor: "#fff", borderRadius: 14, border: "1px solid rgba(0,0,0,0.08)" }}>
      <QRCodeSVG value={listingUrl} size={qr.size} bgColor="#ffffff" fgColor={NAVY_INK} level="H" />
    </div>
  ) : null

  const ratio = POSTER_W / posterH

  return (
    <div ref={ref} style={{ width: POSTER_W, height: posterH, position: "relative", overflow: "hidden", backgroundColor: sk.posterBg, fontFamily: "var(--font-outfit), system-ui, sans-serif" }}>
      {/* Photo layers (later = on top). objectFit contain so the whole photo
          shows; sized to its contained rect then transformed. */}
      <div
        onPointerDown={interactive ? onBackgroundPointerDown : undefined}
        style={{ position: "absolute", inset: 0, backgroundColor: sk.posterBg, overflow: "hidden" }}
      >
        {layers.map((layer) => {
          const { w, h } = layerBase(layer.aspect || ratio, posterH)
          return (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={layer.id}
              src={layer.url}
              alt=""
              crossOrigin="anonymous"
              draggable={false}
              onLoad={(e) => {
                const el = e.currentTarget
                if (el.naturalWidth && el.naturalHeight) onLayerAspect?.(layer.id, el.naturalWidth / el.naturalHeight)
              }}
              onPointerDown={interactive ? (e) => { e.stopPropagation(); onLayerPointerDown?.(layer.id, e) } : undefined}
              style={{
                position: "absolute",
                left: (POSTER_W - w) / 2,
                top: (posterH - h) / 2,
                width: w,
                height: h,
                transform: `translate(${layer.tx}px, ${layer.ty}px) rotate(${layer.rot}deg) scale(${layer.sx}, ${layer.sy})`,
                transformOrigin: "center",
                userSelect: "none",
                pointerEvents: interactive ? "auto" : "none",
                cursor: interactive ? "pointer" : "default",
                outline: interactive && selectedId === layer.id ? "0" : undefined,
              }}
            />
          )
        })}
      </div>

      {/* Separation: panels or fade */}
      {sk.layout !== "rail" && (
        sk.panel === "panel" ? (
          <svg width={POSTER_W} height={posterH} viewBox={`0 0 ${POSTER_W} ${posterH}`} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block", pointerEvents: "none" }}>
            <polygon points={`0,0 680,0 280,${posterH} 0,${posterH}`} fill={sk.panelBack} />
            <polygon points={`0,0 300,0 820,${posterH} 0,${posterH}`} fill={sk.panelFront} />
          </svg>
        ) : (
          <div style={{ position: "absolute", inset: 0, background: sk.overlay, pointerEvents: "none" }} />
        )
      )}
      {sk.layout === "classic" && sk.panel === "fade" && (
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(0,0,0,0) 40%, rgba(0,0,0,0.30) 100%)", pointerEvents: "none" }} />
      )}

      {sk.layout === "rail" ? (
        /* ===== RAIL ===== */
        <div style={{ position: "absolute", top: 0, left: 0, width: RAIL_W, height: "100%", background: railBg, borderRight: sk.footerBorder ? `1px solid ${sk.footerBorder}` : "none", paddingLeft: 46, paddingRight: 46, paddingTop: 42, paddingBottom: 40, display: "flex", flexDirection: "column", pointerEvents: "none" }}>
          {LogoEl}
          {categoryLabel && (
            <div style={{ alignSelf: "flex-start", marginTop: 16, paddingLeft: 14, paddingRight: 14, paddingTop: 5, paddingBottom: 5, borderRadius: 999, backgroundColor: `rgba(${hexToRgb(sk.underline || sk.line2)},0.16)`, color: sk.underline || sk.line2, fontWeight: 800, fontSize: 15, lineHeight: 1, letterSpacing: "0.5px", textTransform: "uppercase", whiteSpace: "nowrap" }}>{categoryLabel}</div>
          )}
          <div style={{ marginTop: 12 }}>
            <div style={{ fontFamily: "var(--font-urbanist), sans-serif", fontWeight: 900, fontSize: railHeadlineSize, lineHeight: 0.92, color: sk.line1, letterSpacing: "-1px" }}>{t.line1}</div>
            <div style={{ fontFamily: "var(--font-urbanist), sans-serif", fontWeight: 900, fontSize: railHeadlineSize, lineHeight: 0.92, color: sk.line2, letterSpacing: "-1px" }}>{t.line2}</div>
          </div>
          <div style={{ fontSize: sz(21, text.tagline), color: sk.tagline, marginTop: 12 }}>{t.tagline}</div>
          {sk.underline && <div style={{ width: 90, height: 5, backgroundColor: sk.underline, borderRadius: 3, marginTop: 8 }} />}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: 12, paddingTop: 18, paddingBottom: 18 }}>
            {specDefs.map((s, i) => {
              const Icon = s.Icon
              return (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 13 }}>
                  <div style={{ color: sk.specIcon, display: "flex", flexShrink: 0 }}><Icon size={sz(24, text.spec)} strokeWidth={2} /></div>
                  <div style={{ fontWeight: 600, fontSize: sz(23, text.spec), color: sk.specValue, lineHeight: 1, whiteSpace: "nowrap" }}>{s.pill}</div>
                </div>
              )
            })}
          </div>
          <div style={{ ...(sk.priceBox ? { border: `1.5px solid ${sk.priceBox}`, borderRadius: 12, paddingLeft: 20, paddingRight: 20, paddingTop: 12, paddingBottom: 12, alignSelf: "flex-start" } : {}) }}>
            <div style={{ fontSize: sz(18, text.price), fontWeight: 700, color: sk.priceLabel, letterSpacing: "1.5px" }}>{t.priceLabel}</div>
            <div style={{ fontFamily: "var(--font-urbanist), sans-serif", fontWeight: 900, fontSize: sz(44, text.price), color: sk.priceValue, lineHeight: 1, marginTop: 5 }}>{priceStr}</div>
          </div>
          <div style={{ paddingTop: 18 }}>
            <div style={{ height: 1, backgroundColor: sk.footerDivider, marginBottom: 16 }} />
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 58, height: 58, borderRadius: "50%", flexShrink: 0, border: `3px solid ${sk.contactIcon}`, backgroundImage: agentAvatar ? `url("${agentAvatar}")` : undefined, backgroundColor: "#cbd5e1", backgroundSize: "cover", backgroundPosition: "center" }} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontFamily: "var(--font-urbanist), sans-serif", fontWeight: 800, fontSize: 22, color: sk.agentName, lineHeight: 1.15, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{titleCase(data.agent.name)}</div>
                <div style={{ fontSize: 15, color: sk.agentRole, marginTop: 2 }}>Real Estate Agent</div>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 13 }}>
              {data.agent.phone && (
                <div style={{ display: "flex", alignItems: "center", gap: 11 }}><Phone size={18} color={sk.contactIcon} /><div style={{ fontSize: 17, color: sk.contactText, whiteSpace: "nowrap" }}>{data.agent.phone}</div></div>
              )}
              {data.agent.email && (
                <div style={{ display: "flex", alignItems: "center", gap: 11, minWidth: 0 }}><Mail size={18} color={sk.contactIcon} style={{ flexShrink: 0 }} /><div style={{ fontSize: 17, color: sk.contactText, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{data.agent.email}</div></div>
              )}
              <div style={{ display: "flex", alignItems: "center", gap: 11 }}><Globe size={17} color={sk.contactIcon} /><div style={{ fontSize: 17, color: sk.contactText, whiteSpace: "nowrap" }}>{WEBSITE}</div></div>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Copy panel */}
          <div style={{ position: "absolute", top: 0, left: 0, width: "58%", height: "100%", paddingLeft: 60, paddingRight: 60, paddingTop: 50, paddingBottom: contentPb, display: "flex", flexDirection: "column", pointerEvents: "none" }}>
            {LogoEl}
            {Chip}
            <div style={{ marginTop: 18 }}>
              <div style={{ fontFamily: "var(--font-urbanist), sans-serif", fontWeight: 900, fontSize: headlineSize, lineHeight: 0.9, color: sk.line1, letterSpacing: "-2px" }}>{t.line1}</div>
              <div style={{ fontFamily: "var(--font-urbanist), sans-serif", fontWeight: 900, fontSize: headlineSize, lineHeight: 0.9, color: sk.line2, letterSpacing: "-2px" }}>{t.line2}</div>
            </div>
            <div style={{ fontSize: sz(25, text.tagline), color: sk.tagline, marginTop: 14, fontStyle: sk.layout === "overlay" ? "italic" : "normal" }}>{t.tagline}</div>
            {sk.underline && <div style={{ width: 110, height: 6, backgroundColor: sk.underline, borderRadius: 3, marginTop: 10 }} />}

            {specDefs.length > 0 && (sk.layout === "overlay" ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 13, marginTop: "auto", marginBottom: "auto" }}>
                {specDefs.map((s, i) => {
                  const Icon = s.Icon
                  return (
                    <div key={i} style={{ display: "inline-flex", alignItems: "center", gap: 12, backgroundColor: sk.pillBg, borderRadius: 10, paddingLeft: 20, paddingRight: 20, paddingTop: 11, paddingBottom: 11 }}>
                      <div style={{ color: sk.specIcon, display: "flex" }}><Icon size={sz(26, text.spec)} strokeWidth={2} /></div>
                      <div style={{ fontWeight: 600, fontSize: sz(26, text.spec), color: sk.specValue, lineHeight: 1, whiteSpace: "nowrap" }}>{s.pill}</div>
                    </div>
                  )
                })}
              </div>
            ) : (() => {
              const n = specDefs.length
              const scl = n >= 6 ? 0.62 : n === 5 ? 0.78 : 1
              const r = (v: number) => Math.round(v * scl * (text.spec / 100))
              return (
                <div style={{ display: "flex", alignItems: "center", marginTop: "auto", marginBottom: "auto" }}>
                  {specDefs.map((s, i) => {
                    const Icon = s.Icon
                    return (
                      <div key={i} style={{ display: "flex", alignItems: "center" }}>
                        {i > 0 && <div style={{ width: 1, height: r(78), backgroundColor: sk.specDivider, marginLeft: r(20), marginRight: r(20) }} />}
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: r(8), paddingLeft: r(6), paddingRight: r(6) }}>
                          <div style={{ color: sk.specIcon, display: "flex" }}><Icon size={r(34)} strokeWidth={2} /></div>
                          <div style={{ fontFamily: "var(--font-urbanist), sans-serif", fontWeight: 800, fontSize: r(30), color: sk.specValue, lineHeight: 1 }}>{s.value}</div>
                          <div style={{ fontSize: r(16), color: sk.specLabel, lineHeight: 1.1, whiteSpace: "nowrap" }}>{s.label}</div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            })())}
          </div>

          {sk.layout === "classic" ? (
            <>
              <div style={{ position: "absolute", left: 60, bottom: sk.priceBox ? 150 : 156, pointerEvents: "none", ...(sk.priceBox ? { border: `1.5px solid ${sk.priceBox}`, borderRadius: 14, paddingLeft: 26, paddingRight: 26, paddingTop: 16, paddingBottom: 16 } : {}) }}>
                <div style={{ fontSize: sz(20, text.price), fontWeight: 700, color: sk.priceLabel, letterSpacing: "1.5px" }}>{t.priceLabel}</div>
                <div style={{ fontFamily: "var(--font-urbanist), sans-serif", fontWeight: 900, fontSize: sz(54, text.price), color: sk.priceValue, lineHeight: 1, marginTop: 6 }}>{priceStr}</div>
              </div>
              <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 140, backgroundColor: sk.footerBg, borderTop: `1px solid ${sk.footerBorder}`, paddingLeft: 60, paddingRight: 60, display: "flex", alignItems: "center", gap: 32, pointerEvents: "none" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 18, flexShrink: 0 }}>
                  <div style={{ width: 82, height: 82, borderRadius: "50%", flexShrink: 0, border: `3px solid ${sk.contactIcon}`, backgroundImage: agentAvatar ? `url("${agentAvatar}")` : undefined, backgroundColor: "#cbd5e1", backgroundSize: "cover", backgroundPosition: "center" }} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontFamily: "var(--font-urbanist), sans-serif", fontWeight: 800, fontSize: 26, color: sk.agentName, lineHeight: 1.15, whiteSpace: "nowrap" }}>{titleCase(data.agent.name)}</div>
                    <div style={{ fontSize: 18, color: sk.agentRole, marginTop: 2 }}>Real Estate Agent</div>
                  </div>
                </div>
                <div style={{ width: 1, alignSelf: "stretch", marginTop: 34, marginBottom: 34, backgroundColor: sk.footerDivider }} />
                {data.agent.phone && (
                  <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}><Phone size={22} color={sk.contactIcon} /><div style={{ fontSize: 20, color: sk.contactText, whiteSpace: "nowrap" }}>{data.agent.phone}</div></div>
                )}
                {data.agent.email && (
                  <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}><Mail size={22} color={sk.contactIcon} style={{ flexShrink: 0 }} /><div style={{ fontSize: 20, color: sk.contactText, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{data.agent.email}</div></div>
                )}
                <div style={{ display: "flex", flexDirection: "column", gap: 10, marginLeft: "auto", minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}><Globe size={20} color={sk.contactIcon} style={{ flexShrink: 0 }} /><div style={{ fontSize: 19, color: sk.contactText, whiteSpace: "nowrap" }}>{WEBSITE}</div></div>
                </div>
              </div>
            </>
          ) : (
            <div style={{ position: "absolute", left: 60, right: 60, bottom: 50, display: "flex", alignItems: "flex-end", gap: 36, pointerEvents: "none" }}>
              <div style={{ backgroundColor: sk.pillBg, borderRadius: 12, paddingLeft: 26, paddingRight: 26, paddingTop: 16, paddingBottom: 16, flexShrink: 0 }}>
                <div style={{ fontSize: sz(18, text.price), fontWeight: 700, color: sk.priceLabel, letterSpacing: "1.5px" }}>{t.priceLabel}</div>
                <div style={{ fontFamily: "var(--font-urbanist), sans-serif", fontWeight: 900, fontSize: sz(46, text.price), color: sk.priceValue, lineHeight: 1, marginTop: 4 }}>{priceStr}</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 16, flexShrink: 0, paddingBottom: 6 }}>
                <div style={{ width: 74, height: 74, borderRadius: "50%", flexShrink: 0, border: `3px solid ${sk.contactIcon}`, backgroundImage: agentAvatar ? `url("${agentAvatar}")` : undefined, backgroundColor: "#cbd5e1", backgroundSize: "cover", backgroundPosition: "center" }} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontFamily: "var(--font-urbanist), sans-serif", fontWeight: 800, fontSize: 26, color: sk.agentName, lineHeight: 1.15, whiteSpace: "nowrap" }}>{titleCase(data.agent.name)}</div>
                  <div style={{ fontSize: 18, color: sk.agentRole, marginTop: 2 }}>Real Estate Agent</div>
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 9, marginLeft: "auto", paddingBottom: 6, minWidth: 0 }}>
                {data.agent.phone && (
                  <div style={{ display: "flex", alignItems: "center", gap: 11 }}><Phone size={20} color={sk.contactIcon} style={{ flexShrink: 0 }} /><div style={{ fontSize: 19, color: sk.contactText, whiteSpace: "nowrap" }}>{data.agent.phone}</div></div>
                )}
                {data.agent.email && (
                  <div style={{ display: "flex", alignItems: "center", gap: 11, minWidth: 0 }}><Mail size={20} color={sk.contactIcon} style={{ flexShrink: 0 }} /><div style={{ fontSize: 19, color: sk.contactText, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{data.agent.email}</div></div>
                )}
                <div style={{ display: "flex", alignItems: "center", gap: 11 }}><Globe size={19} color={sk.contactIcon} style={{ flexShrink: 0 }} /><div style={{ fontSize: 19, color: sk.contactText, whiteSpace: "nowrap" }}>{WEBSITE}</div></div>
              </div>
            </div>
          )}
        </>
      )}

      {/* QR */}
      {QR && <div style={{ position: "absolute", right: 60, bottom: sk.layout === "overlay" ? 172 : sk.layout === "rail" ? 60 : 156, pointerEvents: "none" }}>{QR}</div>}
    </div>
  )
})

export default AnnouncementPoster
