import { ImageResponse } from "next/og"
import { headers } from "next/headers"
import { notFound } from "next/navigation"
import { createAdminSupabase } from "@/lib/admin-supabase"
import { loadSiteBySlug } from "@/lib/website-builder-service"
import { SITE_URL } from "@/lib/seo"
import { agentDisplayName } from "@/lib/agent-site"
import { ogJpeg, ogPicture } from "@/lib/og-picture"
import { loadOgFonts, OG_SIZE, OgHero } from "../_components/og-hero"

// Link-share thumbnail for a published agent site — the hero exactly as the
// site renders it (banner, headline, description, stats, palette) plus the
// broker contact/RERA card at the bottom right (thumbnail-only).
//
// The banner goes through ogPicture: Satori can't draw the WebP/AVIF uploads,
// and one it can't draw takes the whole thumbnail down (500) — 10 sites had no
// link preview because of it (2026-10-04). This route is in
// outputFileTracingIncludes (next.config.mjs) so sharp loads on Vercel.

export const runtime = "nodejs"
export const alt = "Agent website"
export const size = OG_SIZE
export const contentType = "image/jpeg"

async function render({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const site = await loadSiteBySlug(createAdminSupabase(), slug)
  // No such site: a 404, not the sample agent's card (name, number and all) under someone else's URL.
  if (!site) notFound()
  const data = site.data

  let base = SITE_URL
  try {
    const host = (await headers()).get("host")
    if (host) base = `${host.startsWith("localhost") ? "http" : "https"}://${host}`
  } catch {
    // build-time render — SITE_URL fallback
  }
  // Transcode the banner without cropping — OgHero frames it (zoom/position) itself.
  // If it can't be fetched or converted, the card still renders, without the photo.
  const banner = data.hero.image
  const bannerUrl = banner ? (/^https?:/.test(banner) ? banner : `${base}${banner}`) : null
  // Big enough to cover the drawn box at the site's zoom (100–300%), no bigger.
  const zoom = Math.min(300, Math.max(100, data.hero.zoom ?? 100)) / 100
  const side = Math.min(2400, Math.round(1300 * zoom))
  const picture = bannerUrl ? await ogPicture(bannerUrl, side, side, "inside") : null
  // A site with no headline of its own (12 of the 23 had none) gets the agent's name and title, as its page's H1 does —
  // otherwise the share card carries no headline at all.
  const hasHeadline = Boolean(data.hero.headline.trim() || data.hero.headlineAccent.trim())
  const hero = hasHeadline
    ? data.hero
    : { ...data.hero, headline: agentDisplayName(data.agent.name), headlineAccent: data.agent.title.trim() }
  const ogData = { ...data, hero: { ...hero, image: picture ?? "" } }
  return new ImageResponse(<OgHero data={ogData} base={base} />, { ...OG_SIZE, fonts: await loadOgFonts() })
}

/** Out as JPEG — a fraction of the PNG's size, so WhatsApp shows the preview (lib/og-picture.ts). */
export default async function Image(props: { params: Promise<{ slug: string }> }) {
  return ogJpeg(await render(props))
}
