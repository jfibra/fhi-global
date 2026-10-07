import { unstable_cache } from "next/cache"
import { SITE_URL } from "@/lib/seo"
import { COMPANY, companyAddressLine, companyLicenceLine } from "@/lib/company"
import { createPublicSupabaseClient } from "@/lib/supabase/public"
import {
  SEO_AREA_GUIDES,
  SEO_BUYER_GUIDES,
  SEO_HANDOVER_PAGES,
  SEO_SEARCH_PAGES,
  SEO_TYPE_AND_AREA_PAGES,
  type SeoPage,
} from "@/lib/seo-pages"

/**
 * /llms.txt — a machine-readable site guide for AI assistants and answer
 * engines (llmstxt.org convention). Before this route existed, the URL fell
 * through to the [slug] catch-all and soft-404'd as an HTML page.
 *
 * It is generated from the same catalogue the footer and the sitemap read
 * (lib/seo-pages.ts), the active developers, and lib/company.ts — so it can
 * never list a page that does not exist or state facts the site does not. The
 * hand-written version covered 8 of ~50 key pages and claimed a second office
 * in Abu Dhabi that /contact never mentioned.
 */
export const dynamic = "force-dynamic"

const getDeveloperLinks = unstable_cache(
  async () => {
    const supabase = createPublicSupabaseClient()
    const [{ data, error }, { data: live, error: liveError }] = await Promise.all([
      supabase
        .from("developers")
        .select("id, name, slug")
        .eq("is_active", true)
        .is("deleted_at", null)
        .not("slug", "is", null)
        .order("name", { ascending: true }),
      supabase
        .from("projects")
        .select("developer_id")
        .eq("is_active", true)
        .eq("is_published", true)
        .is("deleted_at", null)
        .not("developer_id", "is", null)
        .limit(5000),
    ])
    // Thrown, so a failed read is never cached for the hour.
    if (error) throw new Error(error.message)
    if (liveError) throw new Error(liveError.message)
    // Only developers with something to show: an empty developer page is noindex and out of the sitemap, so it
    // does not belong in a guide to the site's content either.
    const withProjects = new Set((live ?? []).map((r) => String(r.developer_id)))
    return ((data ?? []) as { id: string; name: string; slug: string }[]).filter((d) => withProjects.has(String(d.id)))
  },
  ["llms-developers-v2"],
  { revalidate: 3600, tags: ["projects"] },
)

const pageLine = (p: SeoPage) => `- [${p.label}](${SITE_URL}/${p.slug}): ${p.description}`

export async function GET() {
  // A database blip must not take the file down: the developers section is just left out (and the file is
  // cached briefly instead of for the hour, so the section comes back soon).
  const developerRead = await getDeveloperLinks().catch(() => null)
  const developers = developerRead ?? []

  const licence = companyLicenceLine()
  // Whatever of the legal name and the licence is published; nothing (not a stray ". Office:") when neither is.
  const identity = COMPANY.legalName ? `${COMPANY.legalName}${licence ? ` (${licence})` : ""}` : licence
  const body = `# ${COMPANY.name}

> ${COMPANY.name} is a Dubai-based real-estate brokerage and property portal. It lists off-plan and ready
> residential projects from the UAE's developers, agent property listings for sale and rent, developer
> profiles, buyer guides, company events and property news.

${identity ? `${identity}. ` : ""}Office: ${companyAddressLine()}.
Contact: ${COMPANY.email} · ${COMPANY.phone} (WhatsApp)

## Buyer guides

${SEO_BUYER_GUIDES.map(pageLine).join("\n")}

## Search pages

${[...SEO_SEARCH_PAGES, ...SEO_TYPE_AND_AREA_PAGES].map(pageLine).join("\n")}

## Handover calendar

${SEO_HANDOVER_PAGES.map(pageLine).join("\n")}

## Area guides

${SEO_AREA_GUIDES.map(pageLine).join("\n")}

## Browse the site

- [All projects](${SITE_URL}/projects): the full catalogue of off-plan and ready developments
- [Buy](${SITE_URL}/buy): properties and projects for sale in the UAE
- [Rent](${SITE_URL}/rent): properties listed for rent by FHI agents
- [Developers](${SITE_URL}/developers): profiles of UAE property developers and their projects
- [Mortgage calculator](${SITE_URL}/dubai-mortgage-calculator): monthly payments and the upfront costs of buying in Dubai
- [Open data](${SITE_URL}/open-data): Dubai Land Department transaction data
- [News](${SITE_URL}/news): Dubai and UAE real-estate news
- [Events](${SITE_URL}/events): FHI Global seminars, summits and expos
- [About](${SITE_URL}/about): who FHI Global is
- [Contact](${SITE_URL}/contact): the Dubai office, phone, WhatsApp and email
${
  developers.length > 0
    ? `
## Developers

${developers.map((d) => `- [${d.name}](${SITE_URL}/${d.slug}): projects by ${d.name}`).join("\n")}
`
    : ""
}
## Machine-readable indexes

- [Sitemap index](${SITE_URL}/sitemap.xml): all indexable URLs, sharded by section
- [Google News sitemap](${SITE_URL}/news-sitemap.xml): articles from the last 48 hours
`
  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": developerRead === null ? "public, max-age=300, s-maxage=300" : "public, max-age=3600, s-maxage=3600",
    },
  })
}
