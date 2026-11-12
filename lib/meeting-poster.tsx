import "server-only"

import { ImageResponse } from "next/og"
import { SITE_URL } from "@/lib/seo"
import { ogPicture } from "@/lib/og-picture"

/**
 * Server-rendered meeting poster for FHI Assistant (redrawn 2026-11-12 —
 * the boss found the first version plain). Two designs, both 1080×1350
 * (a phone screen / Instagram portrait):
 *
 *   skyline — the Dubai skyline behind a navy veil, gold rings, the title in
 *             Playfair Display, speakers as gold-ringed portraits, a details
 *             band with icons and a gold footer bar (the default);
 *   navy    — the same composition on a deep navy gradient with a gold glow,
 *             for a quieter, boardroom look.
 *
 * Everything the poster shows comes from the admin's words (lib/fhi-chat-tools
 * meeting_poster); FHI members named as speakers get their profile photo.
 * Photos and the backdrop go through ogPicture (sharp → JPEG), because satori
 * cannot decode the WebP the uploads and the backdrop are stored in — the
 * routes drawing this carry the sharp tracing keys in next.config.mjs.
 */

const W = 1080
const H = 1350
const GOLD = "#d6b357"
const GOLD_SOFT = "#f0d89b"
const NAVY = "#0a1220"

export type MeetingPosterDesign = "skyline" | "navy"
export const MEETING_POSTER_DESIGNS: Array<{ id: MeetingPosterDesign; label: string; about: string }> = [
  { id: "skyline", label: "Skyline", about: "Dubai skyline behind a navy veil, gold accents" },
  { id: "navy", label: "Navy & gold", about: "Deep navy with a gold glow — the boardroom look" },
]

export type MeetingPosterSpeaker = { name: string; role?: string; topic?: string; photo?: string | null }
export type MeetingPosterData = {
  title: string
  subtitle?: string
  tagline?: string
  date: string
  time: string
  venue: string
  speakers?: MeetingPosterSpeaker[]
  design?: MeetingPosterDesign
}

type Font = { name: string; data: ArrayBuffer; weight: 400 | 600 | 700; style: "normal" | "italic" }
const FONT_FILES: Array<Omit<Font, "data"> & { file: string }> = [
  { name: "Outfit", file: "Outfit-400.woff", weight: 400, style: "normal" },
  { name: "Outfit", file: "Outfit-600.woff", weight: 600, style: "normal" },
  { name: "Outfit", file: "Outfit-700.woff", weight: 700, style: "normal" },
  { name: "Playfair Display", file: "PlayfairDisplay-700.woff", weight: 700, style: "normal" },
  { name: "Playfair Display", file: "PlayfairDisplay-400i.woff", weight: 400, style: "italic" },
]
const fontCache = new Map<string, Promise<ArrayBuffer>>()
async function loadFonts(): Promise<Font[]> {
  return Promise.all(
    FONT_FILES.map(async ({ file, ...meta }) => {
      const url = `${SITE_URL}/fonts/${file}`
      let p = fontCache.get(url)
      if (!p) {
        p = fetch(url).then((r) => {
          if (!r.ok) throw new Error(`font ${file}: HTTP ${r.status}`)
          return r.arrayBuffer()
        })
        fontCache.set(url, p)
      }
      return { ...meta, data: await p }
    }),
  )
}

async function asDataUri(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { cache: "force-cache" })
    if (!res.ok) return null
    const type = res.headers.get("content-type")?.split(";")[0]?.trim() || "image/png"
    if (!type.startsWith("image/")) return null
    const buf = Buffer.from(await res.arrayBuffer())
    if (buf.length > 8 * 1024 * 1024) return null
    return `data:${type};base64,${buf.toString("base64")}`
  } catch {
    return null
  }
}

const titleSize = (t: string) => (t.length <= 16 ? 96 : t.length <= 26 ? 80 : t.length <= 40 ? 64 : 52)

/** Lucide outlines as inline SVG — satori draws SVG children (but no React fragments: "Cannot convert a Symbol value to a string"). */
const svgProps = { width: 30, height: 30, viewBox: "0 0 24 24", fill: "none", stroke: GOLD, strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const }
const Icon = ({ kind }: { kind: "calendar" | "clock" | "pin" }) =>
  kind === "calendar" ? (
    <svg {...svgProps}>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  ) : kind === "clock" ? (
    <svg {...svgProps}>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </svg>
  ) : (
    <svg {...svgProps}>
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  )

