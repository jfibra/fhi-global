"use client"

// Top Seller award poster. DOM-rendered at fixed pixel sizes and exported with
// lib/flyer/capture.ts (html-to-image) — same pipeline as the project poster
// studio, so fonts and photos rasterize reliably.
//
// Everything scales off `u = width / 1080`, so one layout serves every format.
// Gradients here are artwork (metal gold, night sky, photo scrims), not UI
// chrome — the dashboard itself stays on solid navy/gold.

import React, { forwardRef } from "react"
import { proxied } from "@/lib/flyer/theme"

export type PosterFormatId = "certificate" | "monthly" | "portrait" | "story" | "square"

export const POSTER_FORMATS: Record<PosterFormatId, { w: number; h: number; label: string; hint: string }> = {
  certificate: { w: 1448, h: 1086, label: "Top Seller Certificate", hint: "1448 × 1086 — landscape award certificate, ready to print" },
  monthly:     { w: 1448, h: 1086, label: "Monthly Awardee",       hint: "1448 × 1086 — monthly recognition certificate for a chosen month" },
  portrait:    { w: 1080, h: 1620, label: "Portrait",    hint: "1080 × 1620 — 2:3 poster, prints beautifully" },
  story:       { w: 1080, h: 1920, label: "Story",       hint: "1080 × 1920 — Instagram / TikTok story" },
  square:      { w: 1080, h: 1080, label: "Square",      hint: "1080 × 1080 — feed post" },
}

/**
 * The printed certificate artwork, and where its blanks sit (measured from
 * the file, in its own 1448 × 1086 pixels).
 *
 * Only the blanks are drawn over: the photo medallion on the left, the
 * recipient line above the divider, and the three ruled slots along the foot.
 * Everything else — frame, laurels, ribbon, body copy — is the artwork itself,
 * so the printed piece stays exactly as designed.
 */
type CertificateArt = {
  src: string
  /** Photo medallion: a true circle, so CSS can clip it — no canvas needed. */
  photo: { cx: number; cy: number; d: number }
  /** Recipient name, centred on the rule below it. */
  name: { cx: number; baseline: number; maxWidth: number }
  /** Optional month banner (the monthly certificate reserves one). */
  month?: { cx: number; baseline: number; maxWidth: number; size: number }
  /** The three ruled slots; values sit just above each rule. */
  slots: Array<{ cx: number; baseline: number }>
}

const CERTIFICATES: Record<"certificate" | "monthly", CertificateArt> = {
  certificate: {
    src: "/images/topsellers1.webp",
    photo: { cx: 273, cy: 448, d: 330 },
    name: { cx: 857, baseline: 570, maxWidth: 620 },
    slots: [
      { cx: 553, baseline: 924 },
      { cx: 834, baseline: 924 },
      { cx: 1114, baseline: 924 },
    ],
  },
  monthly: {
    src: "/images/monthlyawardee.webp",
    photo: { cx: 276, cy: 462, d: 316 },
    name: { cx: 822, baseline: 532, maxWidth: 640 },
    month: { cx: 855, baseline: 836, maxWidth: 520, size: 34 },
    slots: [
      { cx: 511, baseline: 987 },
      { cx: 806, baseline: 987 },
      { cx: 1087, baseline: 987 },
    ],
  },
}

export type AwardId = "top-seller" | "top-producer" | "rising-star"

export const AWARDS: { id: AwardId; line1: string; line2: string; blurb: string }[] = [
  { id: "top-seller",   line1: "TOP",    line2: "SELLER",   blurb: "Highest sales production for the period" },
  { id: "top-producer", line1: "TOP",    line2: "PRODUCER", blurb: "Outstanding total contract value" },
  { id: "rising-star",  line1: "RISING", line2: "STAR",     blurb: "Breakout performance" },
]

const GOLD = "#d6b357"
const GOLD_LIGHT = "#f7e3a1"
const GOLD_PALE = "#fff6d8"
const GOLD_DEEP = "#a97c12"
const NAVY_DEEP = "#00112a"

const LOGO_WHITE = "/FHI_Branding_White.png"
const SKYLINE = "/background/dubai.webp"

