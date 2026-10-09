import { Fragment } from "react"
import type { Metadata } from "next"
import Image, { getImageProps } from "next/image"
import { preload as preloadResource } from "react-dom"
import { notFound, permanentRedirect } from "next/navigation"
import Link from "next/link"
import { createPublicSupabaseClient } from "@/lib/supabase/public"
import { absoluteUrl, createPageMetadata, pickFittingTitle, truncateDescription } from "@/lib/seo"
import { ogCardImage } from "@/lib/og-url"
import { MIN_GUIDE_INVENTORY, getSeoInventory, inventoryHandoverRange, inventoryPriceFrom, seoOgImage, type SeoGridRow } from "@/lib/seo-inventory"
import { PROJECT_CARD_IMAGE_SIZES, ProjectCard, formatProjectPrice, type ProjectCardData } from "@/components/project-card"
import { FeaturedProjectsShowcase, type FeaturedProjectData } from "@/components/public/featured-projects-showcase"
import { UaeMap } from "@/components/public/uae-map"
import { MagneticLink } from "@/components/public/magnetic-link"
import { TransitionLink } from "@/components/public/transition-link"
import { Reveal } from "@/components/public/reveal"
import { InView } from "@/components/public/in-view"
import { CountUp } from "@/components/public/count-up"
import { EMIRATES, countByEmirate, emirateCodeForCity, type Emirate } from "@/lib/emirates"
import { SOCIAL_URLS } from "@/lib/social"
import { COMPANY, companyWhatsappHref } from "@/lib/company"
import { getSeoPage, SEO_PAGES, type SeoPage, type SeoPageFilter, type SeoSort } from "@/lib/seo-pages"
import { landingPageForFilter, projectsBrowseTarget, regulatorLine } from "@/lib/seo-page-links"
import { SeoDataTable } from "@/components/public/seo-data-table"
import { InquireForm } from "@/components/public/inquire-form"
import { LeadLink } from "@/components/public/lead-link"
import { WhatsAppFabTarget } from "@/components/public/whatsapp-fab"
import { fetchSectionPage } from "@/lib/sitemap-sections"
import { isTestRecord } from "@/lib/listing-publish-checks"
import { breadcrumbList, developerPageSchema, faqPageSchema, itemListSchema, reviewedGuideSchemas } from "@/lib/structured-data"
import { JsonLd } from "@/components/json-ld"
import { Building2, Facebook, Mail, MapPin, CheckCircle2, ArrowDown, ArrowLeft, Globe } from "lucide-react"

/** The company inbox shown across the public site (contact page, footer). */
const CONTACT_EMAIL = COMPANY.email


// 24 h — purged on developer/project writes by app/api/seo/revalidate.
export const revalidate = 86400

/**
 * Prerender developer profiles + the curated SEO landing pages (production
 * only) so they serve from the ISR cache. IMPORTANT: this route is the
 * site-wide catch-all — `dynamicParams` must stay at its default (true) so
 * unlisted-but-valid slugs still render on demand (and junk slugs 404).
 * SEO_PAGES is a synchronous constant, so those slugs ship even when the
 * Supabase enumeration fails.
 */
export async function generateStaticParams(): Promise<{ slug: string }[]> {
  if (process.env.VERCEL_ENV !== "production") return []
  const seoSlugs = SEO_PAGES.map((p) => ({ slug: p.slug }))
  try {
    const rows = await fetchSectionPage("developers", 1)
    const devSlugs = (rows ?? []).flatMap((r) => (r.slug ? [{ slug: r.slug }] : []))
    return [...devSlugs, ...seoSlugs]
  } catch {
    return seoSlugs
  }
}

type Props = { params: Promise<{ slug: string }> }

/** Every slug in the database is lowercase, so /Dubai-Marina is a mistyped or auto-capitalised link
 *  to the real page: send it there for good instead of a 404. Decided before any query, so crawlers
 *  get the 308 from generateMetadata too. Only for a plain slug (letters, digits, hyphens): Next hands
 *  params over percent-encoded, and "%C3%A9" has capitals that are not a typo — re-casing it would
 *  redirect a valid encoded URL to a different one for nothing. */
const PLAIN_SLUG = /^[A-Za-z0-9-]+$/
function redirectToLowercase(slug: string) {
  if (PLAIN_SLUG.test(slug) && slug !== slug.toLowerCase()) permanentRedirect(`/${slug.toLowerCase()}`)
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  redirectToLowercase(slug)
  const supabase = createPublicSupabaseClient()
  const { data, error } = await supabase
    .from("developers")
    .select("id, name, description, logo_url, logo_bg, address")
    .eq("slug", slug)
    .is("deleted_at", null)
    .maybeSingle()
  // Transient query failure → 5xx (crawlers retry, and a failed ISR
  // revalidation keeps serving the stale page); only a clean miss may 404 —
  // a notFound() fired during an outage gets CACHED as a hard 404.
  if (error) throw new Error("Failed to load developer")
  // Not a developer? The slug may be one of the curated SEO landing pages
  // (new-projects-in-dubai, …) served by this same root segment.
  if (!data) {
    const seo = getSeoPage(slug)
    if (seo) {
      // Its own share card (/og/seo/<slug>): the lead project's photo, the page title and a one-line count. The
      // inventory read is shared with the page body through React's cache(), and a transient error throws (5xx).
      const card = seoOgImage(seo, await getSeoInventory(seo.slug))
      return createPageMetadata({
        title: seo.title,
        description: seo.description,
        openGraphTitle: seo.h1,
        openGraphDescription: seo.description,
        ...card,
        pathname: `/${seo.slug}`,
        keywords: [seo.h1, "Dubai real estate", "UAE property", "off-plan Dubai"],
      })
    }
    // notFound() here, not a placeholder title: as the root-level catch-all,
    // this page answers every unmatched URL on the site. Returning metadata
    // lets the route start streaming, after which the page body's notFound()
    // can only swap the UI — the 200 is already on the wire. Aborting in
    // metadata is what turns a mistyped URL into a real HTTP 404.
    notFound()
  }

  const description =
    truncateDescription(data.description) ||
    `Explore projects by ${data.name} — off-plan and ready properties in Dubai on FHI Global.`
  const keywords = [data.name, data.address, "Dubai developer", "real estate developer UAE"].filter(Boolean) as string[]

  // A developer with nothing live yet is a name, a logo and an empty portfolio: thin content. It stays reachable
  // (its projects may be added tomorrow) but out of the index — and out of the sitemap (lib/sitemap-sections.ts).
  const { count: liveProjects, error: projectsError } = await supabase
    .from("projects")
    .select("id", { count: "exact", head: true })
    .eq("developer_id", data.id)
    .eq("is_active", true)
    .eq("is_published", true)
    .is("deleted_at", null)
  if (projectsError) throw new Error("Failed to load developer projects")

  return createPageMetadata({
    // The first variant that fits 47 characters (the root template adds " | FHI Global").
    title: pickFittingTitle([`${data.name} Projects in Dubai & UAE`, `${data.name} Projects in the UAE`, `${data.name} Projects`]),
    description,
    openGraphTitle: data.name,
    openGraphDescription: description,
    // The card's version covers every field it draws, so editing the developer gives a new URL.
    ...ogCardImage(`/og/developer/${slug}`, data.name, data.logo_url, data.logo_bg, data.description, data.address),
    pathname: `/${slug}`,
    robots: (liveProjects ?? 0) === 0 ? { index: false, follow: true } : undefined,
    keywords,
  })
}