export async function renderMeetingPosterPng(data: MeetingPosterData): Promise<Buffer | null> {
  const design: MeetingPosterDesign = data.design === "navy" ? "navy" : "skyline"
  const speakers = (data.speakers ?? []).slice(0, 6)
  const [fonts, logo, backdrop, photos] = await Promise.all([
    loadFonts(),
    asDataUri(`${SITE_URL}/FHI_Branding_White.png`),
    design === "skyline" ? ogPicture(`${SITE_URL}/background/dubai.webp`, W, H, "cover") : Promise.resolve(null),
    Promise.all(speakers.map((s) => (s.photo ? ogPicture(s.photo, 420, 420, "cover") : Promise.resolve(null)))),
  ])

  const big = speakers.length <= 3
  const ring = big ? 184 : 150
  const photo = ring - 14
  const cardW = big ? 290 : 236
  const title = data.title.trim()
  const size = titleSize(title)
  const eyebrow = (data.tagline?.trim() || "You're invited to our").toUpperCase()

  const detail = (kind: "calendar" | "clock" | "pin", label: string, value: string) => (
    <div style={{ display: "flex", flex: 1, alignItems: "center", gap: 14, minWidth: 0 }}>
      <Icon kind={kind} />
      <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
        <div style={{ display: "flex", fontSize: 13, fontWeight: 700, letterSpacing: 4, color: GOLD }}>{label}</div>
        <div style={{ display: "flex", marginTop: 4, fontSize: value.length > 22 ? 19 : 23, fontWeight: 700, color: "#ffffff", lineHeight: 1.2 }}>{value}</div>
      </div>
    </div>
  )

  const res = new ImageResponse(
    (
      <div style={{ width: W, height: H, display: "flex", flexDirection: "column", position: "relative", backgroundColor: NAVY, fontFamily: "Outfit", color: "#ffffff", overflow: "hidden" }}>
        {/* Backdrop: the skyline under a navy veil, or a navy gradient with a gold glow. */}
        {backdrop ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={backdrop} width={W} height={H} alt="" style={{ position: "absolute", top: 0, left: 0, width: W, height: H, objectFit: "cover", opacity: 0.62 }} />
        ) : (
          <div style={{ position: "absolute", top: 0, left: 0, width: W, height: H, display: "flex", backgroundImage: "linear-gradient(180deg, #13223a 0%, #0a1220 55%, #050a14 100%)" }} />
        )}
        <div style={{ position: "absolute", top: 0, left: 0, width: W, height: H, display: "flex", backgroundImage: backdrop ? "linear-gradient(180deg, rgba(8,15,28,0.70) 0%, rgba(8,15,28,0.35) 32%, rgba(8,15,28,0.80) 64%, rgba(6,10,20,0.98) 100%)" : "radial-gradient(circle at 50% 16%, rgba(214,179,87,0.22) 0%, rgba(214,179,87,0.06) 28%, rgba(214,179,87,0) 50%)" }} />
        {/* Gold rings, the brand's decoration on the studio posters. */}
        <div style={{ position: "absolute", top: -210, right: -230, width: 620, height: 620, borderRadius: 310, border: "2px solid rgba(214,179,87,0.38)", display: "flex" }} />
        <div style={{ position: "absolute", top: -240, right: -260, width: 680, height: 680, borderRadius: 340, border: "1px solid rgba(214,179,87,0.22)", display: "flex" }} />
        <div style={{ position: "absolute", bottom: 150, left: -300, width: 560, height: 560, borderRadius: 280, border: "2px solid rgba(214,179,87,0.28)", display: "flex" }} />

        {/* Content */}
        <div style={{ position: "absolute", top: 0, left: 0, width: W, height: H - 58, display: "flex", flexDirection: "column", alignItems: "center", padding: "54px 64px 40px" }}>
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logo} height={66} alt="" />
          ) : (
            <div style={{ display: "flex", fontSize: 30, fontWeight: 700, color: GOLD, letterSpacing: 2 }}>FHI GLOBAL PROPERTY</div>
          )}

          <div style={{ display: "flex", alignItems: "center", gap: 18, marginTop: 46 }}>
            <div style={{ display: "flex", width: 54, height: 1, backgroundColor: "rgba(214,179,87,0.7)" }} />
            <div style={{ display: "flex", fontSize: 19, fontWeight: 700, letterSpacing: 8, color: GOLD_SOFT }}>{eyebrow}</div>
            <div style={{ display: "flex", width: 54, height: 1, backgroundColor: "rgba(214,179,87,0.7)" }} />
          </div>

          <div style={{ display: "flex", justifyContent: "center", textAlign: "center", marginTop: 20, maxWidth: 952, fontFamily: "Playfair Display", fontWeight: 700, fontSize: size, lineHeight: 1.06, color: "#ffffff", letterSpacing: 1 }}>
            {title.toUpperCase()}
          </div>
          {data.subtitle?.trim() ? (
            <div style={{ display: "flex", justifyContent: "center", textAlign: "center", marginTop: 18, maxWidth: 860, fontSize: 27, fontWeight: 400, color: "rgba(255,255,255,0.84)", lineHeight: 1.35 }}>
              {data.subtitle.trim()}
            </div>
          ) : null}
          <div style={{ display: "flex", width: 110, height: 3, backgroundImage: "linear-gradient(90deg, #b8913f, #f0d89b, #b8913f)", marginTop: 26 }} />

          <div style={{ display: "flex", flex: 1 }} />

          {speakers.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "100%" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <div style={{ display: "flex", width: 90, height: 1, backgroundColor: "rgba(214,179,87,0.55)" }} />
                <div style={{ display: "flex", fontSize: 16, fontWeight: 700, letterSpacing: 6, color: GOLD }}>{speakers.length === 1 ? "SPEAKER" : "SPEAKERS"}</div>
                <div style={{ display: "flex", width: 90, height: 1, backgroundColor: "rgba(214,179,87,0.55)" }} />
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: big ? 26 : 18, marginTop: 24, maxWidth: 960 }}>
                {speakers.map((s, i) => (
                  <div key={`${s.name}-${i}`} style={{ display: "flex", flexDirection: "column", alignItems: "center", width: cardW }}>
                    <div style={{ display: "flex", width: ring, height: ring, borderRadius: ring / 2, border: `4px solid ${GOLD}`, padding: 3, backgroundColor: "rgba(5,10,18,0.55)", alignItems: "center", justifyContent: "center" }}>
                      {photos[i] ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={photos[i] as string} width={photo} height={photo} alt="" style={{ width: photo, height: photo, borderRadius: photo / 2, objectFit: "cover" }} />
                      ) : (
                        <div style={{ display: "flex", width: photo, height: photo, borderRadius: photo / 2, backgroundColor: "#13223a", color: GOLD, fontSize: big ? 72 : 58, fontWeight: 700, alignItems: "center", justifyContent: "center", fontFamily: "Playfair Display" }}>
                          {s.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div style={{ display: "flex", justifyContent: "center", textAlign: "center", marginTop: 14, fontSize: big ? 25 : 21, fontWeight: 700, color: "#ffffff", lineHeight: 1.15 }}>{s.name}</div>
                    {s.role?.trim() ? <div style={{ display: "flex", justifyContent: "center", textAlign: "center", marginTop: 5, fontSize: big ? 17 : 15, fontWeight: 600, letterSpacing: 1.5, color: GOLD }}>{s.role.trim().toUpperCase()}</div> : null}
                    {s.topic?.trim() ? <div style={{ display: "flex", justifyContent: "center", textAlign: "center", marginTop: 5, fontSize: big ? 16 : 14, color: "rgba(255,255,255,0.72)", lineHeight: 1.3 }}>{s.topic.trim()}</div> : null}
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div style={{ display: "flex", flex: 1 }} />

          {/* Details band */}
          <div style={{ display: "flex", width: "100%", backgroundColor: "rgba(5,10,18,0.78)", border: "1px solid rgba(214,179,87,0.5)", padding: "26px 34px", gap: 26 }}>
            {detail("calendar", "DATE", data.date)}
            {detail("clock", "TIME", data.time)}
            {detail("pin", "VENUE", data.venue)}
          </div>
        </div>

        {/* Gold footer bar */}
        <div style={{ position: "absolute", bottom: 0, left: 0, width: W, height: 58, display: "flex", alignItems: "center", justifyContent: "center", backgroundImage: "linear-gradient(90deg, #b8913f 0%, #e3c98a 50%, #b8913f 100%)", color: NAVY, fontSize: 16, fontWeight: 700, letterSpacing: 5 }}>
          FHIGLOBAL.AE · FHI GLOBAL PROPERTY · DUBAI
        </div>
      </div>
    ),
    { width: W, height: H, fonts: fonts.map((f) => ({ name: f.name, data: f.data, weight: f.weight, style: f.style })) },
  )
  return Buffer.from(await res.arrayBuffer())
}
