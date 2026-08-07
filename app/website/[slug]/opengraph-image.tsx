import { ImageResponse } from "next/og"
import { headers } from "next/headers"
import { createAdminSupabase } from "@/lib/admin-supabase"
import { loadSiteBySlug } from "@/lib/website-builder-service"
import { SITE_URL } from "@/lib/seo"
import { SAMPLE_DATA } from "../_data"
import { OG_SIZE, OgHero } from "../_components/og-hero"

// Link-share thumbnail for a published agent site — the hero exactly as the
// site renders it (banner, headline, description, stats, palette) plus the
// broker contact/RERA card at the bottom right (thumbnail-only).

export const runtime = "nodejs"
export const alt = "Agent website"
export const size = OG_SIZE
export const contentType = "image/png"

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const site = await loadSiteBySlug(createAdminSupabase(), slug)
  const data = site?.data ?? SAMPLE_DATA

  let base = SITE_URL
  try {
    const host = (await headers()).get("host")
    if (host) base = `${host.startsWith("localhost") ? "http" : "https"}://${host}`
  } catch {
    // build-time render — SITE_URL fallback
  }
  return new ImageResponse(<OgHero data={data} base={base} />, { ...OG_SIZE })
}