const DISPLAY = "var(--font-urbanist), var(--font-outfit), 'Arial Black', Arial, sans-serif"
const BODY = "var(--font-outfit), Arial, sans-serif"
const SCRIPT = "var(--font-script), 'Segoe Script', cursive"

/** Brushed-metal gold for large type. */
const GOLD_METAL = `linear-gradient(180deg, ${GOLD_PALE} 0%, ${GOLD_LIGHT} 22%, ${GOLD} 46%, ${GOLD_DEEP} 68%, ${GOLD} 86%, ${GOLD_LIGHT} 100%)`

const whiteText = (u: number): React.CSSProperties => ({
  color: "#ffffff",
  textShadow: `0 ${3 * u}px 0 ${GOLD_DEEP}, 0 ${6 * u}px ${14 * u}px rgba(0,0,0,0.55)`,
})

/**
 * Gold metal headline drawn as SVG text.
 *
 * The obvious way to gradient-fill text is `-webkit-background-clip: text` with
 * a transparent fill — but that pairing is exactly what can be dropped when
 * html-to-image rasterizes the clone through <foreignObject>, and the failure
 * mode is an invisible headline in the downloaded PNG. An SVG gradient fill is
 * native to the rasterizer, so it always survives the export.
 */
function GoldHeadline({
  text,
  fontSize,
  width,
  u,
  letterSpacing = 0,
  gid,
}: {
  text: string
  fontSize: number
  width: number
  u: number
  letterSpacing?: number
  gid: string
}) {
  const height = fontSize * 1.06
  const baseline = fontSize * 0.8
  const common = {
    x: "50%",
    textAnchor: "middle" as const,
    fontFamily: DISPLAY,
    fontWeight: 900,
    fontSize,
    letterSpacing,
  }
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: "block", overflow: "visible" }}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={GOLD_PALE} />
          <stop offset="22%" stopColor={GOLD_LIGHT} />
          <stop offset="46%" stopColor={GOLD} />
          <stop offset="68%" stopColor={GOLD_DEEP} />
          <stop offset="86%" stopColor={GOLD} />
          <stop offset="100%" stopColor={GOLD_LIGHT} />
        </linearGradient>
      </defs>
      {/* extruded lip + drop shadow, then the metal face on top */}
      <text {...common} y={baseline + 4 * u} fill="rgba(0,0,0,0.55)">{text}</text>
      <text {...common} y={baseline + 3 * u} fill={GOLD_DEEP}>{text}</text>
      <text {...common} y={baseline} fill={`url(#${gid})`}>{text}</text>
    </svg>
  )
}

/* ── Confetti ──────────────────────────────────────────────────────────────
   Deterministic positions (no Math.random) so SSR and export agree.         */
const CONFETTI: Array<[number, number, number, number]> = [
  [5, 3, 18, 0.95], [13, 9, -32, 0.8], [22, 2, 55, 0.7], [31, 12, -14, 0.85],
  [42, 5, 28, 0.7], [58, 3, -48, 0.85], [67, 10, 36, 0.62], [76, 6, -22, 0.9],
  [86, 2, 44, 0.78], [93, 11, -38, 0.7], [3, 19, 12, 0.6], [96, 22, -20, 0.58],
  [8, 28, 40, 0.5], [91, 31, -30, 0.5], [49, 1, 16, 0.6], [35, 24, -52, 0.45],
  [63, 26, 30, 0.45],
]

function Confetti({ u }: { u: number }) {
  return (
    <>
      {CONFETTI.map(([left, top, rot, op], i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: `${left}%`,
            top: `${top}%`,
            width: (i % 3 === 0 ? 17 : 12) * u,
            height: (i % 4 === 0 ? 7 : 5) * u,
            borderRadius: 2 * u,
            background: i % 2 === 0 ? GOLD : GOLD_LIGHT,
            opacity: op,
            transform: `rotate(${rot}deg)`,
          }}
        />
      ))}
    </>
  )
}