export default async function DeveloperDetailPage({ params }: Props) {
  const { slug } = await params
  redirectToLowercase(slug)
  const supabase = createPublicSupabaseClient()

  const { data: developer, error: devError } = await supabase
    .from("developers")
    .select("*")
    .eq("slug", slug)
    .is("deleted_at", null)
    .maybeSingle()

  if (devError) {
    console.error("[developer-detail] query error:", devError.message)
    // 5xx, not 404: a transient failure must never deindex (or ISR-cache a
    // 404 over) a live developer page.
    throw new Error("Failed to load developer")
  }
  if (!developer) {
    // Same fallthrough as generateMetadata: curated SEO landing pages share
    // this root segment with developer profiles. Developers win on collision.
    const seo = getSeoPage(slug)
    if (seo) return <SeoLandingPage seo={seo} />
    notFound()
  }

  const { data: projects, error: projectsError } = await supabase
    .from("projects")
    .select("id, name, slug, main_image, location, city, community, delivery_quarter, launch_price_from, launch_price_to, currency, status, is_featured, developers(name, logo_url, slug)")
    .eq("developer_id", developer.id)
    .eq("is_active", true)
    .eq("is_published", true)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
  // Same contract as the developer read above: a failed read must surface as a 5xx, not as a page with
  // "0 live projects" that the ISR cache then serves for minutes.
  if (projectsError) throw new Error("Failed to load developer projects")

  // A project with no picture doesn't appear on the public page — a grid of
  // grey "No Image" cards undersells the developer. But main_image being unset
  // doesn't mean the project has no photos: try its gallery first, and hide
  // only the projects with genuinely nothing to show. The portfolio grid, its
  // count pill, and the hero snapshot all use this filtered list; the listings
  // section below deliberately does not (listings carry their own photos).
  const missingImageIds = (projects ?? []).filter((p) => !p.main_image?.trim()).map((p) => p.id)
  const galleryFallback = new Map<number, string>()
  if (missingImageIds.length > 0) {
    const { data: gallery, error: galleryError } = await supabase
      .from("project_images")
      .select("project_id, url, is_main, rank")
      .in("project_id", missingImageIds)
      .order("is_main", { ascending: false })
      .order("rank", { ascending: true })
    // A failed read would hide every project that relies on its gallery photo — and ISR would keep serving that.
    if (galleryError) throw new Error("Failed to load developer project photos")
    for (const g of gallery ?? []) {
      if (g.url && !galleryFallback.has(g.project_id)) galleryFallback.set(g.project_id, g.url)
    }
  }
  const visibleProjects = (projects ?? [])
    .map((p) => ({ ...p, main_image: p.main_image?.trim() || galleryFallback.get(p.id) || null }))
    .filter((p) => p.main_image)

  // Hero counters — live projects, distinct communities and emirates. Counted
  // over the projects this page actually shows (published, with a photo), so
  // the number in the hero always matches the portfolio beneath it.
  const liveCount = visibleProjects.length
  const communityCount = new Set(
    visibleProjects.map((p) => (p.community ?? p.location ?? "").trim().toLowerCase()).filter(Boolean),
  ).size
  const emirateCount = Object.keys(countByEmirate(visibleProjects)).length
  const heroStats = [
    { value: liveCount, label: liveCount === 1 ? "Live project" : "Live projects" },
    { value: communityCount, label: communityCount === 1 ? "Community" : "Communities" },
    { value: emirateCount, label: emirateCount === 1 ? "Emirate" : "Emirates" },
  ].filter((st) => st.value > 0)

  // Published agent listings under this developer's projects (the "on the
  // market right now" view — bridges the projects catalog to buy/rent).
  type DevListing = {
    id: string
    slug: string | null
    title: string
    listing_kind: "sale" | "rent"
    price: number | string | null
    currency: string | null
    project_id: number | null
    agent_listing_images: { url: string; sort_order: number }[] | null
  }
  let listings: DevListing[] = []
  const projectIds = (projects ?? []).map((p) => p.id)
  const projectById = new Map((projects ?? []).map((p) => [p.id, p]))
  if (projectIds.length > 0) {
    const { data: listingRows, error: listingsError } = await supabase
      .from("agent_listings")
      .select("id, slug, title, listing_kind, price, currency, project_id, agent_listing_images(url, sort_order)")
      .in("project_id", projectIds)
      .eq("status", "published")
      .is("deleted_at", null)
      .order("updated_at", { ascending: false })
      .limit(24)
    if (listingsError) throw new Error("Failed to load developer listings")
    // Test records are a 404 on their own page (lib/buy/agent-listings-public.ts): never link them from here.
    listings = ((listingRows ?? []) as unknown as DevListing[]).filter(
      (l) => !isTestRecord({ title: l.title, projectName: l.project_id != null ? projectById.get(l.project_id)?.name : null }),
    )
  }
  const forSaleCount = listings.filter((l) => l.listing_kind === "sale").length
  const forRentCount = listings.length - forSaleCount

  const listingPriceLabel = (l: DevListing): string => {
    const proj = l.project_id != null ? projectById.get(l.project_id) : undefined
    const code = (l.currency?.trim() || proj?.currency || "AED").toUpperCase()
    const own = l.price == null ? null : Number(l.price)
    const from = own ?? proj?.launch_price_from ?? null
    const to = own ?? proj?.launch_price_to ?? null
    if (from == null || !Number.isFinite(from)) return "Price on request"
    const fmt = (n: number) => n.toLocaleString("en-AE", { maximumFractionDigits: 0 })
    if (to != null && Number.isFinite(to) && to !== from) return `${code} ${fmt(from)} – ${fmt(to)}`
    return `${code} ${fmt(from)}`
  }

  const listingCover = (l: DevListing): string | null => {
    const own = [...(l.agent_listing_images ?? [])].sort((a, b) => a.sort_order - b.sort_order)[0]?.url
    if (own) return own
    const proj = l.project_id != null ? projectById.get(l.project_id) : undefined
    return proj?.main_image ?? null
  }

  const heroImage = visibleProjects[0]?.main_image ?? "/background/developers.webp"
  const signature = visibleProjects[0] ?? null
  const aboutImage = visibleProjects[1]?.main_image ?? visibleProjects[0]?.main_image ?? null
  const emirateCounts = countByEmirate(visibleProjects)
  const enquireHref = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(`Enquiry — ${developer.name}`)}`
  const websiteLabel = developer.website_url ? String(developer.website_url).replace(/^https?:\/\//, "").replace(/\/$/, "") : null
  const STATUS_TEXT: Record<string, string> = {
    pre_launch: "Pre-launch",
    launch: "Launching now",
    under_construction: "Under construction",
    completed: "Ready to move in",
  }
  const signaturePrice = signature?.launch_price_from != null ? Number(signature.launch_price_from) : null
  const signatureArea = signature ? [signature.community, signature.location].map((v) => v?.trim()).find(Boolean) ?? signature.city ?? null : null
  const nameWords = String(developer.name).split(" ")

  return (
    <div className="relative min-h-screen bg-[#fafafa] font-sans overflow-x-clip">
      {/* The floating WhatsApp button opens a chat that already names this developer and page. */}
      <WhatsAppFabTarget
        text={`Hi, I'm interested in ${developer.name} projects. Could you send me what's available? ${absoluteUrl(`/${slug}`)}`}
        label={`Ask about ${developer.name} on WhatsApp`}
        context={`developer:${slug}`}
      />
      {/* Entity + trail + the portfolio actually shown below (schema mirrors
          visible content: only projects that render make the ItemList). */}
      <JsonLd
        schema={[
          // `address` is the free text the hero prints (developers.address), passed through as plain text.
          developerPageSchema({ ...developer, slug: developer.slug ?? slug }),
          breadcrumbList([
            { name: "Home", path: "/" },
            { name: "Developers", path: "/developers" },
            { name: developer.name },
          ]),
          itemListSchema(
            visibleProjects.flatMap((p) =>
              p.slug && developer.slug ? [{ name: p.name, path: `/${developer.slug}/${p.slug}` }] : [],
            ),
            `Projects by ${developer.name}`,
          ),
        ]}
      />

      {/* ── Hero — the developer's own flagship render fills the screen and
             settles out of a zoom; the logo plate, name, counters and a
             signature-project card rise over it. The plate is the element the
             homepage tile's logo morphs into. ── */}
      <section className="pp-hero wf relative overflow-hidden bg-[#06182e] text-white">
        <noscript>
          <style>{`.pp-hero [class*="wf-"], .pp-hero .wf-word > span, .pp-hero [class*="pp-"] { opacity: 1 !important; transform: none !important; filter: none !important; }`}</style>
        </noscript>
        <InView className="relative" threshold={0.05} rootMargin="0px">
          <div className="absolute inset-0" aria-hidden="true">
            <div className="pp-hero-img absolute inset-0">
              <Image src={heroImage} alt="" fill preload fetchPriority="high" sizes="100vw" className="object-cover object-center" />
            </div>
            <div className="absolute inset-0 bg-gradient-to-r from-[#06182e]/95 via-[#06182e]/70 to-[#06182e]/25" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#06182e] via-[#06182e]/30 to-transparent" />
          </div>

          <div className="relative mx-auto flex min-h-[70vh] max-w-[1440px] flex-col px-4 pb-12 pt-8 sm:px-6 lg:min-h-[80vh] lg:px-8 lg:pb-16">
            <Link
              href="/developers"
              className="wf-fade inline-flex items-center gap-1.5 self-start text-[11px] font-bold uppercase tracking-[0.14em] text-white/70 transition-colors hover:text-[#f0d89b]"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> All Developers
            </Link>

            <div className="mt-auto grid grid-cols-1 gap-10 pt-14 lg:grid-cols-12 lg:items-end lg:gap-8">
              <div className="lg:col-span-7">
                <div
                  data-vt="developer-logo"
                  className="wf-fade flex h-28 w-28 items-center justify-center overflow-hidden border border-[#d6b357]/50 bg-white shadow-[0_24px_60px_-20px_rgba(0,0,0,0.6)] md:h-36 md:w-36"
                  style={{ viewTransitionName: "developer-logo", ["--d" as string]: "100ms", ...(developer.logo_bg ? { backgroundColor: developer.logo_bg } : {}) }}
                >
                  {developer.logo_url ? (
                    <Image src={developer.logo_url} alt={`${developer.name} logo`} width={110} height={110} className="max-h-[72%] max-w-[72%] object-contain" />
                  ) : (
                    <Building2 className="h-12 w-12 text-[#d6b357]" />
                  )}
                </div>

                <div className="mt-7 flex flex-wrap items-center gap-3">
                  <span className="wf-fade inline-flex items-center gap-3 text-[11px] font-bold uppercase tracking-[0.3em] text-[#f0d89b]" style={{ ["--d" as string]: "250ms" }}>
                    <span className="h-px w-8 bg-[#d6b357]" aria-hidden="true" />
                    Developer
                  </span>
                  {developer.is_verified && (
                    <span className="wf-fade inline-flex items-center gap-1.5 rounded-full bg-[#d6b357] px-3 py-1 text-[11px] font-bold text-[#001f3f]" style={{ ["--d" as string]: "350ms" }}>
                      <CheckCircle2 className="h-3.5 w-3.5" /> Verified
                    </span>
                  )}
                </div>

                <h1 className="mt-3 max-w-4xl font-['Outfit'] text-[40px] font-bold leading-[1.02] tracking-tight drop-shadow-[0_2px_16px_rgba(0,10,30,0.5)] sm:text-[54px] lg:text-[64px]">
                  {nameWords.map((w: string, i: number) => (
                    <Fragment key={`${w}-${i}`}>
                      <span className="wf-word">
                        <span style={{ ["--i" as string]: i }}>{w}</span>
                      </span>{" "}
                    </Fragment>
                  ))}
                </h1>
                <span className="wf-rule mt-6 block h-[3px] w-14 bg-[#d6b357]" aria-hidden="true" />

                <p className="wf-fade mt-5 max-w-2xl text-[16px] leading-relaxed text-white/80 sm:text-[17px]" style={{ ["--d" as string]: "750ms" }}>
                  {liveCount > 0
                    ? `${liveCount} live ${liveCount === 1 ? "project" : "projects"} on FHI Global, with prices, payment plans and handover dates upfront.`
                    : `Ask our team about ${developer.name}’s upcoming launches in the UAE.`}
                </p>
                {developer.address && (
                  <p className="wf-fade mt-3 flex max-w-xl items-start gap-2 text-sm text-white/65" style={{ ["--d" as string]: "850ms" }}>
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#d6b357]" /> {developer.address}
                  </p>
                )}
                {websiteLabel && (
                  <a
                    href={developer.website_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="wf-fade mt-2 inline-flex items-center gap-2 text-sm text-white/65 transition-colors hover:text-[#f0d89b]"
                    style={{ ["--d" as string]: "900ms" }}
                  >
                    <Globe className="h-4 w-4 text-[#d6b357]" /> {websiteLabel}
                  </a>
                )}

                <div className="wf-fade mt-8 flex flex-col gap-3 sm:flex-row" style={{ ["--d" as string]: "1000ms" }}>
                  <MagneticLink
                    href="#inquire"
                    className="group inline-flex items-center justify-center gap-2.5 bg-[#d6b357] px-7 py-4 text-[15px] font-bold text-[#001f3f] transition-colors hover:bg-[#e2c26a]"
                  >
                    Talk to us about {developer.name}
                    <ArrowDown className="h-4 w-4 transition-transform duration-300 group-hover:translate-y-0.5" />
                  </MagneticLink>
                  {visibleProjects.length > 0 && (
                    <MagneticLink
                      href="#portfolio"
                      className="inline-flex items-center justify-center gap-2.5 border border-white/35 px-7 py-4 text-[15px] font-bold text-white backdrop-blur-sm transition-colors hover:border-white/70 hover:bg-white/10"
                    >
                      View {visibleProjects.length} {visibleProjects.length === 1 ? "project" : "projects"}
                    </MagneticLink>
                  )}
                </div>
              </div>

              {/* Counters and the signature project */}
              <div className="lg:col-span-5">
                {heroStats.length > 0 && (
                  <dl className="wf-fade grid grid-cols-3 gap-4 border-t border-white/15 pt-6" style={{ ["--d" as string]: "1150ms" }}>
                    {heroStats.map((st, i) => (
                      <div key={st.label}>
                        <dd className="font-['Outfit'] text-[34px] font-bold leading-none text-white">
                          <CountUp value={st.value} delay={1250 + i * 150} duration={1200} />
                        </dd>
                        <dt className="mt-2 text-[11px] font-bold uppercase tracking-[0.16em] text-[#d6b357]">{st.label}</dt>
                      </div>
                    ))}
                  </dl>
                )}
                {signature?.main_image && signature.slug && developer.slug && (
                  <TransitionLink
                    href={`/${developer.slug}/${signature.slug}`}
                    className="wf-fade group mt-8 hidden border border-white/15 bg-[#0a1f38]/80 shadow-[0_24px_70px_rgba(0,0,0,0.5)] backdrop-blur-md lg:block"
                    style={{ ["--d" as string]: "1300ms" }}
                  >
                    <div data-vt-img className="relative aspect-[16/9] overflow-hidden">
                      <Image src={signature.main_image} alt={signature.name} fill sizes="(min-width: 1024px) 40vw, 100vw" className="object-cover transition-transform duration-700 group-hover:scale-[1.04]" />
                      <div className="absolute inset-0 bg-gradient-to-t from-[#06182e]/85 via-transparent to-transparent" aria-hidden="true" />
                      <span className="absolute left-3 top-3 rounded-full bg-[#d6b357] px-3 py-1 text-[11px] font-bold text-[#001f3f] shadow-sm">
                        {STATUS_TEXT[signature.status] ?? signature.status}
                      </span>
                      <span className="absolute bottom-3 left-3 text-[10px] font-bold uppercase tracking-[0.18em] text-[#f0d89b]">Signature project</span>
                    </div>
                    <div className="flex items-center justify-between gap-4 p-4">
                      <div className="min-w-0">
                        <p className="truncate font-['Outfit'] text-lg font-bold leading-snug text-white">{signature.name}</p>
                        {signatureArea && (
                          <p className="mt-1 flex items-center gap-1.5 text-xs text-white/65">
                            <MapPin className="h-3 w-3 shrink-0 text-[#d6b357]" /> <span className="truncate">{signatureArea}</span>
                          </p>
                        )}
                      </div>
                      <div className="shrink-0 text-right">
                        {signaturePrice ? (
                          <>
                            <span className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-white/55">From</span>
                            <span className="block font-['Outfit'] text-lg font-bold leading-none text-white">{formatProjectPrice(signaturePrice, signature.currency ?? "AED")}</span>
                          </>
                        ) : (
                          <span className="text-xs font-semibold text-white/60">Price on request</span>
                        )}
                      </div>
                    </div>
                  </TransitionLink>
                )}
              </div>
            </div>
          </div>
        </InView>
      </section>

      {/* ── Portfolio — the homepage's showcase layout, for this developer ── */}
      {visibleProjects.length > 0 ? (
        <section id="portfolio" className="relative scroll-mt-24 overflow-hidden py-16 md:py-20">
          <div className="absolute inset-0" aria-hidden="true">
            <Image src="/background/home.webp" alt="" fill sizes="100vw" className="object-cover object-center" />
            <div className="absolute inset-0 bg-gradient-to-b from-white/96 via-white/88 to-white/94" />
          </div>
          <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <InView className="wf mb-10 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="wf-fade inline-flex items-center gap-2.5 text-[11px] font-bold uppercase tracking-[0.18em] text-[#0d1117]">
                  <span className="h-[3px] w-6 bg-[#d6b357]" aria-hidden="true" />
                  Portfolio · {visibleProjects.length} {visibleProjects.length === 1 ? "project" : "projects"}
                </p>
                <h2 className="mt-3 font-['Outfit'] text-3xl font-bold leading-[1.1] tracking-tight md:text-[42px]">
                  <span className="wf-word"><span style={{ ["--i" as string]: 0 }} className="text-[#0d1117]">Projects</span></span>{" "}
                  <span className="wf-word"><span style={{ ["--i" as string]: 1 }} className="text-[#0d1117]">by</span></span>{" "}
                  {nameWords.map((w: string, i: number) => (
                    <Fragment key={`${w}-${i}`}><span className="wf-word"><span style={{ ["--i" as string]: 2 + i }} className="wf-gold">{w}</span></span>{" "}</Fragment>
                  ))}
                </h2>
              </div>
              <Link
                href="/projects"
                className="wf-fade inline-flex shrink-0 items-center gap-2 text-sm font-bold text-[#0d1117] transition-colors hover:text-[#b8913f]"
                style={{ ["--d" as string]: "700ms" }}
              >
                Browse all projects
                <span className="flex h-8 w-8 items-center justify-center bg-[#d6b357]">
                  <ArrowLeft className="h-4 w-4 rotate-180 text-[#001f3f]" />
                </span>
              </Link>
            </InView>
            <FeaturedProjectsShowcase projects={visibleProjects as unknown as FeaturedProjectData[]} />
          </div>
        </section>
      ) : (
        <InView as="section" id="portfolio" className="wf mx-auto max-w-[1440px] scroll-mt-24 px-4 py-16 sm:px-6 lg:px-8" threshold={0.2}>
          <div className="wf-fade border border-[#e5e8ec] bg-white px-6 py-14 text-center sm:px-14">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-[#d6b357]/50 bg-[#d6b357]/10">
              <Building2 className="h-6 w-6 text-[#b8913f]" />
            </span>
            <p className="mt-5 font-['Outfit'] text-2xl font-bold text-[#0d1117]">No published projects yet</p>
            <p className="mx-auto mt-2 max-w-md text-[15px] leading-relaxed text-[#6b7280]">
              We list {developer.name}&rsquo;s projects here as they are published. Ask our team what is coming.
            </p>
            <MagneticLink href="#inquire" className="mt-7 inline-flex items-center gap-2 bg-[#0d1117] px-6 py-3.5 text-[15px] font-bold text-white transition-colors hover:bg-[#001f3f]">
              Ask about {developer.name} <ArrowDown className="h-4 w-4 text-[#d6b357]" />
            </MagneticLink>
          </div>
        </InView>
      )}

      {/* ── About — editorial: copy on the left, a portfolio photo wiping open
             in a gold offset frame on the right ── */}
      {developer.description && (
        <InView as="section" className="pp-section wf mx-auto max-w-[1440px] px-4 py-16 sm:px-6 lg:px-8 lg:py-20" threshold={0.15}>
          <div className="grid grid-cols-1 gap-12 lg:grid-cols-12 lg:items-center lg:gap-16">
            <div className="lg:col-span-6">
              <p className="inline-flex items-center gap-2.5 text-[11px] font-bold uppercase tracking-[0.18em] text-[#b8913f]">
                <span className="h-[3px] w-6 bg-[#d6b357]" aria-hidden="true" />
                About
              </p>
              <h2 className="mt-3 font-['Outfit'] text-3xl font-bold tracking-tight text-[#0d1117] md:text-[40px]">
                About {developer.name}
              </h2>
              <span className="mt-5 block h-[3px] w-14 bg-[#d6b357]" aria-hidden="true" />
              <p className="mt-6 whitespace-pre-line text-[16px] leading-[1.8] text-[#374151]">{developer.description}</p>
              <div className="mt-8 flex flex-wrap gap-3">
                {websiteLabel && (
                  <a
                    href={developer.website_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 border border-[#0d1117]/20 px-5 py-3 text-sm font-bold text-[#0d1117] transition-colors hover:border-[#d6b357] hover:text-[#b8913f]"
                  >
                    <Globe className="h-4 w-4 text-[#b8913f]" /> {websiteLabel}
                  </a>
                )}
                <Link
                  href="/about"
                  className="inline-flex items-center gap-2 bg-[#0d1117] px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-[#001f3f]"
                >
                  About FHI Global <ArrowLeft className="h-4 w-4 rotate-180 text-[#d6b357]" />
                </Link>
              </div>
            </div>
            {aboutImage && (
              <div className="relative hidden lg:col-span-6 lg:block">
                <div className="absolute -bottom-4 -right-4 top-10 w-2/3 border border-[#d6b357]" aria-hidden="true" />
                <div className="fp-img relative aspect-[4/3] overflow-hidden shadow-[0_18px_44px_-20px_rgba(0,20,40,0.35)] ring-1 ring-[#e8eaed]">
                  <div className="fp-zoom absolute inset-0">
                    <Image src={aboutImage} alt={`${developer.name} project`} fill sizes="(max-width: 1024px) 100vw, 50vw" className="object-cover" />
                  </div>
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#001428]/80 to-transparent px-4 pb-3 pt-10">
                    <p className="truncate text-sm font-bold text-white">{(visibleProjects[1] ?? visibleProjects[0])?.name}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </InView>
      )}

      {/* ── Where they build — the relief lit by this developer's counts ── */}
      {liveCount > 0 && emirateCount > 0 && (
        <UaeMap
          counts={emirateCounts}
          eyebrow={`Where ${developer.name} builds`}
          titleTop="Building across"
          intro={`${liveCount} live ${liveCount === 1 ? "project" : "projects"} by ${developer.name} on FHI Global, by emirate. Choose one to see them.`}
          linkParams={{ developer: String(developer.id) }}
          hideEmpty
        />
      )}

      {/* ── On the market — live agent listings under this developer's projects ── */}
      {listings.length > 0 && (
        <InView as="section" className="pp-section wf mx-auto max-w-[1440px] px-4 py-16 sm:px-6 lg:px-8" threshold={0.1}>
          <div className="mb-5 flex items-end justify-between">
            <div>
              <div className="mb-3 flex items-center gap-2.5">
                <span className="h-[3px] w-6 bg-[#d6b357]" aria-hidden="true" />
                <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#0d1117]">On the Market</span>
              </div>
              <h2 className="font-['Outfit'] text-2xl font-bold leading-tight text-[#0d1117] md:text-3xl">
                Available Listings from <span className="text-[#b8913f]">{developer.name}</span>
              </h2>
            </div>
            <div className="hidden items-center gap-2 sm:flex">
              {forSaleCount > 0 && <span className="text-[11px] font-bold uppercase tracking-wider text-[#8a6d2a]">{forSaleCount} for sale</span>}
              {forRentCount > 0 && <span className="text-[11px] font-bold uppercase tracking-wider text-[#2456b3]">{forRentCount} for rent</span>}
            </div>
          </div>
          <div className="wf-line mb-8 h-px bg-[#e5e8ec]" />
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {listings.map((l) => {
              const cover = listingCover(l)
              const proj = l.project_id != null ? projectById.get(l.project_id) : undefined
              return (
                <Link
                  key={l.id}
                  href={`/listings/${l.slug ?? l.id}`}
                  className="group relative overflow-hidden border border-[#e5e8ec] bg-white transition-shadow duration-300 hover:shadow-[0_14px_40px_-16px_rgba(0,20,40,0.25)]"
                >
                  <div className="relative h-44 bg-[#eef1f5]">
                    {cover ? (
                      <Image src={cover} alt={l.title} fill sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw" className="object-cover transition-transform duration-300 group-hover:scale-[1.04]" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-[#b8bfc9]"><Building2 className="h-8 w-8" /></div>
                    )}
                    <span className={`absolute left-3 top-3 px-2.5 py-1 text-[11px] font-bold text-white ${l.listing_kind === "rent" ? "bg-[#2f6fe4]" : "bg-[#d6b357]"}`}>
                      {l.listing_kind === "rent" ? "FOR RENT" : "FOR SALE"}
                    </span>
                  </div>
                  <div className="p-4">
                    <p className="mb-1 font-['Outfit'] text-lg font-bold leading-tight text-[#0f2940]">{listingPriceLabel(l)}</p>
                    <p className="truncate text-sm font-semibold text-[#374151]">{l.title}</p>
                    {proj && <p className="mt-0.5 truncate text-xs text-[#6b7280]">{[proj.name, proj.city].filter(Boolean).join(" · ")}</p>}
                  </div>
                </Link>
              )
            })}
          </div>
        </InView>
      )}

      {/* ── Closing — talk to FHI about this developer ── */}
      <section className="relative overflow-hidden bg-[#06182e] text-white">
        <div className="pointer-events-none absolute -right-32 top-1/2 h-[520px] w-[520px] -translate-y-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(214,179,87,0.16),rgba(214,179,87,0))]" aria-hidden="true" />
        <InView className="wf relative mx-auto flex max-w-[1440px] flex-col gap-10 px-4 py-16 sm:px-6 lg:flex-row lg:items-center lg:px-8 lg:py-20">
          <div className="flex-1">
            <p className="wf-fade inline-flex items-center gap-2.5 text-[11px] font-bold uppercase tracking-[0.18em] text-[#d6b357]">
              <span className="h-[3px] w-6 bg-[#d6b357]" aria-hidden="true" />
              Interested in {developer.name}?
            </p>
            <h2 className="mt-4 font-['Outfit'] text-3xl font-bold leading-[1.08] tracking-tight md:text-[42px]">
              {["Talk", "to", "an", "FHI", "consultant"].map((w, i) => (
                <Fragment key={w}><span className="wf-word"><span style={{ ["--i" as string]: i }}>{w}</span></span>{" "}</Fragment>
              ))}
              <span className="block">
                {["before", "you", "decide."].map((w, i) => (
                  <Fragment key={w}><span className="wf-word"><span style={{ ["--i" as string]: 5 + i }} className="wf-gold">{w}</span></span>{" "}</Fragment>
                ))}
              </span>
            </h2>
            <p className="wf-fade mt-5 max-w-xl text-[16px] leading-relaxed text-white/75" style={{ ["--d" as string]: "700ms" }}>
              Availability, payment plans and the units worth waiting for, from a team that works directly with the developer.
            </p>
          </div>
          {/* The enquiry form on the page itself: a developer lead lands in the Leads inbox (with an
              e-mail to the admin team) tagged with this page, instead of an unmonitored mailto. */}
          <div id="inquire" className="wf-fade w-full shrink-0 scroll-mt-24 bg-white p-6 text-[#0d1117] sm:p-8 lg:w-[460px]" style={{ ["--d" as string]: "900ms" }}>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#b8913f]">Enquire about {developer.name}</p>
            <div className="mt-4">
              <InquireForm context={{ kind: "developer", slug, name: developer.name }} />
            </div>
            <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-[#eef0f3] pt-4 text-[13px] font-semibold text-[#001f3f]">
              <LeadLink event="click_email" params={{ location: "developer_page" }} href={enquireHref} className="inline-flex items-center gap-1.5 hover:text-[#b8913f]">
                <Mail className="h-3.5 w-3.5 text-[#b8913f]" /> Email us instead
              </LeadLink>
              <Link href="/contact" className="hover:text-[#b8913f]">Contact page</Link>
              <a
                href={SOCIAL_URLS.facebook}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Follow FHI Global on Facebook"
                className="inline-flex items-center gap-1.5 hover:text-[#b8913f]"
              >
                <Facebook className="h-3.5 w-3.5 fill-current text-[#b8913f]" /> Facebook
              </a>
            </div>
          </div>
        </InView>
      </section>
    </div>
  )
}

const SORT_NOTE: Record<SeoSort, string> = { newest: "Newest added first", handover: "Soonest handover first" }

/**
 * Preload a hero image for one breakpoint only. getImageProps yields the exact srcset/sizes the
 * <Image> will request, so the preload and the image are one fetch, not two.
 */
function preloadImage(src: string, sizes: string, media?: string) {
  const { props } = getImageProps({ src, alt: "", fill: true, sizes })
  preloadResource(props.src, { as: "image", imageSrcSet: props.srcSet, imageSizes: props.sizes, fetchPriority: "high", ...(media ? { media } : {}) } as Parameters<typeof preloadResource>[1])
}

/** A UAE hub's rows grouped by emirate (largest first), each with up to 8 cards and the page its "See all" link opens. */
function emirateGroups(rows: SeoGridRow[], hubFilter: SeoPageFilter) {
  const byCode = new Map<string, SeoGridRow[]>()
  for (const row of rows) {
    const code = emirateCodeForCity(row.city)
    if (code) byCode.set(code, [...(byCode.get(code) ?? []), row])
  }
  return EMIRATES.filter((e) => byCode.has(e.code))
    .map((emirate: Emirate) => {
      const groupRows = byCode.get(emirate.code) ?? []
      const groupFilter: SeoPageFilter = { cityLike: emirate.keys[0], statuses: hubFilter.statuses }
      const landing = landingPageForFilter(groupFilter)
      return {
        emirate,
        total: groupRows.length,
        rows: groupRows.slice(0, 8),
        href: landing ? `/${landing.slug}` : projectsBrowseTarget(groupFilter).href,
      }
    })
    .sort((a, b) => b.total - a.total)
}

/** The consultant CTAs and trust line — rendered twice (masthead on desktop, after the grid on phones). */
function LandingCtas({ seo, regulator, className = "" }: { seo: SeoPage; regulator: string | null; className?: string }) {
  return (
    <div className={className}>
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href="#inquire"
          className="inline-flex items-center gap-2 px-6 py-3 bg-[#001f3f] text-white text-sm font-bold hover:bg-[#00152b] transition-colors"
        >
          Talk to a Consultant <ArrowDown className="w-4 h-4" />
        </Link>
        {/* A crawl-visible WhatsApp route that names this page (the floating button only learns it after hydration). */}
        <LeadLink
          event="click_whatsapp"
          params={{ location: "landing_hero", recipient: "company", context: `landing:${seo.slug}` }}
          href={companyWhatsappHref(`Hi, I'm looking at ${seo.label} on fhiglobal.ae and would like a shortlist. ${absoluteUrl(`/${seo.slug}`)}`)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-6 py-3 border border-[#25d366] text-[#128c4a] text-sm font-bold hover:bg-[#25d366]/10 transition-colors"
        >
          WhatsApp us
        </LeadLink>
        <Link
          href="/developers"
          className="inline-flex items-center gap-2 px-6 py-3 border border-[#d6b357] text-[#8a6d2a] text-sm font-bold hover:bg-[#d6b357]/10 transition-colors"
        >
          Browse Developers
        </Link>
      </div>
      <p className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-[12px] font-semibold text-[#6b7280]">
        {regulator && (
          <span className="inline-flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-[#b8913f]" /> {regulator}
          </span>
        )}
        <span className="inline-flex items-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5 text-[#b8913f]" /> Direct developer prices
        </span>
        <span className="inline-flex items-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5 text-[#b8913f]" /> Guidance from launch to handover
        </span>
      </p>
    </div>
  )
}

