"use client"

// Project Poster Studio designs. DOM-rendered at fixed pixel sizes and
// exported with lib/flyer/capture.ts (html-to-image) — same pipeline as the
// listing flyer suite, so fonts/images rasterize reliably.

import React, { forwardRef } from "react"
import { QRCodeSVG } from "qrcode.react"
import { proxied, formatPrice } from "@/lib/flyer/theme"
import type { ProjectMarketingData } from "./marketing-data"

export type PosterDesignId = "goldenhour" | "pearl" | "obsidian"
export type PosterFormatId = "story" | "square" | "a4"

export const POSTER_DESIGNS: { id: PosterDesignId; name: string; tagline: string }[] = [
  { id: "goldenhour", name: "Golden Hour", tagline: "Cinematic full-bleed hero with gold detailing" },
  { id: "pearl",      name: "Pearl",       tagline: "Ivory editorial layout, framed and airy" },
  { id: "obsidian",   name: "Obsidian",    tagline: "Black-tie minimal with an arched showcase" },
]

export const POSTER_FORMATS: Record<PosterFormatId, { w: number; h: number; label: string; hint: string }> = {
  story:  { w: 1080, h: 1920, label: "Story",  hint: "1080 × 1920 — Instagram / TikTok story" },
  square: { w: 1080, h: 1080, label: "Square", hint: "1080 × 1080 — feed post" },
  a4:     { w: 1240, h: 1754, label: "A4",     hint: "2480 × 3508 exported — print ready" },
}

const GOLD = "#d6b357"
const GOLD_DEEP = "#ca9104"
const NAVY = "#001f3f"
const NAVY_INK = "#0d1b2e"
const IVORY = "#f7f4ec"

const LOGO_WHITE = "/FHI_Branding_White.png"
const LOGO_NAVY = encodeURI("/logos/FHI_Branding Set_PNG Copies-02.png")

const DISPLAY_FONT = "var(--font-urbanist), var(--font-outfit), 'Arial Black', Arial, sans-serif"
const BODY_FONT = "var(--font-outfit), Arial, sans-serif"

const clampLines = (lines: number): React.CSSProperties => ({
  display: "-webkit-box",
  WebkitLineClamp: lines,
  WebkitBoxOrient: "vertical",
  overflow: "hidden",
})

export type PosterProps = {
  data: ProjectMarketingData
  design: PosterDesignId
  format: PosterFormatId
  /** Editable headline; empty string hides the line. */
  headline: string
  /** Hero image URL (raw, un-proxied). */
  heroUrl: string | null
  showQr: boolean
  phone: string
  email: string
}

function priceText(data: ProjectMarketingData): string {
  // A provided label wins verbatim — an empty one deliberately blanks the line.
  if (data.priceLabel != null) return data.priceLabel.trim()
  return formatPrice(data.priceFrom ?? 0, data.currency)
}

/** Whether the poster has a price worth labelling ("Starting From"). */
function hasPrice(data: ProjectMarketingData): boolean {
  if (data.priceLabel != null) return data.priceLabel.trim().length > 0
  return Boolean(data.priceFrom)
}

/* ────────────────────────── Golden Hour (dark) ─────────────────────────── */

