import { SITE_URL, buildUrlsetXml, sitemapResponse } from "@/lib/sitemap-helpers"
import { SEO_PAGES } from "@/lib/seo-pages"

/** /sitemap-pages-1.xml — the static top-level pages. */
export const dynamic = "force-dynamic"

const STATIC_PATHS = [
  "/",
  "/buy",
  "/rent",
  "/projects",
  "/developers",
  "/open-data",
  "/agents",
  "/agent-websites",
  "/events",
  "/news",
  "/gallery",
  "/about",
  "/contact",
  "/dubai-mortgage-calculator",
  // The legal pages are public and indexable; leaving them out of the sitemap
  // made them the only indexable pages on the site that crawlers had to find by
  // link alone.
  "/privacy",
  "/terms",
  "/cookies",
]

export async function GET(_req: Request, ctx: { params: Promise<{ page: string }> }) {
  const { page } = await ctx.params
  if (page !== "1") return new Response("Not found", { status: 404 })

  // Hubs and legal pages carry no lastmod — their content is code and live data
  // that changes constantly or never, and a made-up date does more harm than
  // none. The curated SEO pages (lib/seo-pages.ts) carry theirs once someone sets
  // `updated`, which is a deliberate act when the copy is edited.
  const urls = [
    ...STATIC_PATHS.map((path) => ({ path, lastmod: undefined as string | undefined })),
    // Popular-searches landing pages — derived from the catalog so a new entry is
    // in the sitemap the moment it ships.
    ...SEO_PAGES.map((p) => ({ path: `/${p.slug}`, lastmod: p.updated })),
  ].map(({ path, lastmod }) => ({
    loc: `${SITE_URL}${path === "/" ? "" : path}` || SITE_URL,
    lastmod,
  }))
  return sitemapResponse(buildUrlsetXml(urls))
}
