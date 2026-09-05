import "server-only"

import { ImageResponse } from "next/og"
import { SITE_URL } from "@/lib/seo"
import { BIRTHDAY_DESIGNS, NAME_FILL, TEMPLATE_H, TEMPLATE_W } from "@/features/dashboard/poster-maker/birthday-designs"

/**
 * Server-rendered birthday poster — any of the poster studio's designs with
 * the celebrant's photo in the artwork's opening and their name in the
 * design's lettering color. The studio's pixel-mask fitting is a client-canvas
 * trick; satori gets the ellipse fit instead, which is what most designs use
 * anyway (see features/dashboard/poster-maker/birthday-designs.ts). Used by
 * the birthday greeting emails (Midnight Skyline default) and FHI Assistant's
 * on-demand poster tool.
 */

const W = TEMPLATE_W
const H = TEMPLATE_H
export const DEFAULT_POSTER_DESIGN = "midnight"

export function posterDesignIds(): string[] {
  return BIRTHDAY_DESIGNS.map((d) => d.id)
}

export function posterDesignLabel(id: string): string {
  return BIRTHDAY_DESIGNS.find((d) => d.id === id)?.label ?? id
}

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
  designId?: string
}): Promise<Buffer | null> {
  const design =
    BIRTHDAY_DESIGNS.find((d) => d.id === (input.designId ?? DEFAULT_POSTER_DESIGN)) ??
    BIRTHDAY_DESIGNS.find((d) => d.id === DEFAULT_POSTER_DESIGN) ??
    BIRTHDAY_DESIGNS[0]
  const WELL = design.well
  const NAME = design.name
  const nameColor = NAME_FILL[design.name.style].mid
  const template = await asDataUri(`${SITE_URL}${design.src}`)
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
              color: "#e3c169",
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
            color: nameColor,
            letterSpacing: NAME.tracking ?? 2,
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