function Crown({ size }: { size: number }) {
  return (
    <svg width={size} height={size * 0.74} viewBox="0 0 100 74" fill="none" style={{ display: "block" }}>
      <defs>
        <linearGradient id="crownGold" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={GOLD_PALE} />
          <stop offset="38%" stopColor={GOLD_LIGHT} />
          <stop offset="72%" stopColor={GOLD} />
          <stop offset="100%" stopColor={GOLD_DEEP} />
        </linearGradient>
      </defs>
      <path d="M10 62 L4 22 L27 40 L50 10 L73 40 L96 22 L90 62 Z" fill="url(#crownGold)" stroke={GOLD_DEEP} strokeWidth="1.5" />
      <rect x="9" y="60" width="82" height="10" rx="3.5" fill="url(#crownGold)" stroke={GOLD_DEEP} strokeWidth="1.3" />
      <circle cx="50" cy="65.5" r="3.1" fill="#7d1f2f" />
      <circle cx="30" cy="65.5" r="2.3" fill="#7d1f2f" opacity="0.85" />
      <circle cx="70" cy="65.5" r="2.3" fill="#7d1f2f" opacity="0.85" />
      <circle cx="50" cy="7" r="6.2" fill="url(#crownGold)" stroke={GOLD_DEEP} strokeWidth="1.3" />
      <circle cx="4" cy="19" r="5.2" fill="url(#crownGold)" stroke={GOLD_DEEP} strokeWidth="1.3" />
      <circle cx="96" cy="19" r="5.2" fill="url(#crownGold)" stroke={GOLD_DEEP} strokeWidth="1.3" />
    </svg>
  )
}

/* ── Laurel ────────────────────────────────────────────────────────────────
   A wreath half: lance-shaped leaves alternate along both sides of a curving
   stem, each one tangent to the curve, so the pair cradles the wordmark the
   way a printed award does. Positions and angles come from evaluating a cubic
   Bézier and its derivative, which keeps every leaf aligned to the stem.     */

type Pt = [number, number]
const P0: Pt = [88, 14]
const P1: Pt = [22, 54]
const P2: Pt = [6, 132]
const P3: Pt = [58, 204]

const bez = (a: number, b: number, c: number, d: number, t: number) => {
  const s = 1 - t
  return s * s * s * a + 3 * s * s * t * b + 3 * s * t * t * c + t * t * t * d
}
const bezD = (a: number, b: number, c: number, d: number, t: number) => {
  const s = 1 - t
  return 3 * s * s * (b - a) + 6 * s * t * (c - b) + 3 * t * t * (d - c)
}

/** One lance leaf, drawn from the origin pointing along +x. */
function Leaf({ len, fill, stroke }: { len: number; fill: string; stroke: string }) {
  const wid = len * 0.42
  return (
    <>
      <path
        d={`M0 0 Q ${len * 0.42} ${-wid} ${len} 0 Q ${len * 0.42} ${wid} 0 0 Z`}
        fill={fill}
        stroke={stroke}
        strokeWidth={len * 0.035}
      />
      {/* midrib */}
      <path d={`M${len * 0.08} 0 L ${len * 0.9} 0`} stroke={stroke} strokeWidth={len * 0.03} opacity="0.55" />
    </>
  )
}

function Laurel({ height, flip }: { height: number; flip?: boolean }) {
  const gid = `laurelGold${flip ? "R" : "L"}`
  const N = 8
  const leaves: React.ReactNode[] = []

  for (let i = 0; i < N; i++) {
    const t = 0.05 + (i / (N - 1)) * 0.9
    const x = bez(P0[0], P1[0], P2[0], P3[0], t)
    const y = bez(P0[1], P1[1], P2[1], P3[1], t)
    const dx = bezD(P0[0], P1[0], P2[0], P3[0], t)
    const dy = bezD(P0[1], P1[1], P2[1], P3[1], t)
    const tangent = (Math.atan2(dy, dx) * 180) / Math.PI
    // Fullest leaves at the middle of the branch, tapering at both tips.
    const len = 46 - Math.abs(t - 0.5) * 34
    // Outer leaves splay away from the wordmark, inner ones tuck toward it.
    for (const side of [-1, 1] as const) {
      leaves.push(
        <g key={`${i}-${side}`} transform={`translate(${x} ${y}) rotate(${tangent + side * 62})`}>
          <Leaf len={len * (side === -1 ? 1 : 0.82)} fill={`url(#${gid})`} stroke={GOLD_DEEP} />
        </g>,
      )
    }
  }

  return (
    <svg
      width={height * 0.52}
      height={height}
      viewBox="0 0 110 218"
      fill="none"
      style={{ display: "block", transform: flip ? "scaleX(-1)" : undefined }}
    >
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={GOLD_PALE} />
          <stop offset="34%" stopColor={GOLD_LIGHT} />
          <stop offset="72%" stopColor={GOLD} />
          <stop offset="100%" stopColor={GOLD_DEEP} />
        </linearGradient>
      </defs>
      {/* stem */}
      <path
        d={`M${P0[0]} ${P0[1]} C${P1[0]} ${P1[1]} ${P2[0]} ${P2[1]} ${P3[0]} ${P3[1]}`}
        stroke={GOLD}
        strokeWidth="2.6"
        fill="none"
        strokeLinecap="round"
      />
      {leaves}
    </svg>
  )
}

