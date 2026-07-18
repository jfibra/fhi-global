import type { MetadataRoute } from "next"

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://fhiglobal.ae"

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // No trailing slashes: "/dashboard" covers both /dashboard and /dashboard/*.
      // "/login" is deliberately NOT listed — Google already indexed it, and a crawler
      // must be able to fetch the page to see its noindex signal and drop it.
      disallow: [
        "/dashboard",
        "/api",
        "/register",
        "/profile",
        "/admin",
        "/internal",
      ],
    },
    sitemap: [`${SITE_URL}/sitemap.xml`, `${SITE_URL}/news-sitemap.xml`],
    host: SITE_URL,
  }
}
