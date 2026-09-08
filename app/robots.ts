import type { MetadataRoute } from "next"

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://fhiglobal.ae"

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // No trailing slashes: a bare prefix covers both the exact path and its children.
      // Dashboards are now role-prefixed (`/admin`, `/agent`, …). "/agent/" and
      // "/developer/" keep a trailing slash so they do NOT block the public
      // "/agents", "/agent-websites", and "/developers" pages; the exact "/agent"
      // and "/developer" roots are still noindexed via the X-Robots-Tag header in
      // next.config. "/register", "/staff-login" and "/developers-login" are
      // deliberately NOT listed — a crawler must be able to fetch the page to see
      // its noindex signal and drop it (the old "/login" was indexed and
      // temp-redirects (307) to "/staff-login").
      disallow: [
        "/dashboard",
        "/api",
        "/internal",
        "/superadmin",
        "/admin",
        "/teamleader",
        "/unitmanager",
        "/agent/",
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
