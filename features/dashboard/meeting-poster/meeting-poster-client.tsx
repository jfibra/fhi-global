"use client"

// Meeting Poster — Agent Resource studio. Compose a branded event /
// business-presentation poster: FOUR DESIGNS (Business Meeting, Golden Invite
// dark/light, Photo Collage), portrait-only
// (1080 wide; Business Meeting height hugs its content). Speakers come from the live agent directory (up to six, reorderable,
// per-speaker editable role). Exports as PNG via the shared flyer capture.

import { Fragment, useEffect, useMemo, useRef, useState } from "react"
import {
  ArrowDown, ArrowUp, CalendarDays, Check, CheckCircle2, Clock, Download, Globe,
  ImagePlus, Loader2, Mail, MapPin, Phone, Presentation, Search, Trash2, User,
} from "lucide-react"
import { capturePng, warmFontEmbedCSS } from "@/lib/flyer/capture"
import { compressImageForUpload } from "@/lib/upload/compress-image"
import { isSafeRemoteImageUrl } from "@/lib/image-hosts"

const MAX_SPEAKERS = 6

const GOLD = "#d6b357"
const NAVY = "#001f3f"
const INK = "#0a1628"

// ─── Formats & designs ─────────────────────────────────────────────────────────

// Default canvas is portrait 1080×1350 (Business Meeting height is auto);
// designs may override with their own dimensions.
const POSTER_W = 1080
const POSTER_H = 1350
const DESIGN_SIZES: Partial<Record<DesignId, { w: number; h: number }>> = {
  premier: { w: 1920, h: 1280 },
}

type DesignId = "meeting" | "invite" | "premier" | "collage"
const DESIGNS: { id: DesignId; label: string; desc: string; chip: string }[] = [
  { id: "meeting", label: "Business Meeting", desc: "Navy & gold executive invite with speaker cards", chip: `linear-gradient(180deg,#0d1522,#050a12)` },
  { id: "invite", label: "Golden Invite", desc: "Serif seminar invite — circles & topics checklist", chip: "linear-gradient(180deg,#0a1424,#04080f)" },
  { id: "collage", label: "Photo Collage", desc: "Hero photo, bold title & portrait speaker tiles", chip: `linear-gradient(180deg,${INK}cc,${INK})` },
  { id: "premier", label: "Landscape Meeting", desc: "Wide navy & gold invite — skyline right, speaker cards", chip: "linear-gradient(120deg,#0a1220 55%,#1a2740)" },
]

// ─── Logos (multi-select, like the Reels brand picker) ─────────────────────────

type LogoOption = {
  id: string
  name: string
  /** Art for dark poster backgrounds (white/gold, or colored → gets a light chip). */
  src: string
  /** Dedicated art for light backgrounds; colored logos don't need one. */
  lightSrc?: string
  /** White/gold art — needs a navy chip when the poster page is light. */
  whiteArt: boolean
  /** Dark-colored art that gets a thin white halo on dark themes. */
  outlineOnDark?: boolean
  /** Render-time size multiplier (1 = base size), set from the editor sliders. */
  scale?: number
}

// Same brand set as the Reels Maker (features/dashboard/reels-maker BRANDS).
const LOGO_OPTIONS: LogoOption[] = [
  { id: "filipinohomes", name: "Filipino Homes", src: "/logos/Filipinohomes-logo-side-left-white.png", lightSrc: "/logos/filipinohomes-colored.png", whiteArt: true },
  { id: "fhipartners", name: "FH Global Partners", src: "/logos/global_partner.png", lightSrc: "/logos/global_partner.png", whiteArt: true, outlineOnDark: true },
  { id: "fhiglobal", name: "FHI Global Property", src: "/FHI_Branding_White.png", lightSrc: "/logos/FHI_Branding Set_PNG Copies-02.png", whiteArt: true },
  // Transparent art works on both themes directly — whiteArt + lightSrc keep it chip-free.
  { id: "rentsouq", name: "Rentsouq AE", src: "/logos/rentsouq-transparent.png", lightSrc: "/logos/rentsouq-transparent.png", whiteArt: true },
]

/** Renders the selected logos in a row (or stacked), picking per-background art
 *  and dropping a contrast chip behind art that would vanish otherwise. */
function LogoRow({ logos, dark, size, stack }: { logos: LogoOption[]; dark: boolean; size: number; stack?: boolean }) {
  if (logos.length === 0) return null
  return (
    <div className={stack ? "flex flex-col items-end" : "flex items-center"} style={{ gap: stack ? 18 : 0 }}>
      {logos.map((l) => {
        const src = !dark && l.lightSrc ? l.lightSrc : l.src
        const chip = dark ? !l.whiteArt : l.whiteArt && !l.lightSrc
        const hgt = Math.round(size * (l.scale ?? 1))
        return (
          <Fragment key={l.id}>
            {chip ? (
              <span className="flex items-center px-3 py-1.5" style={{ backgroundColor: dark ? "#f6f4ee" : NAVY }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt={l.name} style={{ height: Math.round(hgt * 0.7), width: "auto" }} />
              </span>
            ) : (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={src}
                alt={l.name}
                style={{
                  height: hgt,
                  width: "auto",
                  filter: dark && l.outlineOnDark
                    ? "drop-shadow(0 0 1px #ffffff) drop-shadow(0 0 1px #ffffff) drop-shadow(0 0 2px rgba(255,255,255,0.9))"
                    : undefined,
                }}
              />
            )}
          </Fragment>
        )
      })}
    </div>
  )
}


/** Remote photos go through the same-origin image proxy — profile photos
 *  (Google avatars, S3) rarely send CORS headers, and a bare remote URL would
 *  both fail to render and taint the PNG export. */
function displayImg(url: string): string {
  return isSafeRemoteImageUrl(url) ? `/api/image-proxy?url=${encodeURIComponent(url)}` : url
}

type SpeakerOption = { id: string; name: string; photo: string }
type Speaker = SpeakerOption & { role: string; topic: string }

type PosterData = {
  title: string
  subtitle: string
  tagline: string
  date: string
  time: string
  venue: string
  /** Discussion topics, one per line — the Golden Invite checklist. */
  topics: string
  contactPhone: string
  contactEmail: string
  background: string
}

const DEFAULTS: PosterData = {
  title: "BUSINESS\nMEETING",
  subtitle: "Join industry leaders and experts as we discuss key insights, innovative strategies, and opportunities for future growth.",
  tagline: "DISCUSS • STRATEGIZE • GROW TOGETHER",
  date: "MAY 25, 2026\nSUNDAY",
  time: "10:00 AM\nTO 01:00 PM",
  venue: "FHI GLOBAL OFFICE\nDUBAI, UAE",
  topics: "Dubai Real Estate Market Outlook\nInvestment Opportunities in 2026\nStrategies for Smart Investors\nBuilding Long-Term Wealth",
  contactPhone: "",
  contactEmail: "",
  background: "",
}

type PosterProps = {
  data: PosterData
  speakers: Speaker[]
  w: number
  h: number
  portrait: boolean
  logos: LogoOption[]
  /** Light (ivory) theme — dark navy when false. */
  light: boolean
}

// ─── Shared poster bits ────────────────────────────────────────────────────────

function DetailRow({ data, light, size = 21, align = "center" }: { data: PosterData; light?: boolean; size?: number; align?: "center" | "start" }) {
  const items = [
    { icon: CalendarDays, text: data.date },
    { icon: Clock, text: data.time },
    { icon: MapPin, text: data.venue },
  ].filter((c) => c.text.trim())
  if (items.length === 0) return null
  return (
    <div className={`flex flex-wrap items-center gap-x-8 gap-y-2 ${align === "start" ? "justify-start" : "justify-center"}`}>
      {items.map(({ icon: Icon, text }, i) => {
        const [first, ...rest] = text.split("\n")
        return (
          <div
            key={i}
            className="flex min-w-0 items-center gap-3"
            style={i < items.length - 1 ? { paddingRight: 32, borderRight: `1px solid ${light ? "rgba(0,31,63,0.18)" : "rgba(255,255,255,0.18)"}` } : undefined}
          >
            <Icon className="shrink-0" style={{ color: GOLD, width: size + 4, height: size + 4 }} strokeWidth={1.8} />
            <span className="min-w-0">
              <span className="block truncate font-semibold leading-tight" style={{ fontSize: size, color: light ? NAVY : "#ffffff" }}>{first}</span>
              {rest.length > 0 && (
                <span className="block truncate font-semibold leading-tight" style={{ fontSize: size * 0.72, color: light ? `${NAVY}99` : "rgba(255,255,255,0.6)" }}>{rest.join(" ")}</span>
              )}
            </span>
          </div>
        )
      })}
    </div>
  )
}

/** Split speakers into balanced rows: ≤3 one row, 4 → 2+2, 5 → 3+2, 6 → 3+3. */
function speakerRows(speakers: Speaker[]): Speaker[][] {
  const n = speakers.length
  if (n <= 3) return n > 0 ? [speakers] : []
  if (n === 4) return [speakers.slice(0, 2), speakers.slice(2)]
  return [speakers.slice(0, 3), speakers.slice(3)]
}

/** "Our Speaker" / "Our Speakers" — singular follows the actual count. */
function speakersHeading(count: number): string {
  return count === 1 ? "Our Speaker" : "Our Speakers"
}

function SpeakerPhoto({ s, className }: { s: Speaker; className?: string }) {
  return s.photo ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={displayImg(s.photo)} alt={s.name} className={className ?? "h-full w-full object-cover object-top"} />
  ) : (
    <div className="flex h-full w-full items-center justify-center bg-[#e4ecf5]">
      <User className="h-1/3 w-1/3 text-[#9db2c9]" />
    </div>
  )
}

