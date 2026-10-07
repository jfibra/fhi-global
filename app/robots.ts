import type { MetadataRoute } from "next"

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://fhiglobal.ae"

// Private surfaces. EVERY entry ends in a slash: a bare "/admin" is a prefix rule and would also block a
// developer whose slug starts with it ("/administration-realty"), and developers choose their own slugs at
// the site root. The slash form blocks the children only; the exact roots ("/admin", "/dashboard", …) are
// not blocked — they are noindexed by the X-Robots-Tag header in next.config.mjs, which a crawler can
// only see if it is allowed to fetch the page. "/register", "/staff-login" and "/developers-login" are
// deliberately NOT listed for the same reason (the old "/login" was indexed and temp-redirects (307) to
// "/staff-login"). "/agent/" and "/developer/" keep their slash so they never block the public "/agents",
// "/agent-websites" and "/developers".
const PRIVATE_DISALLOW = [
  "/dashboard/",
  "/api/",
  "/internal/",
  "/superadmin/",
  "/admin/",
  "/teamleader/",
  "/unitmanager/",
  "/agent/",
  "/developer/",
  "/secretary/",
  "/teamsecretary/",
  "/member/",
  "/editor/",
  "/globalpartner/",
]

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: PRIVATE_DISALLOW,
    },
    // No `host:` line: it is a Yandex-only directive that Google and Bing ignore, and a
    // non-standard line in robots.txt is just noise for every other parser. The apex
    // host is enforced by the www → apex redirect (next.config.mjs / Vercel domains).
    sitemap: [`${SITE_URL}/sitemap.xml`, `${SITE_URL}/news-sitemap.xml`],
  }
}