function GoldenHour({ data, format, headline, heroUrl, showQr, phone, email }: PosterProps) {
  const { w, h } = POSTER_FORMATS[format]
  const u = w / 1080
  const P = (format === "a4" ? 84 : 72) * u
  const isSquare = format === "square"
  const chips = data.amenities.slice(0, isSquare ? 3 : 4)

  return (
    <div style={{ position: "relative", width: w, height: h, background: "#001428", overflow: "hidden", fontFamily: BODY_FONT, color: "#fff" }}>
      {heroUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={proxied(heroUrl)} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
      ) : (
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(160deg, #00294f 0%, #001428 70%)" }} />
      )}
      {/* scrims */}
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, #001428 6%, rgba(0,20,40,0.92) 24%, rgba(0,20,40,0.38) 52%, rgba(0,10,25,0.22) 100%)" }} />
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(0,10,25,0.72), rgba(0,10,25,0) 20%)" }} />

      {/* top bar */}
      <div style={{ position: "absolute", top: P, left: P, right: P, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={LOGO_WHITE} alt="FHI Global Property" style={{ height: 62 * u, width: "auto" }} />
        <div style={{ background: GOLD, color: "#001428", borderRadius: 999, padding: `${13 * u}px ${28 * u}px`, fontSize: 25 * u, fontWeight: 800, letterSpacing: "0.16em", textTransform: "uppercase" }}>
          {data.statusLabel}
        </div>
      </div>

      {/* bottom stack */}
      <div style={{ position: "absolute", bottom: P, left: P, right: P, display: "flex", flexDirection: "column", gap: 26 * u }}>
        <div style={{ color: GOLD, fontSize: 26 * u, fontWeight: 800, letterSpacing: "0.32em", textTransform: "uppercase", ...clampLines(1) }}>
          {data.locationLine}
        </div>
        <div style={{ fontFamily: DISPLAY_FONT, fontWeight: 900, fontSize: (isSquare ? 74 : 94) * u, lineHeight: 1.04, ...clampLines(2) }}>
          {data.name}
        </div>
        <div style={{ width: 150 * u, height: 8 * u, borderRadius: 4 * u, background: `linear-gradient(90deg, ${GOLD}, ${GOLD_DEEP})` }} />
        {!isSquare && headline && (
          <div style={{ fontSize: 30 * u, lineHeight: 1.45, color: "rgba(255,255,255,0.88)", maxWidth: "90%", ...clampLines(2) }}>
            {headline}
          </div>
        )}
        {chips.length > 0 && (
          <div style={{ display: "flex", gap: 14 * u, flexWrap: "wrap" }}>
            {chips.map((c) => (
              <span key={c} style={{ background: "rgba(8,30,55,0.62)", border: "1.5px solid rgba(255,255,255,0.28)", borderRadius: 999, padding: `${12 * u}px ${24 * u}px`, fontSize: 24 * u, fontWeight: 600 }}>
                {c}
              </span>
            ))}
          </div>
        )}
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 24 * u }}>
          <div>
            {hasPrice(data) ? (
              <div style={{ color: GOLD, fontSize: 23 * u, fontWeight: 700, letterSpacing: "0.24em", textTransform: "uppercase", marginBottom: 8 * u }}>
                Starting From
              </div>
            ) : null}
            <div style={{ fontFamily: DISPLAY_FONT, fontSize: 62 * u, fontWeight: 900, lineHeight: 1 }}>
              {priceText(data)}
            </div>
          </div>
          {data.handoverLabel && (
            <div style={{ border: `2px solid ${GOLD}`, color: GOLD, borderRadius: 16 * u, padding: `${14 * u}px ${24 * u}px`, fontSize: 26 * u, fontWeight: 700, whiteSpace: "nowrap" }}>
              Handover {data.handoverLabel}
            </div>
          )}
        </div>
        <div style={{ height: 2, background: "rgba(255,255,255,0.18)" }} />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24 * u }}>
          <div style={{ display: "flex", alignItems: "center", gap: 22 * u, minWidth: 0 }}>
            {data.developerLogo ? (
              <div style={{ background: "#fff", borderRadius: 16 * u, padding: 12 * u, height: 84 * u, display: "flex", alignItems: "center" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={proxied(data.developerLogo)} alt={data.developerName} style={{ height: "100%", width: "auto", maxWidth: 220 * u, objectFit: "contain" }} />
              </div>
            ) : (
              data.developerName && (
                <div style={{ fontSize: 30 * u, fontWeight: 800 }}>{data.developerName}</div>
              )
            )}
            <div style={{ minWidth: 0 }}>
              {phone && (
                <div style={{ fontSize: 26 * u, fontWeight: 600, ...clampLines(1) }}>
                  <span style={{ color: GOLD }}>✆</span>&nbsp; {phone}
                </div>
              )}
              {email && (
                <div style={{ fontSize: 24 * u, color: "rgba(255,255,255,0.85)", marginTop: 6 * u, ...clampLines(1) }}>
                  <span style={{ color: GOLD }}>✉</span>&nbsp; {email}
                </div>
              )}
            </div>
          </div>
          {showQr && (
            <div style={{ background: "#fff", borderRadius: 18 * u, padding: 16 * u, flexShrink: 0 }}>
              <QRCodeSVG value={data.publicUrl} size={Math.round(136 * u)} fgColor="#001428" bgColor="#ffffff" level="M" />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* ──────────────────────────── Pearl (light) ────────────────────────────── */

function Pearl({ data, format, headline, heroUrl, showQr, phone, email }: PosterProps) {
  const { w, h } = POSTER_FORMATS[format]
  const u = w / 1080
  const isSquare = format === "square"
  const P = 62 * u

  // The hero owns the top of the sheet and bleeds to both edges; the body
  // sits on ivory beneath it. Square has far less height to give away.
  const heroH = h * (isSquare ? 0.44 : 0.545)
  const features = (data.features.length ? data.features : data.amenities).slice(0, 6)
  const website = "fhiglobal.ae"

  return (
    <div style={{ position: "relative", width: w, height: h, background: IVORY, overflow: "hidden", fontFamily: BODY_FONT, color: NAVY_INK }}>
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <div style={{ position: "absolute", top: 0, left: 0, width: w, height: heroH, overflow: "hidden", borderBottomLeftRadius: 46 * u, borderBottomRightRadius: 46 * u }}>
        {heroUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={proxied(heroUrl)} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <div style={{ position: "absolute", inset: 0, background: `linear-gradient(150deg, ${NAVY} 0%, #0a3a66 100%)` }} />
        )}
        {/* Scrim under the copy so the headline holds on any photo. */}
        <div style={{ position: "absolute", inset: 0, background: `linear-gradient(100deg, rgba(0,17,40,0.86) 0%, rgba(0,17,40,0.55) 38%, rgba(0,17,40,0) 68%)` }} />

        {/* Angled navy plate carrying the logo. */}
        <div
          style={{
            position: "absolute", top: 0, left: 0, width: w * 0.46, height: heroH * 0.24,
            background: NAVY,
            clipPath: "polygon(0% 0%, 100% 0%, 72% 100%, 0% 100%)",
          }}
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={LOGO_WHITE} alt="FHI Global Property" style={{ position: "absolute", top: heroH * 0.055, left: P, height: heroH * 0.115, width: "auto" }} />

        {/* Status chip */}
        <div
          style={{
            position: "absolute", top: heroH * 0.075, right: P,
            background: "rgba(0,17,40,0.9)", color: "#fff",
            border: `${2 * u}px solid ${GOLD}`, borderRadius: 999,
            padding: `${11 * u}px ${26 * u}px`,
            fontSize: 22 * u, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase",
            whiteSpace: "nowrap",
          }}
        >
          {data.statusLabel}
        </div>

        {/* Marketing copy */}
        <div style={{ position: "absolute", left: P, top: heroH * 0.34, width: w * 0.52 }}>
          <div style={{ fontSize: 30 * u, fontWeight: 600, letterSpacing: "0.26em", textTransform: "uppercase", color: "#ffffff" }}>
            Modern Living
          </div>
          <div style={{ marginTop: 14 * u, fontFamily: DISPLAY_FONT, fontSize: (isSquare ? 66 : 82) * u, fontWeight: 900, lineHeight: 1.02, letterSpacing: "0.01em", color: GOLD }}>
            TIMELESS
            <br />
            VALUE
          </div>
          {headline && (
            <div style={{ marginTop: 22 * u, fontSize: 30 * u, lineHeight: 1.35, color: "rgba(255,255,255,0.94)", ...clampLines(2) }}>
              {headline}
            </div>
          )}
        </div>

        {/* Location pill */}
        {data.locationLine && (
          <div
            style={{
              position: "absolute", left: P, bottom: heroH * 0.06,
              display: "flex", alignItems: "center", gap: 12 * u,
              background: "rgba(0,17,40,0.9)", color: "#fff",
              border: `${1.5 * u}px solid rgba(214,179,87,0.55)`, borderRadius: 999,
              padding: `${12 * u}px ${26 * u}px`, fontSize: 26 * u, fontWeight: 700, maxWidth: w * 0.62,
            }}
          >
            <span style={{ width: 12 * u, height: 12 * u, borderRadius: 999, background: GOLD, flexShrink: 0 }} />
            <span style={{ minWidth: 0, ...clampLines(1) }}>{data.locationLine}</span>
          </div>
        )}
      </div>

      {/* ── Body ─────────────────────────────────────────────────────────── */}
      <div style={{ position: "absolute", top: heroH, left: 0, width: w, height: h - heroH, padding: `${34 * u}px ${P}px ${28 * u}px`, display: "flex", flexDirection: "column" }}>
        <div style={{ fontFamily: DISPLAY_FONT, fontWeight: 900, fontSize: (isSquare ? 62 : 84) * u, lineHeight: 1.02, textTransform: "uppercase", color: NAVY_INK, ...clampLines(1) }}>
          {data.name}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 14 * u, marginTop: 18 * u }}>
          <div style={{ width: 14 * u, height: 14 * u, background: GOLD_DEEP, transform: "rotate(45deg)", flexShrink: 0 }} />
          <div style={{ flex: 1, height: 2 * u, background: `linear-gradient(90deg, rgba(202,145,4,0.85), rgba(202,145,4,0))` }} />
        </div>

        {data.tagline && (
          <div style={{ marginTop: 20 * u, fontSize: 27 * u, lineHeight: 1.45, color: "#4b5768", ...clampLines(2) }}>
            {data.tagline}
          </div>
        )}

        {/* Feature grid — two columns split by a hairline, rows ruled in gold */}
        {features.length > 0 && (
          <div style={{ marginTop: 26 * u, display: "grid", gridTemplateColumns: "1fr 1fr", columnGap: 34 * u }}>
            {[0, 1].map((col) => (
              <div key={col} style={{ borderLeft: col === 1 ? `${1.5 * u}px solid rgba(202,145,4,0.35)` : undefined, paddingLeft: col === 1 ? 34 * u : 0 }}>
                {features.filter((_, i) => i % 2 === col).map((f, i, arr) => (
                  <div
                    key={f}
                    style={{
                      display: "flex", alignItems: "center", gap: 16 * u,
                      padding: `${14 * u}px 0`,
                      borderBottom: i < arr.length - 1 ? `${1.5 * u}px solid rgba(202,145,4,0.28)` : undefined,
                      minWidth: 0,
                    }}
                  >
                    <span style={{ width: 44 * u, height: 44 * u, borderRadius: 999, background: NAVY, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <span style={{ width: 13 * u, height: 13 * u, background: GOLD, transform: "rotate(45deg)" }} />
                    </span>
                    <span style={{ fontSize: 24 * u, fontWeight: 700, letterSpacing: "0.02em", textTransform: "uppercase", color: NAVY_INK, ...clampLines(2) }}>
                      {f}
                    </span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        <div style={{ flex: 1, minHeight: 18 * u }} />

        {/* Price band */}
        <div style={{ background: NAVY, border: `${2 * u}px solid rgba(214,179,87,0.75)`, borderRadius: 22 * u, padding: `${28 * u}px ${34 * u}px`, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24 * u }}>
          <div style={{ minWidth: 0 }}>
            {hasPrice(data) && (
              <div style={{ color: GOLD, fontSize: 24 * u, fontWeight: 800, letterSpacing: "0.2em", textTransform: "uppercase" }}>
                Starting From
              </div>
            )}
            <div style={{ fontFamily: DISPLAY_FONT, color: "#fff", fontSize: (isSquare ? 52 : 64) * u, fontWeight: 900, lineHeight: 1.1, marginTop: 6 * u, ...clampLines(1) }}>
              {priceText(data)}
            </div>
            {data.handoverLabel && (
              <>
                <div style={{ height: 2 * u, background: "rgba(214,179,87,0.5)", margin: `${16 * u}px 0` }} />
                <div style={{ color: GOLD, fontSize: 25 * u, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                  Handover {data.handoverLabel}
                </div>
              </>
            )}
          </div>
          {showQr && (
            <div style={{ flexShrink: 0, textAlign: "center" }}>
              <div style={{ background: "#fff", borderRadius: 12 * u, padding: 12 * u }}>
                <QRCodeSVG value={data.publicUrl} size={Math.round((isSquare ? 108 : 132) * u)} fgColor={NAVY} bgColor="#ffffff" level="M" />
              </div>
              <div style={{ marginTop: 10 * u, color: GOLD, fontSize: 17 * u, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase" }}>
                Scan for details
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ marginTop: 24 * u, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24 * u }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 * u, minWidth: 0 }}>
            <div style={{ fontSize: 17 * u, fontWeight: 800, letterSpacing: "0.16em", textTransform: "uppercase", color: "#7a869a", whiteSpace: "nowrap" }}>
              Developed by
            </div>
            {data.developerLogo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={proxied(data.developerLogo)} alt={data.developerName} style={{ height: 46 * u, width: "auto", maxWidth: 220 * u, objectFit: "contain" }} />
            ) : (
              <div style={{ fontSize: 24 * u, fontWeight: 800, color: NAVY_INK, ...clampLines(1) }}>{data.developerName}</div>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 22 * u, minWidth: 0 }}>
            <div style={{ fontSize: 22 * u, fontWeight: 600, color: NAVY_INK, ...clampLines(1) }}>{email || website}</div>
            {phone && (
              <>
                <div style={{ width: 1.5 * u, height: 22 * u, background: "rgba(13,27,46,0.2)" }} />
                <div style={{ fontSize: 22 * u, fontWeight: 800, color: NAVY_INK, ...clampLines(1) }}>{phone}</div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}


/* ─────────────────────────── Obsidian (black) ──────────────────────────── */

function Obsidian({ data, format, headline, heroUrl, showQr, phone, email }: PosterProps) {
  const { w, h } = POSTER_FORMATS[format]
  const u = w / 1080
  const P = 76 * u
  const isSquare = format === "square"
  const archW = w * (isSquare ? 0.5 : 0.68)
  const archH = h * (isSquare ? 0.44 : 0.4)
  const archRadius = `${archW / 2}px ${archW / 2}px ${24 * u}px ${24 * u}px`
  const amenityLine = data.amenities.slice(0, 4).join("  •  ")

  return (
    <div style={{ position: "relative", width: w, height: h, background: "#0b0b10", overflow: "hidden", fontFamily: BODY_FONT, color: "#f5f2ea", textAlign: "center" }}>
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at 50% -10%, rgba(214,179,87,0.16), rgba(214,179,87,0) 55%)" }} />
      <div style={{ position: "absolute", inset: 30 * u, border: "1.5px solid rgba(214,179,87,0.30)", borderRadius: 6 * u, pointerEvents: "none" }} />

      <div style={{ position: "absolute", inset: P, display: "flex", flexDirection: "column", alignItems: "center" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={LOGO_WHITE} alt="FHI Global Property" style={{ height: 56 * u, width: "auto" }} />

        {/* arched hero */}
        <div style={{ marginTop: 44 * u, width: archW, height: archH, padding: 16 * u, border: "2px solid rgba(214,179,87,0.65)", borderRadius: archRadius, flexShrink: 0 }}>
          {heroUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={proxied(heroUrl)} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: archRadius }} />
          ) : (
            <div style={{ width: "100%", height: "100%", borderRadius: archRadius, background: "linear-gradient(170deg, #1a1a24 0%, #0b0b10 100%)" }} />
          )}
        </div>

        <div style={{ marginTop: 42 * u, color: GOLD, fontSize: 25 * u, fontWeight: 700, letterSpacing: "0.34em", textTransform: "uppercase", ...clampLines(1) }}>
          {data.statusLabel}
          {data.handoverLabel ? `  •  Handover ${data.handoverLabel}` : ""}
        </div>
        <div style={{ marginTop: 22 * u, fontFamily: DISPLAY_FONT, fontWeight: 900, fontSize: (isSquare ? 60 : 80) * u, lineHeight: 1.06, maxWidth: "92%", ...clampLines(2) }}>
          {data.name}
        </div>
        <div style={{ marginTop: 20 * u, fontSize: 27 * u, color: "rgba(245,242,234,0.78)", ...clampLines(1) }}>
          {data.locationLine}
        </div>

        {/* divider */}
        <div style={{ marginTop: 30 * u, display: "flex", alignItems: "center", gap: 18 * u, width: "56%" }}>
          <div style={{ flex: 1, height: 1.5, background: "rgba(214,179,87,0.45)" }} />
          <div style={{ width: 13 * u, height: 13 * u, background: GOLD, transform: "rotate(45deg)" }} />
          <div style={{ flex: 1, height: 1.5, background: "rgba(214,179,87,0.45)" }} />
        </div>

        {hasPrice(data) ? (
          <div style={{ marginTop: 30 * u, color: GOLD, fontSize: 22 * u, fontWeight: 700, letterSpacing: "0.26em", textTransform: "uppercase" }}>
            Starting From
          </div>
        ) : null}
        <div style={{ marginTop: 12 * u, fontFamily: DISPLAY_FONT, fontSize: 58 * u, fontWeight: 900 }}>
          {priceText(data)}
        </div>
        {!isSquare && amenityLine && (
          <div style={{ marginTop: 22 * u, fontSize: 25 * u, color: "rgba(245,242,234,0.72)", maxWidth: "88%", ...clampLines(1) }}>
            {amenityLine}
          </div>
        )}
        {!isSquare && headline && (
          <div style={{ marginTop: 18 * u, fontSize: 27 * u, lineHeight: 1.5, color: "rgba(245,242,234,0.85)", maxWidth: "80%", ...clampLines(2) }}>
            {headline}
          </div>
        )}

        <div style={{ flex: 1 }} />

        {showQr && (
          <div style={{ background: "#fff", borderRadius: 18 * u, padding: 16 * u }}>
            <QRCodeSVG value={data.publicUrl} size={Math.round((isSquare ? 108 : 138) * u)} fgColor="#0b0b10" bgColor="#ffffff" level="M" />
          </div>
        )}
        {(phone || email) && (
          <div style={{ marginTop: 22 * u, fontSize: 26 * u, fontWeight: 600, ...clampLines(1) }}>
            {[phone, email].filter(Boolean).join("   •   ")}
          </div>
        )}
        {data.developerName && (
          <div style={{ marginTop: 14 * u, color: GOLD, fontSize: 23 * u, fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase", ...clampLines(1) }}>
            By {data.developerName}
          </div>
        )}
      </div>
    </div>
  )
}

/* ───────────────────────────── Dispatcher ──────────────────────────────── */

export const ProjectPoster = forwardRef<HTMLDivElement, PosterProps>(function ProjectPoster(props, ref) {
  const { w, h } = POSTER_FORMATS[props.format]
  return (
    <div ref={ref} style={{ width: w, height: h }}>
      {props.design === "goldenhour" && <GoldenHour {...props} />}
      {props.design === "pearl" && <Pearl {...props} />}
      {props.design === "obsidian" && <Obsidian {...props} />}
    </div>
  )
})
