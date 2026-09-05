import "server-only"

import { ImageResponse } from "next/og"
import { SITE_URL } from "@/lib/seo"

/**
 * Server-rendered meeting poster for FHI Assistant — a satori take on the
 * poster studio's "Business Meeting" design (navy & gold executive invite
 * with speaker cards). The studio itself captures a live DOM in the browser;
 * the chat needs a URL-addressable image, so this renders the same look
 * server-side. Speakers that match FHI members carry their profile photo.
 */

const W = 1080
const H = 1350
const GOLD = "#d6b357"
const NAVY_BG = "#0d1522"

export type MeetingPosterSpeaker = { name: string; role?: string; topic?: string; photo?: string | null }
export type MeetingPosterData = {
  title: string
  subtitle?: string
  tagline?: string
  date: string
  time: string
  venue: string
  speakers?: MeetingPosterSpeaker[]
}

async function asDataUri(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { cache: "no-store" })
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

export async function renderMeetingPosterPng(data: MeetingPosterData): Promise<Buffer | null> {
  const logo = await asDataUri(`${SITE_URL}/FHI_Branding_White.png`)
  const speakers = (data.speakers ?? []).slice(0, 6)
  const photos = await Promise.all(speakers.map((s) => (s.photo ? asDataUri(s.photo) : Promise.resolve(null))))

  const detail = (label: string, value: string) => (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1 }}>
      <div style={{ display: "flex", fontSize: 20, fontWeight: 700, letterSpacing: 5, color: GOLD }}>{label}</div>
      <div
        style={{
          display: "flex",
          marginTop: 8,
          fontSize: 27,
          fontWeight: 700,
          color: "#ffffff",
          textAlign: "center",
          maxWidth: 320,
        }}
      >
        {value}
      </div>
    </div>
  )

  const res = new ImageResponse(
    (
      <div
        style={{
          width: W,
          height: H,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          backgroundColor: NAVY_BG,
          padding: "56px 64px 0",
        }}
      >
        {/* Brand */}
        {logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logo} height={64} alt="" />
        ) : (
          <div style={{ display: "flex", fontSize: 34, fontWeight: 800, color: GOLD }}>FHI GLOBAL PROPERTY</div>
        )}
        <div style={{ display: "flex", width: 140, height: 3, backgroundColor: GOLD, marginTop: 26 }} />

        {/* Tagline / title / subtitle */}
        <div
          style={{
            display: "flex",
            marginTop: 30,
            fontSize: 22,
            fontWeight: 700,
            letterSpacing: 8,
            color: GOLD,
          }}
        >
          {(data.tagline?.trim() || "You're invited").toUpperCase()}
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 14,
            fontSize: data.title.length > 26 ? 56 : 68,
            fontWeight: 800,
            color: "#ffffff",
            textAlign: "center",
            lineHeight: 1.12,
            maxWidth: 940,
            justifyContent: "center",
          }}
        >
          {data.title}
        </div>
        {data.subtitle?.trim() ? (
          <div
            style={{
              display: "flex",
              marginTop: 14,
              fontSize: 28,
              fontWeight: 600,
              color: "#c7d2e0",
              textAlign: "center",
              maxWidth: 860,
              justifyContent: "center",
            }}
          >
            {data.subtitle}
          </div>
        ) : null}

        {/* Speakers — centered in the space between title and details band. */}
        <div style={{ display: "flex", flex: 1 }} />
        {speakers.length > 0 ? (
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              justifyContent: "center",
              gap: 30,
              maxWidth: 960,
            }}
          >
            {speakers.map((s, i) => (
              <div
                key={`${s.name}-${i}`}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  width: speakers.length <= 3 ? 280 : 210,
                  backgroundColor: "#111c2e",
                  border: `1px solid ${GOLD}55`,
                  padding: "26px 18px 22px",
                }}
              >
                {photos[i] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={photos[i] as string}
                    width={speakers.length <= 3 ? 148 : 116}
                    height={speakers.length <= 3 ? 148 : 116}
                    style={{
                      borderRadius: "50%",
                      objectFit: "cover",
                      border: `4px solid ${GOLD}`,
                    }}
                    alt=""
                  />
                ) : (
                  <div
                    style={{
                      display: "flex",
                      width: speakers.length <= 3 ? 148 : 116,
                      height: speakers.length <= 3 ? 148 : 116,
                      borderRadius: "50%",
                      border: `4px solid ${GOLD}`,
                      backgroundColor: "#0a2647",
                      color: GOLD,
                      fontSize: speakers.length <= 3 ? 64 : 50,
                      fontWeight: 800,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {s.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <div
                  style={{
                    display: "flex",
                    marginTop: 16,
                    fontSize: speakers.length <= 3 ? 26 : 22,
                    fontWeight: 800,
                    color: "#ffffff",
                    textAlign: "center",
                    justifyContent: "center",
                  }}
                >
                  {s.name}
                </div>
                {s.role?.trim() ? (
                  <div style={{ display: "flex", marginTop: 6, fontSize: 19, fontWeight: 700, color: GOLD, textAlign: "center", justifyContent: "center" }}>
                    {s.role}
                  </div>
                ) : null}
                {s.topic?.trim() ? (
                  <div style={{ display: "flex", marginTop: 6, fontSize: 17, color: "#93a3b8", textAlign: "center", justifyContent: "center" }}>
                    {s.topic}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}

        {/* Details band pinned to the bottom */}
        <div style={{ display: "flex", flex: 1 }} />
        <div
          style={{
            display: "flex",
            width: W,
            borderTop: `3px solid ${GOLD}`,
            backgroundColor: "#0a1220",
            padding: "34px 64px",
            gap: 20,
          }}
        >
          {detail("DATE", data.date)}
          {detail("TIME", data.time)}
          {detail("VENUE", data.venue)}
        </div>
        <div
          style={{
            display: "flex",
            width: W,
            justifyContent: "center",
            backgroundColor: "#050a12",
            padding: "16px 0",
            fontSize: 18,
            letterSpacing: 4,
            color: "#8091a5",
          }}
        >
          FHIGLOBAL.AE · FHI GLOBAL PROPERTY · DUBAI
        </div>
      </div>
    ),
    { width: W, height: H },
  )
  return Buffer.from(await res.arrayBuffer())
}
