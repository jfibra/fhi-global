import "server-only"

import fs from "node:fs/promises"
import path from "node:path"
import { ImageResponse } from "next/og"

/**
 * Server-rendered Top Seller certificate for the congratulations emails — the
 * Sales Marketing studio's certificate artwork (topsellers1) with the agent's
 * photo in the medallion, their name on the recipient rule, and total sales /
 * deals / period on the three ruled slots. Blank positions measured from the
 * artwork, same numbers as features/dashboard/sales/marketing/top-seller-poster.tsx.
 * (The template is the PNG copy of the studio's webp — satori can't decode webp.)
 */

const W = 1448
const H = 1086
const NAVY_DEEP = "#00112a"
const PHOTO = { cx: 273, cy: 448, d: 330 }
const NAME = { cx: 857, baseline: 570, maxWidth: 620 }
const SLOTS = [
  { cx: 553, baseline: 924 },
  { cx: 834, baseline: 924 },
  { cx: 1114, baseline: 924 },
]

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

// Read from disk and memoized — same pattern as the /og/business-card logo.
let templateCache: string | null = null
async function templateDataUri(): Promise<string | null> {
  if (templateCache) return templateCache
  try {
    const buf = await fs.readFile(path.join(process.cwd(), "public", "images", "topsellers1-cert.png"))
    templateCache = `data:image/png;base64,${buf.toString("base64")}`
    return templateCache
  } catch {
    return null
  }
}

export async function renderTopSellerCertificatePng(input: {
  name: string
  photoUrl: string | null
  totalLabel: string
  dealsLabel: string
  periodLabel: string
}): Promise<Buffer | null> {
  const template = await templateDataUri()
  if (!template) return null
  const photo = input.photoUrl ? await asDataUri(input.photoUrl) : null
  const name = input.name.trim().replace(/\s+/g, " ")
  const nameSize = name.length > 22 ? Math.max(30, Math.round((46 * 22) / name.length)) : 46
  const slotValues = [input.totalLabel, input.dealsLabel, input.periodLabel]

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
              left: PHOTO.cx - PHOTO.d / 2,
              top: PHOTO.cy - PHOTO.d / 2,
              width: PHOTO.d,
              height: PHOTO.d,
              borderRadius: "50%",
              objectFit: "cover",
            }}
            alt=""
          />
        ) : (
          <div
            style={{
              position: "absolute",
              left: PHOTO.cx - PHOTO.d / 2,
              top: PHOTO.cy - PHOTO.d / 2,
              width: PHOTO.d,
              height: PHOTO.d,
              borderRadius: "50%",
              backgroundColor: "#0a2647",
              color: "#d6b357",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 140,
              fontWeight: 800,
            }}
          >
            {name.charAt(0).toUpperCase()}
          </div>
        )}
        <div
          style={{
            position: "absolute",
            left: NAME.cx - NAME.maxWidth / 2,
            top: NAME.baseline - nameSize,
            width: NAME.maxWidth,
            display: "flex",
            justifyContent: "center",
            fontSize: nameSize,
            fontWeight: 800,
            color: NAVY_DEEP,
            whiteSpace: "nowrap",
          }}
        >
          {name}
        </div>
        {SLOTS.map((slot, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              left: slot.cx - 110,
              top: slot.baseline - 26,
              width: 220,
              display: "flex",
              justifyContent: "center",
              fontSize: (slotValues[i] ?? "").length > 14 ? 20 : 24,
              fontWeight: 700,
              color: NAVY_DEEP,
              whiteSpace: "nowrap",
            }}
          >
            {slotValues[i] ?? ""}
          </div>
        ))}
      </div>
    ),
    { width: W, height: H },
  )
  return Buffer.from(await res.arrayBuffer())
}
