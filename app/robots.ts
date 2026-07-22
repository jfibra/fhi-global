import type { MetadataRoute } from "next"

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://fhiglobal.ae"

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // No trailing slashes: a bare prefix covers both the exact path and its children.
      // Dashboards are now role-prefixed (`/admin`, `/agent`, …). "/developer/" keeps a
      // trailing slash so it does NOT block the public "/developers" pages; the exact
      // "/developer" root is still noindexed via the X-Robots-Tag header in next.config.
      // "/login" is deliberately NOT listed — Google already indexed it, and a crawler
      // must be able to fetch the page to see its noindex signal and drop it.
      disallow: [
        "/dashboard",
        "/api",
        "/register",
        "/internal",
        "/superadmin",
        "/admin",
        "/teamleader",
        "/unitmanager",
        "/agent",
        "/developer/",
        "/secretary",
        "/teamsecretary",
        "/member",
      ],
    },
    sitemap: [`${SITE_URL}/sitemap.xml`, `${SITE_URL}/news-sitemap.xml`],
    host: SITE_URL,
  }
}