// ─── Design 1: Photo Collage (hero-photo navy, portrait speaker tiles) ──────────

function CollagePoster({ data, speakers, w, portrait, logos, light }: PosterProps) {
  const ink = light ? NAVY : "#ffffff"
  const subInk = light ? "#3c4451" : "rgba(255,255,255,0.85)"
  const PANEL = light ? "#ffffff" : "#0f1b2d"
  const count = Math.max(1, speakers.length)
  const perRow = count === 4 ? 2 : Math.min(count, 3)
  const tileW = portrait
    ? count <= 1 ? 440 : perRow === 2 ? 380 : 290
    : count <= 3 ? 380 : count === 4 ? 330 : 285
  const tileH = Math.min(Math.round(tileW * 1.2), 400)
  const titleLines = data.title.split("\n").filter(Boolean)
  const taglineLines = data.tagline.split("\n").filter(Boolean)
  const photo = data.background || "/background/dubai.webp"

  return (
    <div
      style={{ width: w, backgroundColor: light ? "#f6f4ef" : INK, fontFamily: "'Outfit', sans-serif" }}
      className="relative flex flex-col overflow-hidden"
    >
      {/* Full-bleed hero photo under a bottom-heavy navy scrim */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={displayImg(photo)} alt="" className="absolute inset-0 h-full w-full object-cover object-center" />
      <div className="absolute inset-0" style={{ background: light ? "linear-gradient(180deg, rgba(246,244,239,0.82) 0%, rgba(246,244,239,0.62) 30%, rgba(246,244,239,0.88) 68%, rgba(246,244,239,0.97) 100%)" : `linear-gradient(180deg, ${INK}B3 0%, ${INK}8C 30%, ${INK}E6 68%, ${INK} 100%)` }} />
      <div className="absolute inset-0" style={{ background: "radial-gradient(80% 50% at 50% 0%, rgba(214,179,87,0.10), transparent 60%)" }} />


      <div className={`relative flex flex-col ${portrait ? "px-12 pt-12" : "px-20 pt-14"}`}>
        <div className={`flex ${portrait ? "flex-col items-center text-center" : "items-start justify-between"} gap-8`}>
          <div className={portrait ? "flex flex-col items-center" : ""}>
            <LogoRow logos={logos} dark={!light} size={portrait ? 84 : 72} />
            <div className="mt-5">
              {titleLines.map((line, i) => (
                <p key={i} className={`${portrait ? "text-[76px]" : "text-[68px]"} font-black leading-[1.02] tracking-tight`} style={{ color: ink }}>
                  {line}
                </p>
              ))}
            </div>
            <div className="mt-2 h-[7px] w-[420px] max-w-full" style={{ backgroundColor: GOLD }} />
            {data.subtitle && (
              <p className="mt-5 max-w-[780px] whitespace-pre-line text-[22px] leading-relaxed" style={{ color: subInk }}>
                {data.subtitle}
              </p>
            )}
          </div>

          {!portrait && taglineLines.length > 0 && (
            <div className="pt-4 text-right">
              {taglineLines.map((line, i) => (
                <p key={i} className="text-[44px] font-black italic uppercase leading-[1.08]" style={{ color: ink }}>
                  {line}
                </p>
              ))}
              <div className="ml-auto mt-2 h-[6px] w-48" style={{ backgroundColor: GOLD }} />
            </div>
          )}
        </div>

        {speakers.length > 0 ? (
          <div className="flex flex-col items-center" style={{ marginTop: 44 }}>
            <div className="mb-7 flex items-center gap-4">
              <span className="h-[5px] w-16" style={{ backgroundColor: GOLD }} />
              <p className="text-[28px] font-black uppercase tracking-[0.24em]" style={{ color: ink }}>
                {speakersHeading(speakers.length)}
              </p>
              <span className="h-[5px] w-16" style={{ backgroundColor: GOLD }} />
            </div>
            <div className="flex w-full flex-col items-center" style={{ gap: portrait ? 34 : 26 }}>
              {speakerRows(speakers).map((row, r) => (
                <div key={r} className="flex flex-nowrap items-stretch justify-center" style={{ gap: 26 }}>
                  {row.map((s) => {
                    const i = speakers.indexOf(s)
                    return (
                <div
                  key={s.id}
                  className="relative flex flex-col border"
                  style={{ width: tileW, borderColor: `${GOLD}77`, backgroundColor: PANEL, boxShadow: light ? "0 24px 48px -28px rgba(0,31,63,0.35)" : "0 24px 48px -24px rgba(0,0,0,0.65)" }}
                >
                  {/* Gold corner number tag — same as Business Meeting */}
                  <span
                    className="absolute left-0 top-0 z-10 font-extrabold"
                    style={{ backgroundColor: GOLD, color: INK, fontSize: 19, padding: "6px 26px 6px 14px", clipPath: "polygon(0 0, 100% 0, 78% 100%, 0 100%)" }}
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div style={{ height: tileH }} className="w-full shrink-0 overflow-hidden">
                    <SpeakerPhoto s={s} />
                  </div>
                  <div className="flex flex-1 flex-col items-center px-3.5 pb-4 pt-3.5 text-center" style={{ borderTop: `2px solid ${GOLD}` }}>
                    <p className="text-[20px] font-extrabold uppercase leading-tight" style={{ color: GOLD }}>{s.name}</p>
                    <span className="mt-1.5 h-0.5 w-9" style={{ backgroundColor: `${GOLD}99` }} />
                    {s.role && <p className="mt-1.5 text-[14px] font-medium leading-snug" style={{ color: subInk }}>{s.role}</p>}
                    {s.topic && (
                      <>
                        <p className="mt-2 text-[11.5px] font-bold uppercase tracking-[0.28em]" style={{ color: GOLD }}>Topic</p>
                        <p className="mt-0.5 text-[13.5px] font-semibold leading-snug" style={{ color: ink }}>{s.topic}</p>
                      </>
                    )}
                  </div>
                </div>
                    )
                  })}
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <div className="relative px-12" style={{ marginTop: 40 }}>
        <GoldFooterBar data={data} light={light} />
      </div>
    </div>
  )
}

// ─── Design: Business Meeting (navy & gold executive invite) ───────────────────

const FOOTER_DIVIDER = { paddingLeft: 26, marginLeft: 26, borderLeft: "1.5px solid #d6b35733" } as const

/** Business Meeting-style footer: gold-boxed date / time / venue chips plus
 *  optional Contact Us / Email Us groups, divided by gold hairlines. */
function GoldFooterBar({ data, marginTop = 0, light }: { data: PosterData; marginTop?: number; light?: boolean }) {
  const ink = light ? NAVY : "#ffffff"
  const subInk = light ? "#3c4451" : "rgba(255,255,255,0.8)"
  const details = [
    { icon: CalendarDays, text: data.date },
    { icon: Clock, text: data.time },
    { icon: MapPin, text: data.venue },
  ].filter((d) => d.text.trim())
  return (
    <div
      className="flex w-full items-center justify-center"
      style={{ borderTop: `1px solid ${GOLD}44`, marginTop, paddingTop: 18, paddingBottom: 22, minHeight: 96 }}
    >
      {details.map(({ icon: Icon, text }, i) => {
        const [first, ...rest] = text.split("\n")
        return (
          <div key={`d-${i}`} className="flex items-center gap-3.5" style={i > 0 ? FOOTER_DIVIDER : undefined}>
            <span className="flex shrink-0 items-center justify-center rounded-[10px] border-2" style={{ width: 46, height: 46, borderColor: GOLD }}>
              <Icon style={{ color: GOLD, width: 24, height: 24 }} strokeWidth={1.9} />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[19px] font-extrabold uppercase leading-tight" style={{ color: ink }}>{first}</span>
              {rest.length > 0 && (
                <span className="block truncate text-[14px] font-semibold uppercase leading-tight" style={{ color: subInk }}>{rest.join(" ")}</span>
              )}
            </span>
          </div>
        )
      })}
      {data.contactPhone && (
        <div className="flex min-w-0 items-center gap-3.5" style={details.length > 0 ? FOOTER_DIVIDER : undefined}>
          <span className="flex shrink-0 items-center justify-center rounded-full border-2" style={{ width: 46, height: 46, borderColor: GOLD }}>
            <Phone style={{ color: GOLD, width: 20, height: 20 }} strokeWidth={1.8} />
          </span>
          <span className="min-w-0">
            <span className="block text-[15px] font-bold uppercase" style={{ color: ink }}>Contact Us</span>
            <span className="block truncate text-[15px] font-semibold" style={{ color: subInk }}>{data.contactPhone}</span>
          </span>
        </div>
      )}
      {data.contactEmail && (
        <div className="flex min-w-0 items-center gap-3.5" style={details.length > 0 || data.contactPhone ? FOOTER_DIVIDER : undefined}>
          <span className="flex shrink-0 items-center justify-center rounded-full border-2" style={{ width: 46, height: 46, borderColor: GOLD }}>
            <Mail style={{ color: GOLD, width: 20, height: 20 }} strokeWidth={1.8} />
          </span>
          <span className="min-w-0">
            <span className="block text-[15px] font-bold uppercase" style={{ color: ink }}>Email Us</span>
            <span className="block truncate text-[15px] font-semibold" style={{ color: subInk }}>{data.contactEmail}</span>
          </span>
        </div>
      )}
    </div>
  )
}

function MeetingPoster({ data, speakers, w, h, portrait, logos, light }: PosterProps) {
  const BG = light ? "#f6f4ef" : "#0d1522"
  const PANEL = light ? "#ffffff" : "#0f1b2d"
  const ink = light ? NAVY : "#ffffff"
  const subInk = light ? "#3c4451" : "rgba(255,255,255,0.85)"
  const titleLines = data.title.split("\n").filter(Boolean)
  const desc = data.subtitle.trim()
  const n = Math.max(speakers.length, 1)

  // ── Fixed size budgets so nothing ever overflows the canvas ──
  // Every zone below is measured against the poster height; the speakers zone
  // takes whatever remains and its card photo height is derived from it.
  const pad = portrait ? 56 : 72
  const innerW = w - pad * 2
  // Landscape with 1–3 speakers: title on the left, speakers on the right.
  const split = !portrait && speakers.length > 0 && speakers.length <= 3
  const gap = 24
  // Rows are balanced (4 → 2+2, 5 → 3+2), so cards size to the widest row.
  const perRow = n === 4 ? 2 : Math.min(n, 3)
  const cardW = Math.min(
    n === 1 ? 460 : n === 2 ? 400 : n === 4 ? 380 : 340,
    Math.floor(((split ? Math.floor(w * 0.44) : innerW) - gap * (perRow - 1)) / perRow),
  )
  // Portrait hugs its content (auto canvas height): photos size from the card
  // width alone. Landscape keeps the fixed 16:9 canvas, so photos take what
  // the header / heading / bottom bar leave over.
  const speakersBudget = split ? h - 40 - 96 - 84 - 96 - 40 : h - 40 - 310 - 84 - 96 - 16
  const panelMin = 150
  const photoH = portrait
    ? Math.min(Math.round(cardW * 1.2), 400)
    : Math.max(150, Math.min(Math.round(cardW * 1.3), speakersBudget - panelMin))

  const logoArt = (
    <div className="shrink-0">
      <LogoRow logos={logos} dark={!light} size={portrait ? 84 : 72} stack={portrait} />
    </div>
  )

  const speakerCards = speakers.length > 0 && (
    <div className="flex w-full flex-col items-center">
      {/* Script heading with gold rules */}
      <div className="flex w-full items-center justify-center gap-5">
        <span className="text-[13px]" style={{ color: GOLD }}>◆</span>
        <span className="h-px flex-1" style={{ maxWidth: 170, backgroundColor: `${GOLD}88` }} />
        <p
          className="shrink-0"
          style={{ fontFamily: "'Snell Roundhand', 'Brush Script MT', 'Segoe Script', cursive", color: GOLD, fontSize: 62, lineHeight: 1.15 }}
        >
          {speakersHeading(speakers.length)}
        </p>
        <span className="h-px flex-1" style={{ maxWidth: 170, backgroundColor: `${GOLD}88` }} />
        <span className="text-[13px]" style={{ color: GOLD }}>◆</span>
      </div>
      <div className="mt-6 flex w-full flex-col items-center" style={{ gap: 28 }}>
        {speakerRows(speakers).map((row, r) => (
          <div key={r} className="flex flex-nowrap items-stretch justify-center" style={{ gap }}>
            {row.map((sp) => {
              const i = speakers.indexOf(sp)
              const small = cardW < 240
          return (
            <div key={sp.id} className="relative flex flex-col border" style={{ width: cardW, borderColor: `${GOLD}77`, backgroundColor: PANEL, boxShadow: "0 24px 48px -24px rgba(0,0,0,0.65)" }}>
              {/* Gold corner number tag */}
              <span
                className="absolute left-0 top-0 z-10 font-extrabold"
                style={{
                  backgroundColor: GOLD, color: BG, fontSize: small ? 16 : 19,
                  padding: small ? "4px 20px 4px 10px" : "6px 26px 6px 14px",
                  clipPath: "polygon(0 0, 100% 0, 78% 100%, 0 100%)",
                }}
              >
                {String(i + 1).padStart(2, "0")}
              </span>
              <div style={{ height: photoH }} className="w-full shrink-0 overflow-hidden">
                <SpeakerPhoto s={sp} />
              </div>
              <div
                className={`flex flex-1 flex-col items-center text-center ${small ? "px-2 pb-3 pt-2.5" : "px-3.5 pb-4 pt-3.5"}`}
                style={{ borderTop: `2px solid ${GOLD}` }}
              >
                <p className={`font-extrabold uppercase leading-tight ${small ? "text-[15px]" : "text-[20px]"}`} style={{ color: GOLD }}>{sp.name}</p>
                <span className="mt-1.5 h-0.5 w-9" style={{ backgroundColor: `${GOLD}99` }} />
                {sp.role && <p className={`mt-1.5 font-medium leading-snug ${small ? "text-[12px]" : "text-[14px]"}`} style={{ color: subInk }}>{sp.role}</p>}
                {sp.topic && (
                  <>
                    <p className={`mt-2 font-bold uppercase tracking-[0.28em] ${small ? "text-[10px]" : "text-[11.5px]"}`} style={{ color: GOLD }}>Topic</p>
                    <p className={`mt-0.5 font-semibold leading-snug ${small ? "text-[12px]" : "text-[13.5px]"}`} style={{ color: ink }}>{sp.topic}</p>
                  </>
                )}
              </div>
            </div>
          )
            })}
          </div>
        ))}
      </div>
    </div>
  )

  const titleBlock = (big: boolean) => (
    <>
      <h1 className="font-black uppercase tracking-tight" style={{ lineHeight: 0.98, fontSize: big ? 100 : 80 }}>
        {titleLines.map((line, i) => (
          <span key={i} className="block" style={{ color: i % 2 === 1 ? GOLD : ink }}>{line}</span>
        ))}
      </h1>
      {data.tagline && (
        <p className="mt-4 font-bold uppercase" style={{ color: ink, letterSpacing: "0.2em", fontSize: big ? 22 : 20 }}>
          {data.tagline.split("\n").join(" ")}
        </p>
      )}
      {desc && (
        <p
          className="mt-5 whitespace-pre-line leading-relaxed"
          style={{ color: subInk, fontSize: big ? 22 : 20, maxWidth: big ? 640 : 760, borderLeft: `3px solid ${GOLD}`, paddingLeft: 20 }}
        >
          {desc}
        </p>
      )}
    </>
  )

  return (
    <div
      style={{ width: w, height: portrait ? undefined : h, backgroundColor: BG, fontFamily: "'Outfit', sans-serif" }}
      className="relative flex flex-col overflow-hidden"
      data-theme={light ? "light" : "dark"}
    >
      {/* Ambient gold glows + arc ornaments + glowing skyline base */}
      <div className="absolute inset-x-0 top-0 h-1/2" style={{ background: "radial-gradient(90% 70% at 85% 0%, rgba(214,179,87,0.16), transparent 60%)" }} />
      <div className="absolute inset-x-0 bottom-0 h-1/2" style={{ background: "radial-gradient(80% 60% at 0% 100%, rgba(214,179,87,0.08), transparent 55%)" }} />
      <div className="absolute rounded-full" style={{ width: w * 0.5, height: w * 0.5, top: -w * 0.22, right: -w * 0.18, border: `1.5px solid ${GOLD}33` }} />
      <div className="absolute rounded-full" style={{ width: w * 0.62, height: w * 0.62, top: -w * 0.28, right: -w * 0.24, border: `1px solid ${GOLD}22` }} />
      <div className="absolute left-0 top-0 h-28 w-28" style={{ borderLeft: `2px solid ${GOLD}66`, borderTop: `2px solid ${GOLD}66`, margin: 26 }} />
      <div className="absolute bottom-0 right-0 h-28 w-28" style={{ borderRight: `2px solid ${GOLD}66`, borderBottom: `2px solid ${GOLD}66`, margin: 26 }} />
      <div className="absolute inset-x-0 bottom-0" style={{ height: portrait ? 300 : h * 0.24 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/background/dubai.webp"
          alt=""
          className="h-full w-full object-cover object-bottom"
          style={{ filter: light ? "grayscale(0.4) brightness(1.05)" : "sepia(1) saturate(1.7) brightness(0.9)", opacity: light ? 0.35 : 0.55 }}
        />
        <div className="absolute inset-0" style={{ background: light ? "linear-gradient(180deg, #f6f4ef 0%, rgba(246,244,239,0.05) 100%)" : `linear-gradient(180deg, ${BG} 0%, rgba(13,21,34,0.25) 70%, rgba(13,21,34,0.55) 100%)` }} />
      </div>

      <div className={`relative flex flex-col ${portrait ? "" : "h-full"}`} style={{ paddingLeft: pad, paddingRight: pad, paddingTop: portrait ? 48 : 40 }}>
        {split ? (
          /* Landscape, 1–3 speakers: title left · logos + speakers right */
          <div className="flex min-h-0 flex-1 items-stretch" style={{ gap: 56 }}>
            <div className="flex min-w-0 flex-1 flex-col justify-center pb-4">{titleBlock(true)}</div>
            <div className="flex shrink-0 flex-col" style={{ width: w * 0.44 }}>
              <div className="flex justify-end">{logoArt}</div>
              <div className="flex min-h-0 flex-1 flex-col justify-center" style={{ marginTop: 8 }}>{speakerCards}</div>
            </div>
          </div>
        ) : (
          <>
            {/* Header: title left, logos top-right */}
            <div className="flex items-start justify-between" style={{ minHeight: portrait ? undefined : 300, gap: 48 }}>
              <div className="min-w-0 flex-1">
                <div className={portrait ? "mt-2" : "mt-1"}>{titleBlock(portrait)}</div>
              </div>
              {logoArt}
            </div>

            {/* Speakers — takes the remaining height, vertically centered */}
            <div className={`flex flex-col ${portrait ? "" : "min-h-0 flex-1 justify-center"}`} style={{ marginTop: portrait ? 28 : 4 }}>
              {speakerCards}
            </div>
          </>
        )}

        {/* Bottom bar — date / time / venue (+ contacts when provided) */}
        <GoldFooterBar data={data} marginTop={portrait ? 30 : 0} light={light} />
      </div>
    </div>
  )
}

// ─── Design: Golden Invite (serif seminar invite, dark & light variants) ────────

const INVITE_GOLD_GRAD = `linear-gradient(120deg, #f0d99b, ${GOLD} 45%, #a97e2f)`

function InvitePoster({ data, speakers, w, portrait, logos, light }: PosterProps) {
  const SERIF = "'Playfair Display', Georgia, 'Times New Roman', serif"
  const BG = light ? "#f6f4ef" : "#0a1424"
  const ink = light ? NAVY : "#ffffff"
  const sub = light ? "#3c4451" : "rgba(255,255,255,0.82)"
  const n = speakers.length
  const titleLines = data.title.split("\n").filter(Boolean)
  const topics = data.topics.split("\n").map((t) => t.trim()).filter(Boolean)
  const pad = portrait ? 60 : 80

  const goldHeading = (label: string, size = 19) => (
    <div className="flex w-full items-center justify-center gap-4">
      <span className="h-px w-14" style={{ backgroundColor: `${GOLD}99` }} />
      <span className="text-[11px]" style={{ color: GOLD }}>◆</span>
      <p className="font-extrabold uppercase" style={{ color: GOLD, fontSize: size, letterSpacing: "0.22em" }}>{label}</p>
      <span className="text-[11px]" style={{ color: GOLD }}>◆</span>
      <span className="h-px w-14" style={{ backgroundColor: `${GOLD}99` }} />
    </div>
  )

  const speakerName = (sp: Speaker, big?: boolean) => (
    <div className="flex flex-col items-center text-center">
      <p className={`font-extrabold uppercase leading-tight ${big ? "text-[30px]" : "text-[20px]"}`} style={{ color: ink }}>{sp.name}</p>
      {sp.role && <p className={`mt-1 leading-snug ${big ? "text-[17px]" : "text-[14px]"} font-medium`} style={{ color: sub }}>{sp.role}</p>}
      {sp.topic && <p className={`leading-snug ${big ? "text-[16px]" : "text-[13.5px]"} font-medium`} style={{ color: sub }}>{sp.topic}</p>}
    </div>
  )

  const circle = (sp: Speaker, d: number) => (
    <div className="overflow-hidden rounded-full" style={{ width: d, height: d, border: `3px solid ${GOLD}`, boxShadow: `0 0 0 6px ${light ? "#ffffff" : "rgba(255,255,255,0.08)"}, 0 24px 48px -20px rgba(0,0,0,0.5)` }}>
      <SpeakerPhoto s={sp} />
    </div>
  )

  // 1 → hero circle + SPEAKER pill · 2 → rounded squares with & · 3+ → circle row
  const speakersBlock =
    n === 0 ? null : n === 1 ? (
      <div className="flex flex-col items-center">
        {circle(speakers[0], portrait ? 310 : 280)}
        <span
          className="-mt-5 px-7 py-1.5 text-[15px] font-extrabold uppercase tracking-[0.2em]"
          style={{ background: INVITE_GOLD_GRAD, color: "#0a1424", borderRadius: 999 }}
        >
          Speaker
        </span>
        <div className="mt-3">{speakerName(speakers[0], true)}</div>
      </div>
    ) : n === 2 ? (
      <div className="flex items-start justify-center" style={{ gap: 28 }}>
        {speakers.map((sp, i) => (
          <Fragment key={sp.id}>
            {i === 1 && (
              <span className="self-center font-bold" style={{ fontFamily: SERIF, color: GOLD, fontSize: 58, marginTop: -40 }}>&amp;</span>
            )}
            <div className="flex flex-col items-center" style={{ width: portrait ? 320 : 280 }}>
              {circle(sp, portrait ? 290 : 250)}
              <div className="mt-4">{speakerName(sp)}</div>
            </div>
          </Fragment>
        ))}
      </div>
    ) : (
      /* Balanced rows: 3 in a row · 4 → 2+2 · 5 → 3+2 · 6 → 3+3 */
      <div className="flex w-full flex-col items-center" style={{ gap: 30 }}>
        {speakerRows(speakers).map((row, r) => {
          const d = portrait ? (n === 3 ? 250 : n === 4 ? 230 : 200) : n <= 4 ? 190 : 155
          return (
            <div key={r} className="flex flex-nowrap items-start justify-center" style={{ columnGap: portrait ? 34 : 44 }}>
              {row.map((sp) => (
                <div key={sp.id} className="flex flex-col items-center" style={{ width: d + 46 }}>
                  {circle(sp, d)}
                  <div className="mt-4">{speakerName(sp)}</div>
                </div>
              ))}
            </div>
          )
        })}
      </div>
    )

  const topicsBlock = topics.length > 0 && (
    <div className="flex w-full flex-col items-center">
      {goldHeading("Topics We Will Discuss", 17)}
      <div className="mt-4 grid grid-cols-2 gap-x-10 gap-y-3" style={{ maxWidth: portrait ? 860 : 780 }}>
        {topics.map((t, i) => (
          <div key={i} className="flex items-center gap-2.5">
            <CheckCircle2 className="shrink-0" style={{ color: GOLD, width: 21, height: 21 }} strokeWidth={2} />
            <span className="text-[15.5px] font-semibold leading-snug" style={{ color: ink }}>{t}</span>
          </div>
        ))}
      </div>
    </div>
  )

  const detailsPanel = (
    <div className="flex w-full justify-center">
      <div
        className="px-10 py-5"
        style={{
          border: `1.5px solid ${GOLD}77`,
          borderRadius: 14,
          backgroundColor: light ? "rgba(255,255,255,0.75)" : "rgba(255,255,255,0.05)",
          boxShadow: light ? "0 16px 32px -20px rgba(0,31,63,0.35)" : "0 16px 32px -20px rgba(0,0,0,0.55)",
        }}
      >
        <DetailRow data={data} light={light} size={20} />
      </div>
    </div>
  )

  const footerBar = (
    <div
      className="flex items-center justify-center gap-x-9"
      style={{
        marginLeft: -pad, marginRight: -pad, minHeight: 70,
        backgroundColor: light ? NAVY : "rgba(5,10,20,0.85)",
        borderTop: `1px solid ${GOLD}55`,
      }}
    >
      <span className="flex items-center gap-2.5 text-[14.5px] font-semibold text-white/90">
        <Globe style={{ color: GOLD, width: 17, height: 17 }} strokeWidth={1.8} /> www.fhiglobal.ae
      </span>
      {data.contactEmail && (
        <span className="flex items-center gap-2.5 text-[14.5px] font-semibold text-white/90" style={{ paddingLeft: 36, borderLeft: `1px solid ${GOLD}44` }}>
          <Mail style={{ color: GOLD, width: 17, height: 17 }} strokeWidth={1.8} /> {data.contactEmail}
        </span>
      )}
      {data.contactPhone && (
        <span className="flex items-center gap-2.5 text-[14.5px] font-semibold text-white/90" style={{ paddingLeft: 36, borderLeft: `1px solid ${GOLD}44` }}>
          <Phone style={{ color: GOLD, width: 17, height: 17 }} strokeWidth={1.8} /> {data.contactPhone}
        </span>
      )}
    </div>
  )

  const header = (
    <div className="flex flex-col items-center text-center">
      <LogoRow logos={logos} dark={!light} size={portrait ? 60 : 52} />
      <p className="mt-11 text-[15px] font-bold uppercase" style={{ color: ink, letterSpacing: "0.34em" }}>You Are Invited to Our</p>
      <h1 style={{ fontFamily: SERIF, lineHeight: 1 }}>
        {titleLines.map((line, i) => (
          <span
            key={i}
            className="block font-bold uppercase"
            style={i === titleLines.length - 1 && titleLines.length > 1
              ? { color: GOLD, fontSize: portrait ? 104 : 84, letterSpacing: "0.02em", marginTop: 2 }
              : { color: ink, fontSize: portrait ? 46 : 38, letterSpacing: "0.3em", marginTop: 10 }}
          >
            {line}
          </span>
        ))}
      </h1>
      {data.tagline && (
        <p className="mt-3 text-[17px] font-bold uppercase" style={{ color: ink, letterSpacing: "0.16em" }}>
          {data.tagline.split("\n").join(" ")}
        </p>
      )}
    </div>
  )

  return (
    <div
      style={{ width: w, backgroundColor: BG, fontFamily: "'Outfit', sans-serif" }}
      className="relative flex flex-col overflow-hidden"
    >
      {/* Skyline + gold arc + diagonal corner accents */}
      <div className="absolute inset-x-0 bottom-0" style={{ height: light ? 620 : 540, opacity: light ? 0.28 : 0.4 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/background/dubai.webp"
          alt=""
          className="h-full w-full object-cover object-bottom"
          style={{ filter: light ? "grayscale(0.4) brightness(1.05)" : "sepia(0.9) saturate(1.5) brightness(0.75)" }}
        />
        <div className="absolute inset-0" style={{ background: light ? "linear-gradient(180deg, #f6f4ef 0%, rgba(246,244,239,0.08) 100%)" : `linear-gradient(180deg, ${BG} 0%, rgba(10,20,36,0.35) 65%, rgba(10,20,36,0.7) 100%)` }} />
      </div>
      <div
        className="absolute rounded-full"
        style={{ width: w * 1.7, height: w * 1.7, left: -w * 0.35, top: (portrait ? 320 : 250) - w * 1.7, border: `2px solid ${GOLD}55` }}
      />
      <span className="absolute" style={{ top: -50, right: -170, width: 430, height: 110, transform: "rotate(33deg)", borderBottom: `2.5px solid ${GOLD}99` }} />
      <span className="absolute" style={{ top: -70, right: -170, width: 430, height: 110, transform: "rotate(33deg)", borderBottom: `1px solid ${GOLD}55` }} />
      <span className="absolute" style={{ bottom: 20, left: -170, width: 430, height: 110, transform: "rotate(33deg)", borderTop: `2.5px solid ${GOLD}99` }} />

      {/* Speaker-count ribbon */}
      {n > 0 && (
        <span
          className="absolute z-10 px-6 py-2 text-[16px] font-extrabold uppercase tracking-[0.12em]"
          style={{ top: 26, left: 26, background: INVITE_GOLD_GRAD, color: "#0a1424", clipPath: "polygon(0 0, 100% 0, calc(100% - 14px) 50%, 100% 100%, 0 100%)" }}
        >
          {n} Speaker{n > 1 ? "s" : ""}
        </span>
      )}

      <div className="relative flex flex-col" style={{ paddingLeft: pad, paddingRight: pad, paddingTop: portrait ? 44 : 32 }}>
        {header}

        {portrait ? (
          <>
            <div className="mt-7 w-full">{detailsPanel}</div>
            <div className="flex w-full flex-col items-center" style={{ paddingTop: 12 }}>
              {n > 0 && (
                <div className="mt-9 flex w-full flex-col items-center">
                  {goldHeading(speakersHeading(n))}
                  <div className="mt-6 w-full">{speakersBlock}</div>
                </div>
              )}
              {topics.length > 0 && <div className="mt-10 flex w-full flex-col items-center">{topicsBlock}</div>}
            </div>
          </>
        ) : (
          <div className="flex min-h-0 flex-1 items-center" style={{ gap: 56, paddingTop: 12, paddingBottom: 8 }}>
            <div className="flex min-w-0 flex-1 flex-col items-center justify-center gap-7">
              {detailsPanel}
              {topicsBlock}
            </div>
            {n > 0 && (
              <div className="flex shrink-0 flex-col items-center justify-center" style={{ width: w * 0.44 }}>
                {goldHeading(speakersHeading(n))}
                <div className="mt-6">{speakersBlock}</div>
              </div>
            )}
          </div>
        )}

        <div style={{ marginTop: 40 }}>{footerBar}</div>
      </div>
    </div>
  )
}

// ─── Design: Landscape Meeting (navy & gold, skyline right, speakers row) ───────

function PremierPoster({ data, speakers, w, h, logos, light }: PosterProps) {
  const SERIF = "'Playfair Display', Georgia, 'Times New Roman', serif"
  const BG = light ? "#f6f4ef" : "#0a1220"
  const ink = light ? NAVY : "#ffffff"
  const subInk = light ? "#3c4451" : "rgba(255,255,255,0.75)"
  const n = speakers.length
  const titleLines = data.title.split("\n").filter(Boolean)
  const topics = data.topics.split("\n").map((t) => t.trim()).filter(Boolean)
  const photo = data.background || "/background/dubai.webp"

  const details = [
    { icon: CalendarDays, text: data.date },
    { icon: Clock, text: data.time },
    { icon: MapPin, text: data.venue },
  ].filter((d) => d.text.trim())

  // Speaker cards — balanced rows share the right column.
  const rows = speakerRows(speakers)
  const perRow = rows.length > 0 ? Math.max(...rows.map((r) => r.length)) : 1
  const cardW = perRow >= 3 ? 280 : perRow === 2 ? 330 : 400
  const photoH = Math.round(cardW * (rows.length > 1 ? 1.1 : 1.4))

  const goldDash = <span className="h-px w-10" style={{ backgroundColor: `${GOLD}99` }} />

  return (
    <div
      style={{ width: w, height: h, backgroundColor: BG, fontFamily: "'Outfit', sans-serif" }}
      className="relative flex flex-col overflow-hidden"
    >
      {/* Skyline photo blending in from the top-right */}
      <div className="absolute right-0 top-0" style={{ width: w * 0.58, height: h * 0.72 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={displayImg(photo)}
          alt=""
          className="h-full w-full object-cover object-top"
          style={{ opacity: light ? 0.5 : 0.85, filter: light ? "grayscale(0.3) brightness(1.05)" : "brightness(0.9)" }}
        />
        <div className="absolute inset-0" style={{ background: `linear-gradient(90deg, ${BG} 0%, ${light ? "rgba(246,244,239,0.35)" : "rgba(10,18,32,0.25)"} 45%, transparent 100%)` }} />
        <div className="absolute inset-0" style={{ background: `linear-gradient(180deg, ${light ? "rgba(246,244,239,0.55)" : "rgba(10,18,32,0.55)"} 0%, transparent 30%, ${light ? "rgba(246,244,239,0.4)" : "rgba(10,18,32,0.35)"} 75%, ${BG} 100%)` }} />
      </div>

      {/* Gold corner arcs — bottom-left and right edge */}
      <div className="absolute rounded-full" style={{ width: w * 0.55, height: w * 0.55, left: -w * 0.3, bottom: -w * 0.42, border: `2px solid ${GOLD}88` }} />
      <div className="absolute rounded-full" style={{ width: w * 0.55, height: w * 0.55, left: -w * 0.32, bottom: -w * 0.44, border: `1px solid ${GOLD}55` }} />
      <div className="absolute rounded-full" style={{ width: w * 0.5, height: w * 0.5, right: -w * 0.34, bottom: -w * 0.3, border: `2px solid ${GOLD}66` }} />

      {/* Speaker-count ribbon */}
      {n > 0 && (
        <span
          className="absolute z-10 px-7 py-2.5 text-[17px] font-extrabold uppercase tracking-[0.14em]"
          style={{ top: 30, left: 0, background: `linear-gradient(120deg, #f0d99b, ${GOLD} 45%, #a97e2f)`, color: "#0a1220", clipPath: "polygon(0 0, 100% 0, calc(100% - 18px) 50%, 100% 100%, 0 100%)" }}
        >
          {n} Speaker{n > 1 ? "s" : ""}
        </span>
      )}

      <div className="relative flex h-full flex-col" style={{ paddingLeft: 90, paddingRight: 90, paddingTop: 30 }}>
        {/* Centered logo row */}
        <div className="flex justify-center">
          <LogoRow logos={logos} dark={!light} size={64} />
        </div>

        {/* Main: content left · speakers right */}
        <div className="flex min-h-0 flex-1 items-stretch" style={{ gap: 48, paddingTop: 26 }}>
          <div className="flex min-w-0 flex-col justify-center pb-10" style={{ width: w * 0.47 }}>
            <p className="text-[23px] font-bold uppercase" style={{ color: ink, letterSpacing: "0.42em" }}>You Are Invited to Our</p>
            <h1 style={{ fontFamily: SERIF, lineHeight: 1 }}>
              {titleLines.map((line, i) => (
                <span
                  key={i}
                  className="block font-bold uppercase"
                  style={i === titleLines.length - 1 && titleLines.length > 1
                    ? { color: GOLD, fontSize: 150, letterSpacing: "0.02em", marginTop: 6 }
                    : { color: ink, fontSize: 82, letterSpacing: "0.18em", marginTop: 24 }}
                >
                  {line}
                </span>
              ))}
            </h1>
            {data.tagline && (
              <div className="mt-7 flex items-center gap-4">
                {goldDash}
                <p className="text-[27px] font-bold uppercase" style={{ color: ink, letterSpacing: "0.1em" }}>
                  {data.tagline.split("\n").join(" ")}
                </p>
                {goldDash}
              </div>
            )}

            {/* Details row */}
            {details.length > 0 && (
              <div className="mt-14 flex items-center">
                {details.map(({ icon: Icon, text }, i) => {
                  const [first, ...rest] = text.split("\n")
                  return (
                    <div key={i} className="flex items-center gap-4" style={i > 0 ? { paddingLeft: 30, marginLeft: 30, borderLeft: `1.5px solid ${GOLD}55` } : undefined}>
                      <Icon className="shrink-0" style={{ color: GOLD, width: 46, height: 46 }} strokeWidth={1.7} />
                      <span className="min-w-0">
                        <span className="block truncate text-[24px] font-extrabold uppercase leading-tight" style={{ color: ink }}>{first}</span>
                        {rest.length > 0 && <span className="block truncate text-[18px] font-semibold uppercase leading-tight" style={{ color: subInk }}>{rest.join(" ")}</span>}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Topics checklist */}
            {topics.length > 0 && (
              <div className="mt-14">
                <div className="flex items-center gap-4">
                  <span className="h-px flex-1" style={{ maxWidth: 90, backgroundColor: `${GOLD}99` }} />
                  <span className="text-[12px]" style={{ color: GOLD }}>◆</span>
                  <p className="text-[25px] font-extrabold uppercase" style={{ color: GOLD, letterSpacing: "0.18em" }}>Topics We Will Discuss</p>
                  <span className="text-[12px]" style={{ color: GOLD }}>◆</span>
                  <span className="h-px flex-1" style={{ maxWidth: 90, backgroundColor: `${GOLD}99` }} />
                </div>
                <div className="mt-8 grid grid-cols-2 gap-x-10 gap-y-7">
                  {topics.map((t, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <CheckCircle2 className="shrink-0" style={{ color: GOLD, width: 28, height: 28 }} strokeWidth={2} />
                      <span className="text-[21px] font-semibold leading-snug" style={{ color: ink }}>{t}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>

          {/* Speakers — right column, pinned to the bottom like the sample */}
          <div className="flex min-w-0 flex-1 flex-col justify-end pb-2">
            {n > 0 && (
              <>
                <div className="flex items-center justify-center gap-3">
                  <span className="text-[12px]" style={{ color: GOLD }}>◆</span>
                  <p className="text-[24px] font-extrabold uppercase" style={{ color: GOLD, letterSpacing: "0.28em" }}>{speakersHeading(n)}</p>
                  <span className="text-[12px]" style={{ color: GOLD }}>◆</span>
                </div>
                <div className="mt-6 flex flex-col items-center" style={{ gap: 26 }}>
                  {rows.map((row, r) => (
                    <div key={r} className="flex flex-nowrap items-start justify-center" style={{ gap: 26 }}>
                      {row.map((sp) => (
                        <div key={sp.id} className="flex flex-col items-center" style={{ width: cardW }}>
                          <div className="relative w-full" style={{ paddingBottom: 24 }}>
                            <div
                              className="w-full overflow-hidden rounded-[16px]"
                              style={{ height: photoH, border: `1.5px solid ${GOLD}88`, backgroundColor: light ? "#ffffff" : "rgba(255,255,255,0.04)" }}
                            >
                              <SpeakerPhoto s={sp} />
                            </div>
                            {/* Gold name plate overlapping the card bottom */}
                            <span
                              className="absolute bottom-0 left-1/2 block w-[88%] -translate-x-1/2 px-4 py-2.5 text-center text-[19px] font-extrabold uppercase leading-tight"
                              style={{ background: `linear-gradient(120deg, #f0d99b, ${GOLD} 45%, #a97e2f)`, color: "#0a1220", borderRadius: 8 }}
                            >
                              {sp.name}
                            </span>
                          </div>
                          {sp.role && <p className="mt-2 text-center text-[16px] font-medium leading-snug" style={{ color: light ? "#3c4451" : "rgba(255,255,255,0.85)" }}>{sp.role}</p>}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Footer band — centered website */}
        <div
          className="flex items-center justify-center gap-5"
          style={{ marginLeft: -90, marginRight: -90, minHeight: 84, backgroundColor: light ? NAVY : "rgba(5,9,17,0.75)", borderTop: `1px solid ${GOLD}55` }}
        >
          {goldDash}
          <span className="flex items-center gap-3 text-[21px] font-semibold text-white">
            <Globe style={{ color: GOLD, width: 24, height: 24 }} strokeWidth={1.7} /> www.fhiglobal.ae
          </span>
          {goldDash}
        </div>
      </div>
    </div>
  )
}

// ─── Dispatcher ────────────────────────────────────────────────────────────────

function Poster({ design, ...props }: PosterProps & { design: DesignId }) {
  if (design === "collage") return <CollagePoster {...props} />
  if (design === "invite") return <InvitePoster {...props} />
  if (design === "premier") return <PremierPoster {...props} />
  return <MeetingPoster {...props} />
}

// ─── Small form primitives (flat, same look as the Website Builder) ───────────

const INPUT_CLS =
  "w-full border border-[#e2e6ea] bg-white px-3 py-2 text-[13px] text-[#0d1117] outline-none transition-colors focus:border-[#001f3f]"

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-[#6b7280]">{label}</span>
      {children}
    </label>
  )
}

// ─── Editor ────────────────────────────────────────────────────────────────────

export function MeetingPosterClient() {
  const [data, setData] = useState<PosterData>(DEFAULTS)
  const [speakers, setSpeakers] = useState<Speaker[]>([])
  const [design, setDesign] = useState<DesignId>("meeting")
  const [theme, setTheme] = useState<"dark" | "light">("dark")
  const [logoIds, setLogoIds] = useState<string[]>(["fhiglobal", "filipinohomes"])
  const [logoScales, setLogoScales] = useState<Record<string, number>>({})
  const [logoScaleAll, setLogoScaleAll] = useState(100)
  const [options, setOptions] = useState<SpeakerOption[] | null>(null)
  const [optionsError, setOptionsError] = useState<string | null>(null)
  const [query, setQuery] = useState("")
  const [downloading, setDownloading] = useState(false)
  const [uploading, setUploading] = useState(false)

  const posterRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  // Selection order = render order on the poster; sliders set per-logo scale.
  const selectedLogos = useMemo(
    () =>
      logoIds.flatMap((id) => {
        const l = LOGO_OPTIONS.find((o) => o.id === id)
        return l ? [{ ...l, scale: ((logoScales[id] ?? 100) / 100) * (logoScaleAll / 100) }] : []
      }),
    [logoIds, logoScales, logoScaleAll],
  )
  const toggleLogo = (id: string) =>
    setLogoIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))

  const { w: posterW, h: posterH } = DESIGN_SIZES[design] ?? { w: POSTER_W, h: POSTER_H }
  const portrait = posterH >= posterW

  // Auto-height designs (Business Meeting portrait) size to content — measure
  // the real node height so the preview frame and PNG export match it.
  const [measuredH, setMeasuredH] = useState<number | null>(null)
  useEffect(() => {
    const el = posterRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setMeasuredH(el.offsetHeight || null))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const displayH = measuredH ?? posterH

  // Preview scale — fit the poster into whatever width is available.
  const [frameEl, setFrameEl] = useState<HTMLDivElement | null>(null)
  const [scale, setScale] = useState(0.4)
  useEffect(() => {
    if (!frameEl) return
    const ro = new ResizeObserver(() => {
      if (frameEl.clientWidth > 0) setScale(Math.min(1, frameEl.clientWidth / posterW))
    })
    ro.observe(frameEl)
    return () => ro.disconnect()
  }, [frameEl, posterW])

  useEffect(() => {
    let alive = true
    fetch("/api/meeting-poster/speakers")
      .then((r) => r.json().then((j) => ({ ok: r.ok, j })))
      .then(({ ok, j }) => {
        if (!alive) return
        if (!ok) throw new Error((j as { error?: string }).error || "Failed to load speakers")
        setOptions(((j as { speakers?: SpeakerOption[] }).speakers ?? []))
      })
      .catch((e) => {
        if (alive) setOptionsError(e instanceof Error ? e.message : "Failed to load speakers")
      })
    return () => {
      alive = false
    }
  }, [])

  // Warm the font-embed cache so the first Download is instant.
  useEffect(() => {
    warmFontEmbedCSS(posterRef.current)
  }, [])

  const set = (patch: Partial<PosterData>) => setData((d) => ({ ...d, ...patch }))

  const selectedIds = useMemo(() => new Set(speakers.map((s) => s.id)), [speakers])
  const needle = query.trim().toLowerCase()
  const visibleOptions = (options ?? []).filter((o) => !needle || o.name.toLowerCase().includes(needle))

  const toggleSpeaker = (o: SpeakerOption) => {
    setSpeakers((prev) => {
      const at = prev.findIndex((s) => s.id === o.id)
      if (at >= 0) return prev.filter((s) => s.id !== o.id)
      if (prev.length >= MAX_SPEAKERS) return prev
      return [...prev, { ...o, role: "Real Estate Specialist", topic: "" }]
    })
  }

  const moveSpeaker = (i: number, dir: -1 | 1) => {
    setSpeakers((prev) => {
      const j = i + dir
      if (j < 0 || j >= prev.length) return prev
      const next = [...prev]
      ;[next[i], next[j]] = [next[j], next[i]]
      return next
    })
  }

  const uploadBackground = async (file: File) => {
    setUploading(true)
    try {
      const { file: toUpload } = await compressImageForUpload(file)
      const fd = new FormData()
      fd.append("file", toUpload)
      const res = await fetch("/api/upload/website-builder", { method: "POST", body: fd })
      const json = (await res.json().catch(() => ({}))) as { url?: string }
      if (res.ok && json.url) set({ background: json.url })
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ""
    }
  }

  const download = async () => {
    const node = posterRef.current
    if (!node) return
    setDownloading(true)
    try {
      const png = await capturePng(node, { width: posterW, height: node.offsetHeight || posterH, pixelRatio: 2 })
      const a = document.createElement("a")
      a.href = png
      a.download = `meeting-poster-${design}-${Date.now()}.png`
      a.click()
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="w-full space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-['Outfit'] text-2xl font-bold text-[#0d1117] flex items-center gap-2">
            <Presentation className="w-6 h-6 text-[#001f3f]" />
            Meeting Poster
          </h1>
          <p className="text-sm text-[#6b7280] mt-1">
            Pick a design, choose up to {MAX_SPEAKERS} speakers from the team, set the details, download as PNG.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void download()}
          disabled={downloading}
          className="inline-flex items-center gap-2 bg-gradient-to-b from-[#0a3d6b] to-[#001f3f] px-5 py-2.5 text-[13px] font-bold text-white disabled:opacity-60"
        >
          {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          Download PNG
        </button>
      </div>

      {/* Design / theme / logo pickers — stacked rows */}
      <div className="flex flex-col gap-5 bg-white border border-[#e8eaed] p-4">
        <div>
          <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-[#6b7280]">Design</p>
          <div className="flex flex-wrap gap-2">
            {DESIGNS.map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => setDesign(d.id)}
                className={`flex items-center gap-2.5 border p-2 pr-3 text-left transition-colors ${
                  design === d.id ? "border-[#001f3f] bg-[#eef3f9]" : "border-[#e8eaed] bg-white hover:border-[#9aa0aa]"
                }`}
              >
                <span className="h-9 w-14 shrink-0 border border-black/10" style={{ background: d.chip }} />
                <span>
                  <span className="block text-[12.5px] font-bold text-[#0d1117]">{d.label}</span>
                  <span className="block max-w-[180px] text-[10.5px] leading-tight text-[#9aa0aa]">{d.desc}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-[#6b7280]">Theme</p>
          <div className="flex gap-2">
            {(["dark", "light"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTheme(t)}
                className={`flex items-center gap-2.5 border p-2 pr-3 text-left transition-colors ${
                  theme === t ? "border-[#001f3f] bg-[#eef3f9]" : "border-[#e8eaed] bg-white hover:border-[#9aa0aa]"
                }`}
              >
                <span
                  className="h-9 w-9 shrink-0 border border-black/10"
                  style={{ background: t === "dark" ? "linear-gradient(180deg,#0d1522,#050a12)" : "linear-gradient(160deg,#f6f4ef,#e9e2d2)" }}
                />
                <span className="block text-[12.5px] font-bold capitalize text-[#0d1117]">{t}</span>
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-[#6b7280]">Logos (pick one or more)</p>
          <div className="flex flex-wrap items-start gap-x-10 gap-y-3">
          <div className="flex flex-wrap gap-2">
            {LOGO_OPTIONS.map((l) => {
              const active = logoIds.includes(l.id)
              return (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => toggleLogo(l.id)}
                  className={`relative border p-2 text-left transition-colors ${
                    active ? "border-[#001f3f] bg-[#eef3f9]" : "border-[#e8eaed] bg-white hover:border-[#9aa0aa]"
                  }`}
                >
                  {active && (
                    <span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-[#001f3f]">
                      <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />
                    </span>
                  )}
                  <span
                    className="flex h-10 w-24 items-center justify-center border border-black/10 px-1.5"
                    style={{ backgroundColor: l.whiteArt ? NAVY : "#f6f7f9" }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={l.src} alt={l.name} className="max-h-7 max-w-full object-contain" />
                  </span>
                  <span className="mt-1 block max-w-[96px] text-[10.5px] font-bold leading-tight text-[#0d1117]">{l.name}</span>
                </button>
              )
            })}
          </div>
          {logoIds.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <span className="w-36 shrink-0 text-[10.5px] font-bold uppercase tracking-wide text-[#6b7280]">All logos</span>
                <input
                  type="range" min={40} max={200} step={5} value={logoScaleAll}
                  onChange={(e) => setLogoScaleAll(Number(e.target.value))}
                  className="w-52 accent-[#001f3f]"
                />
                <span className="w-11 text-[11px] font-semibold text-[#6b7280]">{logoScaleAll}%</span>
              </div>
              {logoIds.map((id) => {
                const l = LOGO_OPTIONS.find((o) => o.id === id)
                if (!l) return null
                const v = logoScales[id] ?? 100
                return (
                  <div key={id} className="flex items-center gap-3">
                    <span className="w-36 shrink-0 truncate text-[10.5px] font-bold uppercase tracking-wide text-[#6b7280]">{l.name}</span>
                    <input
                      type="range" min={40} max={200} step={5} value={v}
                      onChange={(e) => setLogoScales((prev) => ({ ...prev, [id]: Number(e.target.value) }))}
                      className="w-52 accent-[#001f3f]"
                    />
                    <span className="w-11 text-[11px] font-semibold text-[#6b7280]">{v}%</span>
                  </div>
                )
              })}
            </div>
          )}
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[400px_1fr]">
        {/* ── Form ── */}
        <div className="space-y-4 bg-white border border-[#e8eaed] p-5 self-start">
          <Field label="Title (line breaks kept)">
            <textarea rows={2} className={`${INPUT_CLS} resize-y`} value={data.title} onChange={(e) => set({ title: e.target.value })} />
          </Field>
          <Field label="Subtitle">
            <textarea rows={2} className={`${INPUT_CLS} resize-y`} value={data.subtitle} onChange={(e) => set({ subtitle: e.target.value })} />
          </Field>
          <Field label="Tagline (line breaks kept)">
            <textarea rows={2} className={`${INPUT_CLS} resize-y`} value={data.tagline} onChange={(e) => set({ tagline: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Date">
              <input className={INPUT_CLS} value={data.date} onChange={(e) => set({ date: e.target.value })} />
            </Field>
            <Field label="Time">
              <input className={INPUT_CLS} value={data.time} onChange={(e) => set({ time: e.target.value })} />
            </Field>
          </div>
          <Field label="Venue">
            <input className={INPUT_CLS} value={data.venue} onChange={(e) => set({ venue: e.target.value })} />
          </Field>
          <Field label="Topics — one per line (Golden Invite designs)">
            <textarea rows={4} className={INPUT_CLS} value={data.topics} onChange={(e) => set({ topics: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Contact phone">
              <input className={INPUT_CLS} value={data.contactPhone} onChange={(e) => set({ contactPhone: e.target.value })} />
            </Field>
            <Field label="Contact email">
              <input className={INPUT_CLS} value={data.contactEmail} onChange={(e) => set({ contactEmail: e.target.value })} />
            </Field>
          </div>
          <Field label="Background photo">
            <div className="flex items-center gap-2">
              <input
                className={INPUT_CLS}
                value={data.background}
                placeholder="Image URL"
                onChange={(e) => set({ background: e.target.value })}
              />
              <button
                type="button"
                disabled={uploading}
                onClick={() => fileRef.current?.click()}
                className="inline-flex h-9 shrink-0 items-center gap-1.5 border border-[#e2e6ea] bg-white px-3 text-[12px] font-semibold text-[#0d1117] hover:bg-[#f4f6f9] disabled:opacity-60"
              >
                {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="h-3.5 w-3.5" />}
                Upload
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) void uploadBackground(f)
                }}
              />
            </div>
          </Field>

          {/* Speaker picker */}
          <Field label={`Speakers — ${speakers.length}/${MAX_SPEAKERS} selected`}>
            <div className="space-y-2.5">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#9aa0aa]" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search agents…"
                  className={`${INPUT_CLS} pl-8`}
                />
              </div>
              <div className="max-h-64 space-y-1.5 overflow-y-auto border border-[#e8eaed] bg-[#fafbfc] p-1.5">
                {options === null && !optionsError && (
                  <div className="flex items-center justify-center py-6">
                    <Loader2 className="h-4 w-4 animate-spin text-[#9aa0aa]" />
                  </div>
                )}
                {optionsError && <p className="px-2 py-4 text-center text-[12px] font-semibold text-red-600">{optionsError}</p>}
                {options !== null && visibleOptions.length === 0 && (
                  <p className="px-2 py-4 text-center text-[12px] text-[#9aa0aa]">No agents found.</p>
                )}
                {visibleOptions.map((o) => {
                  const selected = selectedIds.has(o.id)
                  return (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => toggleSpeaker(o)}
                      className={`flex w-full items-center gap-2.5 border p-2 text-left transition-colors ${
                        selected ? "border-[#001f3f] bg-[#eef3f9]" : "border-transparent bg-white hover:border-[#d8dde3]"
                      }`}
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#eceff3]">
                        {o.photo ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={displayImg(o.photo)} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <User className="h-4 w-4 text-[#9aa0aa]" />
                        )}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-[12.5px] font-bold text-[#0d1117]">{o.name}</span>
                      <span
                        className={`flex h-5 w-5 shrink-0 items-center justify-center border ${
                          selected ? "border-[#001f3f] bg-[#001f3f] text-white" : "border-[#c8ccd2] text-transparent"
                        }`}
                      >
                        <Check className="h-3 w-3" />
                      </span>
                    </button>
                  )
                })}
              </div>

              {/* Selected — order + per-speaker role */}
              {speakers.map((s, i) => (
                <div key={s.id} className="border border-[#e8eaed] bg-[#fafbfc] p-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold text-[#9aa0aa]">#{i + 1}</span>
                    <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold text-[#0d1117]">{s.name}</span>
                    <button type="button" aria-label="Move up" disabled={i === 0} onClick={() => moveSpeaker(i, -1)} className="flex h-6 w-6 items-center justify-center text-[#9aa0aa] hover:bg-[#eef0f3] disabled:pointer-events-none disabled:opacity-30">
                      <ArrowUp className="h-3.5 w-3.5" />
                    </button>
                    <button type="button" aria-label="Move down" disabled={i === speakers.length - 1} onClick={() => moveSpeaker(i, 1)} className="flex h-6 w-6 items-center justify-center text-[#9aa0aa] hover:bg-[#eef0f3] disabled:pointer-events-none disabled:opacity-30">
                      <ArrowDown className="h-3.5 w-3.5" />
                    </button>
                    <button type="button" aria-label="Remove" onClick={() => setSpeakers((prev) => prev.filter((x) => x.id !== s.id))} className="flex h-6 w-6 items-center justify-center text-[#9aa0aa] hover:bg-red-50 hover:text-red-600">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <input
                    className={`${INPUT_CLS} mt-2`}
                    value={s.role}
                    placeholder="Role / title shown under the name"
                    onChange={(e) => setSpeakers((prev) => prev.map((x) => (x.id === s.id ? { ...x, role: e.target.value } : x)))}
                  />
                  <input
                    className={`${INPUT_CLS} mt-2`}
                    value={s.topic}
                    placeholder="Session topic (optional — Business Meeting design)"
                    onChange={(e) => setSpeakers((prev) => prev.map((x) => (x.id === s.id ? { ...x, topic: e.target.value } : x)))}
                  />
                </div>
              ))}
            </div>
          </Field>
        </div>

        {/* ── Live poster preview (scaled); the full-size node is what exports ── */}
        <div ref={setFrameEl} className="min-w-0">
          <div style={{ height: displayH * scale }} className="relative overflow-hidden">
            <div style={{ transform: `scale(${scale})`, transformOrigin: "top left", width: posterW }}>
              <div ref={posterRef}>
                <Poster design={design} data={data} speakers={speakers} w={posterW} h={posterH} portrait={portrait} logos={selectedLogos} light={theme === "light"} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
