import { PAGES_LASTMOD, SITE_URL, buildUrlsetXml, sitemapResponse } from "@/lib/sitemap-helpers"
import { SEO_PAGES } from "@/lib/seo-pages"

/** /sitemap-pages-1.xml — the static top-level pages. */
export const dynamic = "force-dynamic"

const STATIC_PATHS = [
  "/",
  "/buy",
  "/rent",
  "/projects",
  "/developers",
  "/agents",
  "/agent-websites",
  "/events",
  "/news",
  "/gallery",
  "/about",
  "/contact",
  "/dubai-mortgage-calculator",
  // Popular-searches landing pages (lib/seo-pages.ts) — derived from the
  // catalog so a new entry is in the sitemap the moment it ships.
  ...SEO_PAGES.map((p) => `/${p.slug}`),
]

export async function GET(_req: Request, ctx: { params: Promise<{ page: string }> }) {
  const { page } = await ctx.params
  if (page !== "1") return new Response("Not found", { status: 404 })

  const urls = STATIC_PATHS.map((path) => ({
    loc: `${SITE_URL}${path === "/" ? "" : path}` || SITE_URL,
    lastmod: PAGES_LASTMOD,
  }))
  return sitemapResponse(buildUrlsetXml(urls))
}
