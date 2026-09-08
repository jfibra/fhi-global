import { SITE_URL } from "@/lib/seo"

/**
 * /llms.txt — a machine-readable site guide for AI assistants and answer
 * engines (llmstxt.org convention). Before this route existed, the URL fell
 * through to the [slug] catch-all and soft-404'd as an HTML page.
 */
export const dynamic = "force-dynamic"

export async function GET() {
  const body = `# FHI Global

> FHI Global is a Dubai-based real-estate brokerage and property portal. It lists
> off-plan and ready residential projects from the UAE's leading developers,
> agent property listings for sale and rent, developer profiles, company events,
> and daily real-estate news.

Head office: Office 98, 3rd Floor, Rigga Business Center, Al Rigga, Deira, Dubai, UAE.
Contact: info@fhiglobal.ae · +971 56 742 8288

## Browse

- [New projects in Dubai](${SITE_URL}/projects): the full catalog of off-plan and ready developments
- [Buy property](${SITE_URL}/buy): properties and projects for sale in the UAE
- [Rent property](${SITE_URL}/rent): rental listings in the UAE
- [Developers](${SITE_URL}/developers): profiles of UAE property developers and their projects
- [News](${SITE_URL}/news): Dubai and UAE real-estate news, updated daily
- [Events](${SITE_URL}/events): FHI Global seminars, summits, and expos
- [About](${SITE_URL}/about): who FHI Global is
- [Contact](${SITE_URL}/contact): offices in Dubai and Abu Dhabi

## Machine-readable indexes

- [Sitemap index](${SITE_URL}/sitemap.xml): all indexable URLs, sharded by section
- [Google News sitemap](${SITE_URL}/news-sitemap.xml): articles from the last 48 hours
`
  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  })
}
