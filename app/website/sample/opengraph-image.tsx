import { ImageResponse } from "next/og"
import { headers } from "next/headers"
import { SITE_URL } from "@/lib/seo"
import { SAMPLE_DATA } from "../_data"
import { loadOgFonts, OG_SIZE, OgHero } from "../_components/og-hero"

// Link-share thumbnail for the design sample — the hero with the broker
// contact/RERA card (which the live page no longer renders).

export const runtime = "nodejs"
export const alt = "Website Builder — Sample Template"
export const size = OG_SIZE
export const contentType = "image/png"

export default async function Image() {
  // Resolve the request host so local/staging thumbnails load their own assets.
  let base = SITE_URL
  try {
    const host = (await headers()).get("host")
    if (host) base = `${host.startsWith("localhost") ? "http" : "https"}://${host}`
  } catch {
    // build-time render — SITE_URL fallback
  }
  return new ImageResponse(<OgHero data={SAMPLE_DATA} base={base} />, { ...OG_SIZE, fonts: await loadOgFonts() })
}