async function SeoLandingPage({ seo }: { seo: SeoPage }) {
  if (seo.kind === "guide") return <SeoGuidePage seo={seo} />

  const filter = seo.filter ?? {}
  const isHub = seo.layout === "emirate-hub"
  // The rows this page lists, in its order (a hub leaves out rows whose city names no emirate) — the same read
  // generateMetadata and the share card use.
  const visible = await getSeoInventory(seo.slug)
  const groups = isHub ? emirateGroups(visible, filter) : []

  // Masthead collage + facts, all from the projects already loaded — no extra
  // query, and every photo is one of the results below.
  const collagePhotos = visible.slice(0, 4).map((p) => p.main_image as string)
  const developerCount = new Set(
    visible.map((p) => (p.developers as { name?: string } | null)?.name).filter(Boolean),
  ).size
  const priceFrom = inventoryPriceFrom(visible)

  // What the page actually lists: a hub's grouped cards, otherwise the first 24. (The ItemList
  // JSON-LD below mirrors exactly this.)
  const shown = isHub ? groups.flatMap((g) => g.rows) : visible.slice(0, 24)
  const related = seo.related.map(getSeoPage).filter((r): r is SeoPage => Boolean(r))
  const regulator = regulatorLine(filter)
  const browse = projectsBrowseTarget(filter)

  // What the first screen paints differs by breakpoint. The first card is in view at every width (it
  // is the LCP on a phone, and the largest image on a desktop too), so it is preloaded for all; the
  // collage is desktop-only, so its first photo is preloaded from lg up and a phone never fetches a
  // hidden tile. No <img> below carries priority/preload/fetchPriority — these two links are the lot.
  const collageSizes = collagePhotos.length === 1 ? "(min-width: 1024px) 44vw, 100vw" : "(min-width: 1024px) 22vw, 50vw"
  if (collagePhotos[0]) preloadImage(collagePhotos[0], collageSizes, "(min-width: 1024px)")
  if (shown[0]?.main_image) preloadImage(shown[0].main_image, PROJECT_CARD_IMAGE_SIZES)

  return (
    <div className="bg-[#f7f8fa]">
      {/* The floating WhatsApp button opens a chat that already names this search page. */}
      <WhatsAppFabTarget
        text={`Hi, I'm looking at ${seo.label} on fhiglobal.ae and would like a shortlist. ${absoluteUrl(`/${seo.slug}`)}`}
        label={`Ask about ${seo.label} on WhatsApp`}
        context={`landing:${seo.slug}`}
      />
      {/* Trail + exactly the projects rendered in the grid below (+ the FAQ
          rich-result markup when the page carries a visible FAQ block). */}
      <JsonLd
        schema={[
          breadcrumbList([{ name: "Home", path: "/" }, { name: seo.h1 }]),
          itemListSchema(
            shown.flatMap((p) => {
              const dev = p.developers as unknown as { slug: string | null } | null
              return p.slug && dev?.slug ? [{ name: p.name, path: `/${dev.slug}/${p.slug}` }] : []
            }),
            seo.h1,
          ),
          ...(seo.faqs?.length ? [faqPageSchema(seo.faqs)] : []),
        ]}
      />
      {/* Masthead — light editorial header, the same design language as the
          project pages: navy type on white, gold caps labels with hairline
          dividers, and a collage of up to four projects from the very grid
          below filling the right half. Deliberately short: the visitor came
          to see projects; the copy that ranks sits under the grid. */}
      <section className="relative overflow-hidden bg-white border-b border-[#e8eaed]">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-10 lg:pr-[46%] lg:min-h-[360px]">
          <div className="flex items-center gap-3 mb-3">
            <span className="h-px w-10 bg-[#d6b357]" aria-hidden="true" />
            <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#b8913f]">
              FHI Global · Popular Searches
            </span>
          </div>
          <h1 className="font-['Outfit'] text-3xl md:text-[42px] font-bold text-[#001f3f] leading-[1.08]">
            {seo.h1}
          </h1>
          <p className="mt-4 text-[15px] leading-relaxed text-[#6b7280] max-w-xl">
            {seo.description}
          </p>

          {/* Collage — real projects from the grid below. Desktop only: on a phone it would
              push the first card below the fold (and the card is the LCP there). */}
          <div className="relative hidden bg-[#001f3f] lg:absolute lg:inset-y-0 lg:right-0 lg:left-[56%] lg:z-10 lg:block">
            {collagePhotos.length === 0 ? (
              <div className="absolute inset-0 flex items-center justify-center">
                <Building2 className="w-14 h-14 text-[#d6b357]/50" />
              </div>
            ) : collagePhotos.length === 1 ? (
              <Image
                src={collagePhotos[0]}
                alt={seo.h1}
                fill
                sizes={collageSizes}
                className="object-cover"
              />
            ) : (
              <div className={`absolute inset-0 grid grid-cols-2 gap-[3px] bg-white ${collagePhotos.length > 2 ? "grid-rows-2" : ""}`}>
                {collagePhotos.map((url, i) => (
                  <div
                    key={url}
                    className={`relative overflow-hidden ${collagePhotos.length === 3 && i === 0 ? "row-span-2" : ""}`}
                  >
                    <Image
                      src={url}
                      alt={`${seo.h1} — photo ${i + 1}`}
                      fill
                      sizes={collageSizes}
                      className="object-cover"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Facts — the count plus what the filter actually means, in the
              same gold-label columns as the project masthead. */}
          <dl className="mt-7 grid grid-cols-2 gap-x-6 gap-y-5 sm:flex sm:flex-wrap sm:gap-x-0 sm:gap-y-4">
            {[
              { label: "Projects Available", value: String(visible.length) },
              { label: "Developers", value: String(developerCount) },
              ...(priceFrom ? [{ label: "Starting From", value: priceFrom }] : []),
            ].map((f) => (
              <div
                key={f.label}
                className="sm:pr-8 sm:mr-8 sm:border-r sm:border-[#e8eaed] sm:last:mr-0 sm:last:border-0 sm:last:pr-0"
              >
                <dt className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#b8913f] mb-1.5">
                  {f.label}
                </dt>
                <dd className="font-['Outfit'] text-2xl font-bold text-[#001f3f] leading-none">
                  {f.value}
                </dd>
              </div>
            ))}
          </dl>

          {/* CTAs + trust line — the column carries weight and routes the visitor instead of
              trailing off into white space. Desktop only here; a phone gets them after the grid. */}
          <LandingCtas seo={seo} regulator={regulator} className="mt-8 hidden lg:block" />
        </div>
      </section>

      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-12 sm:pt-12 space-y-12">
        {shown.length > 0 ? (
          isHub ? (
            // A UAE-wide hub: one heading per emirate, a few cards each, and a "See all" into the
            // landing page (or the /projects facet) that lists exactly that emirate.
            <div className="space-y-12">
              {groups.map((group) => (
                <section key={group.emirate.code} aria-labelledby={`emirate-${group.emirate.code}`}>
                  <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                    <h2 id={`emirate-${group.emirate.code}`} className="font-['Outfit'] text-xl font-bold text-[#001f3f]">
                      {group.emirate.name}{" "}
                      <span className="text-sm font-semibold text-[#6b7280]">
                        · {group.total} {group.total === 1 ? "project" : "projects"}
                      </span>
                    </h2>
                    <Link
                      href={group.href}
                      className="inline-flex items-center gap-1.5 text-sm font-bold text-[#001f3f] hover:text-[#b8913f] transition-colors"
                    >
                      See all {group.emirate.name} projects <ArrowLeft className="w-4 h-4 rotate-180" />
                    </Link>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5">
                    {group.rows.map((p) => (
                      <ProjectCard key={p.id} project={p as unknown as ProjectCardData} />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          ) : (
            <section aria-labelledby="available-projects">
              <div className="mb-4 flex items-end justify-between gap-3">
                <h2 id="available-projects" className="font-['Outfit'] text-xl font-bold text-[#001f3f]">
                  Available projects
                </h2>
                <p className="text-xs text-[#6b7280]">
                  {visible.length > shown.length
                    ? `Showing ${shown.length} of ${visible.length}`
                    : `${shown.length} ${shown.length === 1 ? "project" : "projects"}`}
                  {seo.sort ? ` · ${SORT_NOTE[seo.sort]}` : ""}
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5">
                {shown.map((p, i) =>
                  // The first row is not animated: <Reveal> renders opacity-0 until an
                  // IntersectionObserver fires after hydration, so the first card would be invisible
                  // in the server HTML — and out of the LCP. Later rows stagger across the row only.
                  i < 4 ? (
                    <ProjectCard key={p.id} project={p as unknown as ProjectCardData} />
                  ) : (
                    <Reveal key={p.id} delay={(i % 3) * 90}>
                      <ProjectCard project={p as unknown as ProjectCardData} />
                    </Reveal>
                  ),
                )}
              </div>
            </section>
          )
        ) : (
          <div className="flex flex-col items-center justify-center py-20 bg-white border border-[#e8eaed] text-center">
            <Building2 className="w-8 h-8 text-[#001f3f]/25 mb-3" />
            <p className="font-['Outfit'] font-semibold text-[#0d1117] text-sm mb-1">Nothing here right now</p>
            <p className="text-[#6b7280] text-xs">New launches land regularly — check the full projects browser.</p>
          </div>
        )}

        {!isHub && visible.length > shown.length && (
          <div className="text-center">
            <Link
              href={browse.href}
              className="inline-flex items-center gap-2 px-6 py-3 bg-[#001f3f] text-white text-sm font-bold hover:bg-[#00152b] transition-colors"
            >
              {browse.label} <ArrowLeft className="w-4 h-4 rotate-180" />
            </Link>
          </div>
        )}

        {/* The consultant CTAs for phones — the masthead's copy is desktop-only. */}
        <LandingCtas seo={seo} regulator={regulator} className="lg:hidden" />

        {/* Enquiry — the lead form on the page itself, so the path from a
            Google search to a consultant is one scroll, not a navigation. */}
        <Reveal>
          <section id="inquire" className="scroll-mt-24 bg-white border border-[#e8eaed] grid grid-cols-1 lg:grid-cols-5">
            <div className="lg:col-span-2 bg-[#001f3f] p-6 sm:p-8">
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#d6b357]">
                Enquire Now
              </p>
              <h2 className="mt-2 font-['Outfit'] text-2xl font-bold text-white leading-tight">
                Tell us what you&apos;re looking for
              </h2>
              <span className="block w-12 h-[3px] bg-[#d6b357] mt-4 mb-5" aria-hidden="true" />
              <p className="text-white/75 text-[14.5px] leading-relaxed">
                Leave your details and a consultant will come back the same business day with a
                shortlist from this search — developer pricing, no mark-up, and our guidance
                costs you nothing.
              </p>
            </div>
            <div className="lg:col-span-3 p-6 sm:p-8">
              <InquireForm
                context={{ kind: "landing", slug: seo.slug, name: seo.label }}
                defaultCategory={seo.filter?.statuses?.length && seo.filter.statuses.every((s) => s === "completed") ? "ready" : "off_plan"}
              />
            </div>
          </section>
        </Reveal>

        {/* The page's explanatory copy. It sits below the results rather than
            above them: buyers want the projects first, but this prose is what
            makes the page rank, so it stays on the page. */}
        {seo.intro.length > 0 && (
          <Reveal>
          <section className="bg-white border border-[#e8eaed] p-6 sm:p-8">
            <h2 className="font-['Outfit'] text-lg font-bold text-[#001f3f]">About {seo.label}</h2>
            <span className="block w-10 h-[2px] bg-[#d6b357] mt-2.5 mb-4" aria-hidden="true" />
            <div className="max-w-3xl space-y-3.5">
              {seo.intro.map((paragraph) => (
                <p key={paragraph.slice(0, 32)} className="text-[15px] leading-relaxed text-[#4b5563]">
                  {paragraph}
                </p>
              ))}
            </div>
          </section>
          </Reveal>
        )}

        {/* FAQ — visible copy first, FAQPage markup mirrors it exactly. */}
        {seo.faqs && seo.faqs.length > 0 && (
          <Reveal>
          <section className="bg-white border border-[#e8eaed] p-6 sm:p-8">
            <h2 className="font-['Outfit'] text-lg font-bold text-[#001f3f]">Frequently Asked Questions</h2>
            <span className="block w-10 h-[2px] bg-[#d6b357] mt-2.5 mb-5" aria-hidden="true" />
            <div className="divide-y divide-[#eef0f3]">
              {seo.faqs.map((f) => (
                <div key={f.q} className="py-4 first:pt-0 last:pb-0">
                  <h3 className="text-[15px] font-bold text-[#0d1117]">{f.q}</h3>
                  <p className="mt-1.5 text-[14.5px] leading-relaxed text-[#4b5563] max-w-3xl">{f.a}</p>
                </div>
              ))}
            </div>
          </section>
          </Reveal>
        )}

        {/* Related searches — the interlinking is half the SEO value. */}
        {related.length > 0 && (
          <div className="bg-white border border-[#e8eaed] p-6">
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#9ca3af] mb-4">
              Related searches
            </p>
            <div className="flex flex-wrap gap-2.5">
              {related.map((r) => (
                <Link
                  key={r.slug}
                  href={`/${r.slug}`}
                  className="px-4 py-2 border border-[#e5e5e5] bg-[#f8fafc] text-sm font-semibold text-[#001f3f] hover:border-[#d6b357] hover:bg-[#d6b357]/10 transition-colors"
                >
                  {r.label}
                </Link>
              ))}
              <Link
                href="/developers"
                className="px-4 py-2 border border-[#e5e5e5] bg-[#f8fafc] text-sm font-semibold text-[#001f3f] hover:border-[#d6b357] hover:bg-[#d6b357]/10 transition-colors"
              >
                All Developers
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// Area guide (kind: "guide") — competitor-style static info page: editorial
// intro beside a photo from OUR OWN portfolio, a "why invest here" card grid,
// prose sections, then routes into the live inventory pages. The photo is a
// real project we sell (and links to it) — not stock imagery.

async function SeoGuidePage({ seo }: { seo: SeoPage }) {
  const supabase = createPublicSupabaseClient()

  // Our projects in this area. The guides used to query nothing at all, so
  // they showed no inventory and linked to no project — the reason a project
  // page like Binghatti Cullinan had two internal links on the whole site.
  const inventory = await getSeoInventory(seo.slug)
  const hasInventory = inventory.length >= MIN_GUIDE_INVENTORY
  // The stats strip needs three projects to say anything; the project grid does not — an area with
  // one or two of our projects (Marina, Palm, JBR, Arabian Ranches, DIFC) still links them.
  const showStats = hasInventory
  const gridProjects = inventory.slice(0, 8)
  const reviewed = Boolean(seo.reviewer && seo.reviewedAt)

  // The intro photo is a project we sell. Where it comes from decides how it may be described:
  //  "area"    — the first project of this page's own inventory (one is enough; MIN_GUIDE_INVENTORY only gates
  //              the stats strip). The keyword query below is NEVER run when there is one: it used to override
  //              the in-area lead on 7 of the 8 guides with stock, and the Marina/Palm/JBR/Arabian Ranches/DIFC
  //              guides (one or two projects) fell through to an unrelated pool photo.
  //  "keyword" — buyer guides only (no inventoryFilter): a project whose location or community matches the
  //              guide's neighbourhood word (never its name), an illustration;
  //  "pool"    — last resort: a stable, slug-keyed pick from our Dubai portfolio, labelled as exactly that.
  type Photo = { url: string; name: string; slug: string | null; devSlug: string | null; source: "area" | "keyword" | "pool" }
  const asPhoto = (
    row: { name: string; slug: string | null; main_image: string | null; developers: unknown },
    source: Photo["source"],
  ): Photo | null =>
    row.main_image
      ? { url: row.main_image, name: row.name, slug: row.slug, devSlug: (row.developers as { slug: string | null } | null)?.slug ?? null, source }
      : null
  let photo: Photo | null = inventory[0] ? asPhoto(inventory[0], "area") : null

  if (!photo && !seo.inventoryFilter && seo.imageQuery) {
    const { data, error } = await supabase
      .from("projects")
      .select("name, slug, main_image, developers(slug)")
      .eq("is_active", true)
      .eq("is_published", true)
      .is("deleted_at", null)
      .not("main_image", "is", null)
      .neq("main_image", "")
      .not("name", "ilike", "%test%")
      .ilike("city", "%dubai%")
      .or(`location.ilike.%${seo.imageQuery}%,community.ilike.%${seo.imageQuery}%`)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle()
    // ISR rule: a failed read must not silently become "no photo" (and then an unrelated one).
    if (error) throw new Error("Failed to load guide photo")
    if (data) photo = asPhoto(data, "keyword")
  }
  if (!photo) {
    // No project in this exact area — pick from the Dubai pool, keyed by the slug so each guide keeps a
    // stable, distinct photo between builds.
    const { data: pool, error } = await supabase
      .from("projects")
      .select("name, slug, main_image, developers(slug)")
      .eq("is_active", true)
      .eq("is_published", true)
      .is("deleted_at", null)
      .not("main_image", "is", null)
      .neq("main_image", "")
      .not("name", "ilike", "%test%")
      .ilike("city", "%dubai%")
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .limit(12)
    if (error) throw new Error("Failed to load guide photo")
    if (pool?.length) {
      const idx = [...seo.slug].reduce((a, c) => a + c.charCodeAt(0), 0) % pool.length
      photo = asPhoto(pool[idx], "pool")
    }
  }

  const related = seo.related.map(getSeoPage).filter((r): r is SeoPage => Boolean(r))

  return (
    <div className="bg-white">
      {/* The floating WhatsApp button opens a chat that already names the guide being read. */}
      <WhatsAppFabTarget
        text={`Hi, I'm reading your ${seo.label} guide on fhiglobal.ae and would like to talk to a consultant. ${absoluteUrl(`/${seo.slug}`)}`}
        label="Talk to a consultant on WhatsApp"
        context={`guide:${seo.slug}`}
      />
      <JsonLd
        schema={[
          breadcrumbList([{ name: "Home", path: "/" }, { name: seo.h1 }]),
          ...(gridProjects.length > 0
            ? [
                itemListSchema(
                  gridProjects.flatMap((p) => {
                    const dev = p.developers as { slug: string | null } | null
                    return p.slug && dev?.slug ? [{ name: p.name, path: `/${dev.slug}/${p.slug}` }] : []
                  }),
                  `Projects in ${seo.label}`,
                ),
              ]
            : []),
          ...(seo.faqs?.length ? [faqPageSchema(seo.faqs)] : []),
          // Only when the page also PRINTS the reviewer line (and its Sources): schema mirrors visible content.
          ...(seo.reviewer && seo.reviewedAt
            ? reviewedGuideSchemas({
                path: `/${seo.slug}`,
                headline: seo.h1,
                description: seo.description,
                image: seoOgImage(seo, inventory).imageUrl,
                reviewedAt: seo.reviewedAt,
                modifiedAt: seo.updated,
                reviewer: seo.reviewer,
                sources: seo.sources,
              })
            : []),
        ]}
      />
      {/* Editorial intro — headline and copy on the left, our project photo on
          the right, like the area pages on the major portals. */}
      <section className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-4">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#d6b357]">
          FHI Global · {seo.guideType === "buyer" ? "Buyer Guide" : "Dubai Area Guide"}
        </p>
        <div className="mt-3 grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-14 items-start">
          <div>
            <h1 className="font-['Outfit'] text-3xl md:text-[40px] font-bold text-[#001f3f] leading-tight">
              {seo.h1}
            </h1>
            <span className="block w-14 h-1 bg-[#d6b357] mt-4 mb-6" aria-hidden="true" />
            {reviewed && seo.reviewer && seo.reviewedAt && (
              <p className="mb-5 text-xs text-[#6b7280]">
                Reviewed by <span className="font-semibold text-[#374151]">{seo.reviewer.name}</span>
                {seo.reviewer.role ? `, ${seo.reviewer.role}` : ""}
                {seo.reviewer.brn ? ` · RERA BRN ${seo.reviewer.brn}` : ""} · Last reviewed{" "}
                <time dateTime={seo.reviewedAt}>
                  {new Date(`${seo.reviewedAt}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })}
                </time>
                {seo.sources?.length ? (
                  <>
                    {" "}· <a href="#sources" className="underline underline-offset-2">Sources</a>
                  </>
                ) : null}
              </p>
            )}
            <div className="space-y-4">
              {seo.intro.map((paragraph) => (
                <p key={paragraph.slice(0, 32)} className="text-[16.5px] leading-[1.75] text-[#374151]">
                  {paragraph}
                </p>
              ))}
            </div>
          </div>

          {photo && (
            <div>
              <div className="group relative aspect-[4/3] overflow-hidden ring-1 ring-[#e8eaed] shadow-[0_18px_44px_-18px_rgba(0,20,40,0.35)]">
                <Image
                  src={photo.url}
                  alt={photo.source === "area" ? `${photo.name} — a project in ${seo.label}` : photo.name}
                  fill
                  sizes="(max-width: 1024px) 100vw, 50vw"
                  className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                />
              </div>
              {photo.slug && (
                <Link
                  href={photo.devSlug ? `/${photo.devSlug}/${photo.slug}` : `/projects/${photo.slug}`}
                  className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-[#6b7280] hover:text-[#001f3f] transition-colors"
                >
                  {photo.source === "pool" ? "A Dubai project from our portfolio" : "From our portfolio"}: {photo.name}
                  <ArrowLeft className="w-3.5 h-3.5 rotate-180" />
                </Link>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Why invest here — the competitor-style check-card grid. */}
      {seo.facts && seo.facts.length > 0 && (
        <section className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <h2 className="font-['Outfit'] text-2xl md:text-3xl font-bold text-[#001f3f] text-center">
            {seo.factsHeading ?? `Why invest in ${seo.label}`}
          </h2>
          <span className="block w-14 h-1 bg-[#d6b357] mt-3 mb-8 mx-auto" aria-hidden="true" />
          <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 max-w-6xl mx-auto">
            {seo.facts.map((f) => (
              <div
                key={f.label}
                className="group bg-white border border-[#e8eaed] p-6 transition-all duration-200 hover:border-[#d6b357]/50 hover:bg-[#d6b357]/[0.07] hover:shadow-[0_14px_32px_-16px_rgba(0,20,40,0.35)]"
              >
                {/* A <div> inside a <dl> may only hold dt/dd, so the icon sits inside the term. */}
                <dt>
                  <span className="inline-flex w-9 h-9 bg-[#d6b357]/12 items-center justify-center transition-colors duration-200 group-hover:bg-[#d6b357]">
                    <CheckCircle2 aria-hidden="true" className="w-5 h-5 text-[#d6b357] transition-colors duration-200 group-hover:text-white" />
                  </span>
                  <span className="mt-3.5 block font-['Outfit'] text-lg font-bold text-[#0d1117]">{f.label}</span>
                </dt>
                <dd className="mt-1.5 text-[15px] leading-relaxed text-[#4b5563]">{f.value}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      {/* Market data — a hand-entered, sourced and dated table (the type forces both). */}
      {seo.marketData && (
        <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-10">
          <h2 className="font-['Outfit'] text-2xl font-bold text-[#001f3f]">Market data for {seo.label}</h2>
          <span className="block w-10 h-1 bg-[#d6b357] mt-2 mb-4" aria-hidden="true" />
          <SeoDataTable table={seo.marketData} />
        </section>
      )}

      {/* Live inventory — the stats and the projects come from the same query,
          so the numbers can never disagree with the cards beneath them. Only
          rendered for areas where we actually hold stock. */}
      {gridProjects.length > 0 && (
        <section className="bg-[#f7f8fa] border-y border-[#e8eaed]">
          <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#d6b357]">
                  From our portfolio
                </p>
                <h2 className="mt-2 font-['Outfit'] text-2xl md:text-3xl font-bold text-[#001f3f]">
                  Projects in {seo.label}
                </h2>
              </div>
              <Link
                href="/off-plan-projects-in-dubai"
                className="inline-flex items-center gap-1.5 text-sm font-bold text-[#001f3f] hover:text-[#b8913f] transition-colors"
              >
                All off-plan projects in Dubai
                <ArrowLeft className="w-4 h-4 rotate-180" />
              </Link>
            </div>

            {showStats && (
            <dl className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-[#e8eaed] border border-[#e8eaed] mb-8">
              {[
                { label: "Projects available", value: String(inventory.length) },
                { label: "Starting from", value: inventoryPriceFrom(inventory) },
                { label: "Handover", value: inventoryHandoverRange(inventory) },
                {
                  label: "Developers",
                  value: String(
                    new Set(
                      inventory.map((p) => (p.developers as { name?: string } | null)?.name).filter(Boolean),
                    ).size,
                  ),
                },
              ]
                .filter((s) => s.value)
                .map((s) => (
                  <div key={s.label} className="bg-white px-5 py-4">
                    <dt className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#9ca3af]">
                      {s.label}
                    </dt>
                    <dd className="mt-1 font-['Outfit'] text-xl font-bold text-[#001f3f]">{s.value}</dd>
                  </div>
                ))}
            </dl>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
              {gridProjects.map((p) => (
                <ProjectCard key={p.id} project={p as unknown as ProjectCardData} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Prose sections */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-14 gap-y-10">
          {seo.sections?.map((s) => (
            // A section that carries a table spans the full row: three columns are cramped in half of one.
            <div key={s.heading} className={s.table ? "lg:col-span-2" : undefined}>
              <h2 className="font-['Outfit'] text-2xl font-bold text-[#001f3f]">{s.heading}</h2>
              <span className="block w-10 h-1 bg-[#d6b357] mt-2 mb-4" aria-hidden="true" />
              {s.answer && <p className="mb-3 text-[17px] font-semibold leading-[1.6] text-[#0d1117]">{s.answer}</p>}
              <div className="max-w-3xl space-y-4">
                {(Array.isArray(s.body) ? s.body : [s.body]).map((paragraph) => (
                  <p key={paragraph.slice(0, 40)} className="text-[16.5px] leading-[1.75] text-[#374151]">{paragraph}</p>
                ))}
              </div>
              {s.table && (
                <div className="mt-6">
                  <SeoDataTable table={s.table} />
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* FAQ — visible copy first, FAQPage markup mirrors it exactly. */}
      {seo.faqs && seo.faqs.length > 0 && (
        <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <h2 className="font-['Outfit'] text-2xl md:text-3xl font-bold text-[#001f3f] text-center">
            Frequently asked questions
          </h2>
          <span className="block w-14 h-1 bg-[#d6b357] mt-3 mb-8 mx-auto" aria-hidden="true" />
          <div className="max-w-3xl mx-auto border border-[#e8eaed] bg-white divide-y divide-[#eef0f3]">
            {seo.faqs.map((f) => (
              <div key={f.q} className="p-6">
                <h3 className="text-base font-bold text-[#0d1117]">{f.q}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-[#4b5563]">{f.a}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {seo.sources && seo.sources.length > 0 && (
        <section id="sources" className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pb-10 scroll-mt-24">
          <h2 className="font-['Outfit'] text-xl font-bold text-[#001f3f]">Sources</h2>
          <span className="block w-10 h-1 bg-[#d6b357] mt-2 mb-4" aria-hidden="true" />
          <ol className="list-decimal space-y-1.5 pl-5 text-sm text-[#4b5563]">
            {seo.sources.map((src) => (
              <li key={src.url}>
                <a href={src.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-[#001f3f]">
                  {src.label}
                </a>
              </li>
            ))}
          </ol>
        </section>
      )}

      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-8">
        {/* Route into live inventory */}
        <div className="bg-[#001f3f] p-6 sm:p-8">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#d6b357]">
            Ready to look at properties?
          </p>
          <p className="mt-1.5 text-lg font-bold text-white">
            See what&rsquo;s on the market right now.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              href="/off-plan-projects-in-dubai"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#d6b357] text-[#001f3f] text-sm font-bold hover:bg-[#c8a544] transition-colors"
            >
              Off-Plan Projects in Dubai
            </Link>
            <Link
              href="/buy"
              className="inline-flex items-center gap-2 px-5 py-2.5 border border-white/25 bg-white/10 text-white text-sm font-bold hover:bg-white/20 transition-colors"
            >
              Buy
            </Link>
            <Link
              href="/rent"
              className="inline-flex items-center gap-2 px-5 py-2.5 border border-white/25 bg-white/10 text-white text-sm font-bold hover:bg-white/20 transition-colors"
            >
              Rent
            </Link>
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 px-5 py-2.5 border border-white/25 bg-white/10 text-white text-sm font-bold hover:bg-white/20 transition-colors"
            >
              Talk to a consultant
            </Link>
          </div>
        </div>

        {/* Related guides & searches — the pages link into each other, so a
            visitor (or crawler) can walk the whole set from any entry point. */}
        {related.length > 0 && (
          <div className="bg-[#f8fafc] border border-[#e8eaed] p-6">
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#9ca3af] mb-4">
              {seo.guideType === "buyer" ? "Related guides & searches" : "Related areas & searches"}
            </p>
            <div className="flex flex-wrap gap-2.5">
              {related.map((r) => (
                <Link
                  key={r.slug}
                  href={`/${r.slug}`}
                  className="px-4 py-2 border border-[#e5e5e5] bg-white text-sm font-semibold text-[#001f3f] hover:border-[#d6b357] hover:bg-[#d6b357]/10 transition-colors"
                >
                  {r.label}
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
