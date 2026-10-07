import { ImageResponse } from "next/og"
import { getSeoPage } from "@/lib/seo-pages"
import { getSeoInventory, seoCardFacts } from "@/lib/seo-inventory"
import { isSafeRemoteImageUrl } from "@/lib/image-hosts"
import { ogCacheHeaders, ogJpeg, ogPicture } from "@/lib/og-picture"
import { OG_LOGO_H, OG_LOGO_W, ogDefaultBackground, ogLogo } from "@/lib/og-assets"

export const runtime = "nodejs"

/**
 * Share card for the catalogue pages (landings, area guides, buyer guides, handover pages): the page's H1 over
 * its lead project's photo, with one line of facts ("42 projects · from AED 650K"). Without it all of them
 * shared the same /og-default.jpg. The page's metadata points here with a ?v= token that covers the lead photo,
 * the count and the price (lib/seo-inventory.ts seoOgImage), so the long CDN cache is safe when the card is
 * complete; a card that fell back (no photo loaded, inventory read failed) stays on the short cache.
 */
export async function GET(_: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params
  // A closed set (the catalogue), so a junk slug never renders a card.
  const seo = getSeoPage(slug)
  if (!seo) return new Response("Not found", { status: 404, headers: { "cache-control": "public, max-age=60, s-maxage=60" } })

  // An inventory read that fails still returns a card (the neutral one) — on the short cache.
  let rows: Awaited<ReturnType<typeof getSeoInventory>> | null = null
  try {
    rows = await getSeoInventory(seo.slug)
  } catch (e) {
    console.error("[og/seo] inventory read failed:", e instanceof Error ? e.message : e)
  }
  const facts = rows ? seoCardFacts(seo, rows) : { photo: null, stat: null }
  const photoUrl = facts.photo && isSafeRemoteImageUrl(facts.photo) ? facts.photo : null
  const picture = await ogPicture(photoUrl, 1200, 630)
  // No photo of its own → the neutral skyline, never an unrelated project from the pool.
  const background = picture ? null : await ogDefaultBackground()
  const mark = await ogLogo()
  const complete = rows !== null && (facts.photo ? picture !== null : background !== null)

  const headline = seo.h1.length > 70 ? `${seo.h1.slice(0, 67)}...` : seo.h1
  const subtitle = facts.stat ?? (seo.kind === "guide" ? "Dubai property guide" : "Dubai projects")
  const image = picture ?? background

  return ogJpeg(
    new ImageResponse(
      (
        <div
          style={{ width: "100%", height: "100%", display: "flex", position: "relative", fontFamily: "Arial, sans-serif", color: "white", background: "#001f3f" }}
        >
          {image && <img src={image} alt={seo.h1} width={1200} height={630} style={{ position: "absolute", top: 0, left: 0, width: 1200, height: 630, objectFit: "cover" }} />}
          {/* Satori has no `inset` shorthand — the scrim carries explicit sizes. */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: 1200,
              height: 630,
              background: "linear-gradient(180deg, rgba(0,20,40,0.15) 0%, rgba(0,20,40,0.35) 40%, rgba(0,20,40,0.92) 100%)",
            }}
          />
          <div style={{ display: "flex", flexDirection: "column", position: "absolute", left: 56, bottom: 52, right: 56, gap: 14 }}>
            {mark && <img src={mark} alt="FHI Global" width={OG_LOGO_W} height={OG_LOGO_H} style={{ width: OG_LOGO_W, height: OG_LOGO_H, objectFit: "contain" }} />}
            <div style={{ fontSize: seo.h1.length > 40 ? 52 : 60, lineHeight: 1.05, fontWeight: 800, textShadow: "0 2px 18px rgba(0,10,30,0.55)" }}>{headline}</div>
            <div style={{ fontSize: 28, color: "#f0d89b", fontWeight: 700 }}>{subtitle}</div>
          </div>
        </div>
      ),
      { width: 1200, height: 630, headers: ogCacheHeaders(complete) },
    ),
  )
}
