import "server-only"

import { ImageResponse } from "next/og"
import { SITE_URL } from "@/lib/seo"

/**
 * Server-rendered birthday poster for the greeting email — the poster
 * studio's "Midnight Skyline" design (Dubai at dusk) with the celebrant's
 * photo in the artwork's opening and their name in gold. The studio's
 * pixel-mask fitting is a client-canvas trick; this design's opening is an
 * ellipse fit anyway (see features/dashboard/poster-maker/birthday-designs.ts),
 * so an absolutely-positioned rounded photo lands exactly where the studio
 * would put it.
 */

const W = 1024
const H = 1536
// Measured from the artwork — same numbers as the studio's "midnight" design.
const WELL = { x0: 265, y0: 548, x1: 787, y1: 1066 }
const NAME = { cx: 519, baseline: 1152, maxWidth: 520, size: 58 }
const GOLD = "#e3c169"

/** Inline a remote image so satori never depends on a second fetch. */
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

export async function renderBirthdayPosterPng(input: {
  name: string
  photoUrl: string | null
}): Promise<Buffer | null> {
  const template = await asDataUri(`${SITE_URL}/images/birthday2-blank.png`)
  if (!template) return null
  const photo = input.photoUrl ? await asDataUri(input.photoUrl) : null
  const wellW = WELL.x1 - WELL.x0
  const wellH = WELL.y1 - WELL.y0
  const name = input.name.trim().replace(/\s+/g, " ")
  // Long names shrink instead of wrapping over the artwork.
  const size = name.length > 18 ? Math.max(38, Math.round((NAME.size * 18) / name.length)) : NAME.size

  const res = new ImageResponse(
    (
      <div style={{ width: W, height: H, display: "flex", position: "relative" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={template} width={W} height={H} style={{ position: "absolute", top: 0, left: 0 }} alt="" />
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photo}
            style={{
              position: "absolute",
              left: WELL.x0,
              top: WELL.y0,
              width: wellW,
              height: wellH,
              borderRadius: "50%",
              objectFit: "cover",
            }}
            alt=""
          />
        ) : (
          <div
            style={{
              position: "absolute",
              left: WELL.x0,
              top: WELL.y0,
              width: wellW,
              height: wellH,
              borderRadius: "50%",
              background: "#0a2647",
              color: GOLD,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 230,
              fontWeight: 700,
            }}
          >
            {name.charAt(0).toUpperCase()}
          </div>
        )}
        <div
          style={{
            position: "absolute",
            left: NAME.cx - NAME.maxWidth / 2,
            top: NAME.baseline - size,
            width: NAME.maxWidth,
            display: "flex",
            justifyContent: "center",
            fontSize: size,
            fontWeight: 700,
            color: GOLD,
            letterSpacing: 2,
            whiteSpace: "nowrap",
          }}
        >
          {name}
        </div>
      </div>
    ),
    { width: W, height: H },
  )
  return Buffer.from(await res.arrayBuffer())
}