function Stars({ u, count = 5 }: { u: number; count?: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 * u }}>
      {Array.from({ length: count }, (_, i) => (
        <svg key={i} width={30 * u} height={30 * u} viewBox="0 0 24 24" style={{ display: "block" }}>
          <path
            d="M12 1.6l3.1 6.55 7.15.92-5.2 4.9 1.3 7.03L12 17.6l-6.35 3.4 1.3-7.03-5.2-4.9 7.15-.92z"
            fill={GOLD}
            stroke={GOLD_DEEP}
            strokeWidth="0.7"
          />
        </svg>
      ))}
    </div>
  )
}

/**
 * Small gold glyph used on the stat cards and pillars. Drawn as strokes: at
 * 40-odd pixels a line icon stays legible where a filled silhouette turns to
 * mush.
 */
function Glyph({ size, d }: { size: number; d: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={{ display: "block" }}>
      <path d={d} stroke={GOLD} strokeWidth="1.7" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

const ICON_COINS =
  "M4 7.5c0-1.6 3.6-2.8 8-2.8s8 1.2 8 2.8-3.6 2.8-8 2.8-8-1.2-8-2.8z M4 7.5v4.2c0 1.6 3.6 2.8 8 2.8s8-1.2 8-2.8V7.5 M4 11.7v4.3c0 1.6 3.6 2.8 8 2.8s8-1.2 8-2.8v-4.3"
const ICON_DEAL = "M9 6V4h6v2 M3.5 6.5h17v13h-17z M3.5 11.5h17 M12 11.5v2"
const ICON_CALENDAR = "M5 5.5h14v14H5z M5 10.5h14 M9 3v4 M15 3v4 M9 14.5h2"

const PILLARS: Array<{ label1: string; label2: string; d: string }> = [
  {
    label1: "TRUSTED",
    label2: "EXPERTS",
    d: "M12 3l8 3v5.5c0 4.4-3.3 7.6-8 9-4.7-1.4-8-4.6-8-9V6z M8.8 12l2.2 2.2 4.2-4.4",
  },
  {
    label1: "CLIENT",
    label2: "FOCUSED",
    d: "M9 10.6a3 3 0 100-6 3 3 0 000 6z M2.5 20a6.5 6.5 0 0113 0 M16.2 5.6a2.8 2.8 0 010 5.2 M17.5 20h4a4.6 4.6 0 00-3.4-4.4",
  },
  { label1: "PROVEN", label2: "RESULTS", d: "M3.5 17.5l5.5-5.5 3.5 3.5 7-7 M16 8.5h4.5V13" },
  {
    label1: "PREMIUM",
    label2: "SERVICE",
    d: "M12 2.5l3 6.6 7.2.9-5.3 4.9 1.4 7.1L12 18.5l-6.3 3.5 1.4-7.1L1.8 10l7.2-.9z",
  },
]

const money = (n: number) => {
  const v = Number(n || 0)
  if (v >= 999_500) {
    const m = v / 1_000_000
    return `${m.toFixed(m >= 10 ? 1 : 2)}M`
  }
  if (v >= 1_000) return `${Math.round(v / 1_000)}K`
  return v.toLocaleString("en-US")
}

const ROLE_TITLES: Record<string, string> = {
  agent: "REAL ESTATE CONSULTANT",
  team_leader: "TEAM LEADER",
  unit_manager: "UNIT MANAGER",
  secretary: "SALES SECRETARY",
  team_secretary: "TEAM SECRETARY",
}

/** Small diamond ornament flanking the footer rules. */
function Ornament({ u }: { u: number }) {
  return (
    <svg width={13 * u} height={13 * u} viewBox="0 0 12 12" style={{ display: "block" }}>
      <path d="M6 0l6 6-6 6L0 6z" fill={GOLD} opacity="0.85" />
    </svg>
  )
}

export type TopSellerPosterProps = {
  format: PosterFormatId
  award: AwardId
  name: string
  roleTitle: string
  photoUrl: string | null
  deals: number
  value: number
  periodLabel: string
  showStats: boolean
  message: string
}

export const TopSellerPoster = forwardRef<HTMLDivElement, TopSellerPosterProps>(function TopSellerPoster(
  { format, award, name, roleTitle, photoUrl, deals, value, periodLabel, showStats, message },
  ref,
) {
  const { w, h } = POSTER_FORMATS[format]
  const u = w / 1080
  const compact = format === "square"
  const art = AWARDS.find((a) => a.id === award) ?? AWARDS[0]

  // Story is the tallest canvas, so it gets the biggest badge; portrait has to
  // fit the same stack into 300px less, and square drops the pillars entirely.
  const roomy = format === "story"
  const titleSize = (compact ? 168 : roomy ? 218 : 188) * u
  const photo = (compact ? 244 : roomy ? 320 : 272) * u
  const upperName = name.toUpperCase()
  const nameSize = upperName.length > 26 ? 50 * u : upperName.length > 20 ? 60 * u : 72 * u

  const stats: Array<{ label: string; value: string; d: string }> = [
    { label: "TOTAL SALES", value: `${money(value)} AED`, d: ICON_COINS },
    { label: deals === 1 ? "DEAL CLOSED" : "DEALS CLOSED", value: String(deals), d: ICON_DEAL },
    { label: "PERIOD", value: periodLabel, d: ICON_CALENDAR },
  ]

  if (format === "certificate" || format === "monthly") {
    const c = CERTIFICATES[format]
    // The artwork is authored at exactly this size, so its own pixels are the
    // layout units — no scaling factor needed.
    const nameText = name.trim().toUpperCase()
    // Fit to the rule beneath it rather than stepping through fixed sizes: a
    // 22-character name at a fixed 64px overran the divider and crowded the
    // medallion. ~0.62em average advance for bold display caps.
    const nameSizePx = Math.max(
      26,
      Math.min(64, Math.floor(c.name.maxWidth / (0.62 * Math.max(1, nameText.length)))),
    )
    const slotValues = [`${money(value)} AED`, String(deals), periodLabel]
    return (
      <div
        ref={ref}
        style={{
          width: w,
          height: h,
          position: "relative",
          overflow: "hidden",
          background: "#ffffff",
          fontFamily: BODY,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={c.src}
          alt=""
          width={w}
          height={h}
          style={{ position: "absolute", inset: 0, width: w, height: h, objectFit: "cover" }}
        />

        {/* Honouree photo, clipped to the medallion. */}
        {photoUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={proxied(photoUrl)}
            alt=""
            style={{
              position: "absolute",
              left: c.photo.cx - c.photo.d / 2,
              top: c.photo.cy - c.photo.d / 2,
              width: c.photo.d,
              height: c.photo.d,
              borderRadius: "50%",
              objectFit: "cover",
              objectPosition: "center top",
            }}
          />
        ) : null}

        {/* Recipient. */}
        <div
          style={{
            position: "absolute",
            left: c.name.cx - c.name.maxWidth / 2,
            top: c.name.baseline - nameSizePx,
            width: c.name.maxWidth,
            textAlign: "center",
            fontFamily: DISPLAY,
            fontSize: nameSizePx,
            lineHeight: 1,
            fontWeight: 700,
            letterSpacing: 1,
            color: NAVY_DEEP,
            whiteSpace: "nowrap",
            overflow: "hidden",
          }}
        >
          {nameText}
        </div>

        {/* Month banner (monthly certificate only). */}
        {c.month && (
          <div
            style={{
              position: "absolute",
              left: c.month.cx - c.month.maxWidth / 2,
              top: c.month.baseline - c.month.size,
              width: c.month.maxWidth,
              textAlign: "center",
              fontFamily: DISPLAY,
              fontSize: c.month.size,
              lineHeight: 1,
              fontWeight: 700,
              letterSpacing: 1,
              color: NAVY_DEEP,
              whiteSpace: "nowrap",
              overflow: "hidden",
            }}
          >
            {periodLabel}
          </div>
        )}

        {/* Total sales · deals closed · period, on their rules. */}
        {c.slots.map((slot, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              left: slot.cx - 110,
              top: slot.baseline - 26,
              width: 220,
              textAlign: "center",
              fontFamily: DISPLAY,
              fontSize: slotValues[i].length > 14 ? 20 : 24,
              lineHeight: "26px",
              fontWeight: 700,
              color: NAVY_DEEP,
              whiteSpace: "nowrap",
              overflow: "hidden",
            }}
          >
            {slotValues[i]}
          </div>
        ))}
      </div>
    )
  }

  return (
    <div
      ref={ref}
      style={{
        width: w,
        height: h,
        position: "relative",
        overflow: "hidden",
        background: NAVY_DEEP,
        fontFamily: BODY,
      }}
    >
      {/* ── Full-bleed night skyline ─────────────────────────────────────── */}
      {/* Scaled around the city side of the plate: its left third is a daytime
          villa, and objectPosition can't crop that out on its own — the
          transform is what pushes the villa out of frame. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={proxied(SKYLINE)}
        alt=""
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          objectPosition: "50% 50%",
          transform: "scale(1.5)",
          transformOrigin: "70% 72%",
          // Daytime stock shot → gold-lit night skyline.
          filter: "saturate(0.5) brightness(0.5) sepia(0.5) hue-rotate(-6deg) contrast(1.4)",
        }}
      />
      {/* Deep navy above the skyline, gold glow along the horizon. */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `linear-gradient(180deg, ${NAVY_DEEP} 0%, rgba(0,20,44,0.95) 26%, rgba(0,26,54,0.66) 46%, rgba(0,20,44,0.6) 72%, rgba(0,14,32,0.95) 100%)`,
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(58% 26% at 50% 60%, rgba(214,179,87,0.26) 0%, rgba(214,179,87,0) 72%)`,
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(120% 62% at 50% 4%, rgba(20,58,104,0.75) 0%, rgba(0,17,42,0) 62%)`,
        }}
      />

      {/* ── Gold frame: concentric corner sweeps ─────────────────────────── */}
      {[
        { inset: 0.0, weight: 15, color: GOLD, op: 1 },
        { inset: 0.035, weight: 4, color: GOLD_LIGHT, op: 0.62 },
        { inset: 0.062, weight: 2, color: GOLD, op: 0.4 },
      ].map((ring, i) => (
        <React.Fragment key={i}>
          <div
            style={{
              position: "absolute",
              left: -0.28 * w + ring.inset * w,
              top: -0.055 * h + ring.inset * h,
              width: (1.56 - 2 * ring.inset) * w,
              height: (0.5 - ring.inset) * h,
              borderRadius: "50%",
              border: `${ring.weight * u}px solid transparent`,
              borderTopColor: ring.color,
              opacity: ring.op,
              filter: i === 0 ? `drop-shadow(0 ${3 * u}px ${10 * u}px rgba(0,0,0,0.55))` : undefined,
            }}
          />
          <div
            style={{
              position: "absolute",
              left: -0.28 * w + ring.inset * w,
              bottom: -0.05 * h + ring.inset * h,
              width: (1.56 - 2 * ring.inset) * w,
              height: (0.44 - ring.inset) * h,
              borderRadius: "50%",
              border: `${ring.weight * u}px solid transparent`,
              borderBottomColor: ring.color,
              opacity: ring.op,
              filter: i === 0 ? `drop-shadow(0 ${-3 * u}px ${10 * u}px rgba(0,0,0,0.55))` : undefined,
            }}
          />
        </React.Fragment>
      ))}
      <Confetti u={u} />

      {/* ── Content ──────────────────────────────────────────────────────── */}
      <div
        style={{
          position: "relative",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          textAlign: "center",
          padding: `${(compact ? 40 : 52) * u}px ${56 * u}px ${(compact ? 32 : 42) * u}px`,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={LOGO_WHITE}
          alt="FHI Global"
          style={{ height: (compact ? 74 : 94) * u, width: "auto", display: "block", objectFit: "contain" }}
        />

        {/* crown + wordmark inside the laurel wreath */}
        <div style={{ marginTop: (compact ? 6 : 12) * u, display: "flex", alignItems: "center", gap: 0 }}>
          <Laurel height={(compact ? 254 : roomy ? 330 : 292) * u} />
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", margin: `0 ${-14 * u}px` }}>
            <Crown size={(compact ? 118 : 150) * u} />
            <div style={{ marginTop: -10 * u }}>
              <GoldHeadline
                gid="awardLine1"
                text={art.line1}
                fontSize={titleSize}
                width={0.62 * w}
                u={u}
                letterSpacing={-2 * u}
              />
            </div>
            <p
              style={{
                margin: `${-14 * u}px 0 0`,
                fontFamily: DISPLAY,
                fontWeight: 900,
                fontSize: titleSize * 0.88,
                lineHeight: 0.92,
                letterSpacing: -1 * u,
                ...whiteText(u),
              }}
            >
              {art.line2}
            </p>
          </div>
          <Laurel height={(compact ? 254 : roomy ? 330 : 292) * u} flip />
        </div>

        <div style={{ marginTop: (compact ? 2 : 8) * u }}>
          <Stars u={u} />
        </div>

        {/* honoree portrait */}
        <div style={{ position: "relative", marginTop: (compact ? 12 : roomy ? 26 : 16) * u }}>
          <div
            style={{
              width: photo,
              height: photo,
              borderRadius: "50%",
              padding: 8 * u,
              background: GOLD_METAL,
              boxShadow: `0 ${16 * u}px ${44 * u}px rgba(0,0,0,0.6)`,
            }}
          >
            <div
              style={{
                width: "100%",
                height: "100%",
                borderRadius: "50%",
                overflow: "hidden",
                background: "#eef2f7",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {photoUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={proxied(photoUrl)}
                  alt=""
                  style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "50% 20%" }}
                />
              ) : (
                <span style={{ fontFamily: DISPLAY, fontWeight: 900, fontSize: photo * 0.4, color: GOLD_DEEP }}>
                  {(name.trim()[0] ?? "A").toUpperCase()}
                </span>
              )}
            </div>
          </div>
          {/* FHI seal */}
          <div
            style={{
              position: "absolute",
              bottom: -10 * u,
              left: "50%",
              transform: "translateX(-50%)",
              width: 74 * u,
              height: 74 * u,
              borderRadius: "50%",
              background: GOLD_METAL,
              border: `${2.5 * u}px solid ${GOLD_DEEP}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: `0 ${7 * u}px ${18 * u}px rgba(0,0,0,0.5)`,
            }}
          >
            <span style={{ fontFamily: DISPLAY, fontWeight: 900, fontSize: 28 * u, color: NAVY_DEEP }}>FHI</span>
          </div>
        </div>

        {/* name + role */}
        <p
          style={{
            margin: `${(compact ? 20 : roomy ? 34 : 24) * u}px 0 0`,
            fontFamily: SCRIPT,
            fontSize: (roomy ? 74 : 66) * u,
            lineHeight: 1.1,
            color: GOLD,
            textShadow: `0 ${3 * u}px ${10 * u}px rgba(0,0,0,0.5)`,
          }}
        >
          Congratulations
        </p>
        <p
          style={{
            margin: `${2 * u}px 0 0`,
            fontFamily: DISPLAY,
            fontWeight: 900,
            fontSize: nameSize,
            lineHeight: 1.05,
            letterSpacing: 0.5 * u,
            color: "#ffffff",
            textShadow: `0 ${4 * u}px ${14 * u}px rgba(0,0,0,0.6)`,
          }}
        >
          {upperName}
        </p>
        {/* role with flanking rules */}
        <div style={{ marginTop: 10 * u, display: "flex", alignItems: "center", gap: 14 * u }}>
          <div style={{ width: 54 * u, height: 1.6 * u, background: `rgba(214,179,87,0.75)` }} />
          <p style={{ margin: 0, fontFamily: BODY, fontWeight: 700, fontSize: 25 * u, letterSpacing: 4 * u, color: GOLD }}>
            {roleTitle}
          </p>
          <div style={{ width: 54 * u, height: 1.6 * u, background: `rgba(214,179,87,0.75)` }} />
        </div>

        <p
          style={{
            margin: `${16 * u}px auto 0`,
            maxWidth: 0.82 * w,
            fontFamily: BODY,
            fontSize: 26 * u,
            lineHeight: 1.4,
            color: "#e4ecf7",
            textShadow: `0 ${2 * u}px ${8 * u}px rgba(0,0,0,0.6)`,
          }}
        >
          {message}
        </p>

        {/* stat cards */}
        {showStats && (
          <div style={{ marginTop: (compact ? 14 : roomy ? 26 : 18) * u, display: "flex", gap: 16 * u }}>
            {stats.map((s) => (
              <div
                key={s.label}
                style={{
                  width: (compact ? 238 : 284) * u,
                  padding: `${13 * u}px ${10 * u}px ${11 * u}px`,
                  borderRadius: 18 * u,
                  border: `${1.6 * u}px solid rgba(214,179,87,0.62)`,
                  background: "rgba(0,17,42,0.72)",
                  boxShadow: `inset 0 ${2 * u}px ${16 * u}px rgba(214,179,87,0.09)`,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 6 * u,
                }}
              >
                <Glyph size={40 * u} d={s.d} />
                <p style={{ margin: 0, fontFamily: DISPLAY, fontWeight: 900, fontSize: 44 * u, lineHeight: 1.05, color: "#ffffff" }}>
                  {s.value}
                </p>
                <p style={{ margin: 0, fontFamily: BODY, fontWeight: 700, fontSize: 17 * u, letterSpacing: 2.4 * u, color: GOLD }}>
                  {s.label}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* footer */}
        <div style={{ marginTop: "auto", width: "100%", display: "flex", flexDirection: "column", alignItems: "center" }}>
          {!compact && (
            <div style={{ display: "flex", alignItems: "stretch", justifyContent: "center" }}>
              {PILLARS.map((p, i) => (
                <div
                  key={p.label1}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 7 * u,
                    padding: `0 ${28 * u}px`,
                    borderLeft: i === 0 ? undefined : `${1.5 * u}px solid rgba(214,179,87,0.42)`,
                  }}
                >
                  <Glyph size={38 * u} d={p.d} />
                  <div style={{ lineHeight: 1.18 }}>
                    <p style={{ margin: 0, fontFamily: BODY, fontSize: 19 * u, fontWeight: 700, letterSpacing: 1.8 * u, color: GOLD }}>
                      {p.label1}
                    </p>
                    <p style={{ margin: 0, fontFamily: BODY, fontSize: 19 * u, fontWeight: 700, letterSpacing: 1.8 * u, color: GOLD }}>
                      {p.label2}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* THANK YOU with ornaments */}
          <div style={{ marginTop: (compact ? 12 : roomy ? 24 : 16) * u, display: "flex", alignItems: "center", gap: 16 * u }}>
            <Ornament u={u} />
            <GoldHeadline gid="thankYou" text="THANK YOU" fontSize={44 * u} width={0.46 * w} u={u} letterSpacing={8 * u} />
            <Ornament u={u} />
          </div>
          <p
            style={{
              margin: `${12 * u}px 0 0`,
              fontFamily: BODY,
              fontWeight: 600,
              fontSize: 21 * u,
              letterSpacing: 3.8 * u,
              color: "#cfdaea",
            }}
          >
            FOR YOUR TRUST &amp; CONFIDENCE
          </p>
        </div>
      </div>
    </div>
  )
})

/** Map a profile role to the title printed under the name. */
export function roleTitleFor(role: string | null): string {
  return ROLE_TITLES[(role ?? "").toLowerCase().trim()] ?? "REAL ESTATE CONSULTANT"
}
