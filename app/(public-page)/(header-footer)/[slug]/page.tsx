import type { Metadata } from "next"
import Image from "next/image"
import { notFound } from "next/navigation"
import Link from "next/link"
import { createPublicSupabaseClient } from "@/lib/supabase/public"
import { createPageMetadata, truncateDescription } from "@/lib/seo"
import { ProjectCard, formatProjectPrice, type ProjectCardData } from "@/components/project-card"
import { FeaturedProjectsShowcase, type FeaturedProjectData } from "@/components/public/featured-projects-showcase"
import { UaeMap } from "@/components/public/uae-map"
import { MagneticLink } from "@/components/public/magnetic-link"
import { TransitionLink } from "@/components/public/transition-link"
import { Reveal } from "@/components/public/reveal"
import { InView } from "@/components/public/in-view"
import { CountUp } from "@/components/public/count-up"
import { countByEmirate } from "@/lib/emirates"
import { SOCIAL_URLS } from "@/lib/social"
import { getSeoPage, NON_UAE_CITIES, SEO_PAGES, type SeoPage, type SeoPageFilter } from "@/lib/seo-pages"
import { ContactForm } from "../contact/contact-form"
import { fetchSectionPage } from "@/lib/sitemap-sections"
import { breadcrumbList, developerOrganizationSchema, faqPageSchema, itemListSchema } from "@/lib/structured-data"
import { JsonLd } from "@/components/json-ld"
import { Building2, Facebook, Mail, MapPin, CheckCircle2, ArrowLeft, ArrowUpRight, Globe } from "lucide-react"

/** The company inbox shown across the public site (contact page, footer). */
const CONTACT_EMAIL = "info@fhiglobal.ae"

/** Prices below this are placeholder rows, not real UAE property prices —
 *  never surface them as a headline stat. (Same guard in the homepage hero.) */
const MIN_REALISTIC_PRICE_AED = 50_000

export const revalidate = 120

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

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://fhiglobal.ae"
  const supabase = createPublicSupabaseClient()
  const { data, error } = await supabase
    .from("developers")
    .select("name, description, logo_url, logo_bg, address")
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
      return createPageMetadata({
        title: seo.title,
        description: seo.description,
        openGraphTitle: seo.h1,
        openGraphDescription: seo.description,
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

  const ogImage = `${siteUrl}/og/developer/${slug}`
  const description =
    truncateDescription(data.description) ||
    `Explore projects by ${data.name} — off-plan and ready properties in Dubai on FHI Global.`
  const keywords = [data.name, data.address, "Dubai developer", "real estate developer UAE"].filter(Boolean) as string[]

  return createPageMetadata({
    title: `${data.name} Projects`,
    description,
    openGraphTitle: data.name,
    openGraphDescription: description,
    imageUrl: ogImage || data.logo_url,
    pathname: `/${slug}`,
    keywords,
  })
}

export default async function DeveloperDetailPage({ params }: Props) {
  const { slug } = await params
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

  const { data: projects } = await supabase
    .from("projects")
    .select("id, name, slug, main_image, location, city, community, delivery_quarter, launch_price_from, launch_price_to, currency, status, is_featured, developers(name, logo_url, slug)")
    .eq("developer_id", developer.id)
    .eq("is_active", true)
    .eq("is_published", true)
    .order("created_at", { ascending: false })

  // A project with no picture doesn't appear on the public page — a grid of
  // grey "No Image" cards undersells the developer. But main_image being unset
  // doesn't mean the project has no photos: try its gallery first, and hide
  // only the projects with genuinely nothing to show. The portfolio grid, its
  // count pill, and the hero snapshot all use this filtered list; the listings
  // section below deliberately does not (listings carry their own photos).
  const missingImageIds = (projects ?? []).filter((p) => !p.main_image?.trim()).map((p) => p.id)
  const galleryFallback = new Map<number, string>()
  if (missingImageIds.length > 0) {
    const { data: gallery } = await supabase
      .from("project_images")
      .select("project_id, url, is_main, rank")
      .in("project_id", missingImageIds)
      .order("is_main", { ascending: false })
      .order("rank", { ascending: true })
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
  if (projectIds.length > 0) {
    const { data: listingRows } = await supabase
      .from("agent_listings")
      .select("id, slug, title, listing_kind, price, currency, project_id, agent_listing_images(url, sort_order)")
      .in("project_id", projectIds)
      .eq("status", "published")
      .is("deleted_at", null)
      .order("updated_at", { ascending: false })
      .limit(24)
    listings = (listingRows ?? []) as unknown as DevListing[]
  }
  const projectById = new Map((projects ?? []).map((p) => [p.id, p]))
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
      {/* Entity + trail + the portfolio actually shown below (schema mirrors
          visible content: only projects that render make the ItemList). */}
      <JsonLd
        schema={[
          developerOrganizationSchema(developer),
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
              <Image src={heroImage} alt="" fill priority sizes="100vw" className="object-cover object-center" />
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
                    <span key={`${w}-${i}`} className="wf-word mr-[0.24em]">
                      <span style={{ ["--i" as string]: i }}>{w}</span>
                    </span>
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
                    href={enquireHref}
                    className="group inline-flex items-center justify-center gap-2.5 bg-[#d6b357] px-7 py-4 text-[15px] font-bold text-[#001f3f] transition-colors hover:bg-[#e2c26a]"
                  >
                    Talk to us about {developer.name}
                    <ArrowUpRight className="h-4 w-4 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
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
                  <span className="wf-word mr-[0.24em]"><span style={{ ["--i" as string]: 0 }} className="text-[#0d1117]">Projects</span></span>
                  <span className="wf-word mr-[0.24em]"><span style={{ ["--i" as string]: 1 }} className="text-[#0d1117]">by</span></span>
                  {nameWords.map((w: string, i: number) => (
                    <span key={`${w}-${i}`} className="wf-word mr-[0.24em]"><span style={{ ["--i" as string]: 2 + i }} className="wf-gold">{w}</span></span>
                  ))}
                </h2>
              </div>
              <Link
                href={`/projects?developer=${encodeURIComponent(String(developer.id))}`}
                className="wf-fade inline-flex shrink-0 items-center gap-2 text-sm font-bold text-[#0d1117] transition-colors hover:text-[#b8913f]"
                style={{ ["--d" as string]: "700ms" }}
              >
                Browse with filters
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
            <MagneticLink href={enquireHref} className="mt-7 inline-flex items-center gap-2 bg-[#0d1117] px-6 py-3.5 text-[15px] font-bold text-white transition-colors hover:bg-[#001f3f]">
              Ask about {developer.name} <ArrowUpRight className="h-4 w-4 text-[#d6b357]" />
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
                <span key={w} className="wf-word mr-[0.24em]"><span style={{ ["--i" as string]: i }}>{w}</span></span>
              ))}
              <span className="block">
                {["before", "you", "decide."].map((w, i) => (
                  <span key={w} className="wf-word mr-[0.24em]"><span style={{ ["--i" as string]: 5 + i }} className="wf-gold">{w}</span></span>
                ))}
              </span>
            </h2>
            <p className="wf-fade mt-5 max-w-xl text-[16px] leading-relaxed text-white/75" style={{ ["--d" as string]: "700ms" }}>
              Availability, payment plans and the units worth waiting for, from a team that works directly with the developer.
            </p>
          </div>
          <div className="wf-fade flex flex-col gap-3 sm:flex-row lg:flex-col xl:flex-row" style={{ ["--d" as string]: "900ms" }}>
            <MagneticLink href={enquireHref} className="inline-flex items-center justify-center gap-2.5 bg-[#d6b357] px-7 py-4 text-[15px] font-bold text-[#001f3f] transition-colors hover:bg-[#e2c26a]">
              <Mail className="h-4 w-4" /> Email us
            </MagneticLink>
            <MagneticLink href="/contact" className="inline-flex items-center justify-center gap-2.5 border border-white/35 px-7 py-4 text-[15px] font-bold text-white transition-colors hover:border-white/70 hover:bg-white/10">
              Contact form
            </MagneticLink>
            <a
              href={SOCIAL_URLS.facebook}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Follow FHI Global on Facebook"
              className="inline-flex items-center justify-center gap-2.5 border border-white/35 px-7 py-4 text-[15px] font-bold text-white transition-colors hover:border-white/70 hover:bg-white/10"
            >
              <Facebook className="h-4 w-4 fill-current" /> Facebook
            </a>
          </div>
        </InView>
      </section>
    </div>
  )
}

type SeoGridRow = {
  id: number
  name: string
  slug: string | null
  main_image: string | null
  location: string | null
  city: string | null
  community: string | null
  delivery_quarter: string | null
  launch_price_from: number | string | null
  launch_price_to: number | string | null
  currency: string | null
  status: string
  is_featured: boolean | null
  developers: { name: string | null; logo_url: string | null; slug: string | null } | null
  /** Unit prices, used to keep the "starting from" stat honest — see inventoryPriceFrom. */
  project_units: { price_from: number | string | null }[] | null
}

/**
 * Projects matching a SeoPageFilter, with a gallery image substituted for any
 * row whose main_image is blank and rows that still have no photo dropped.
 * Shared by the inventory landing pages and the area guides.
 */
async function fetchSeoInventory(filter: SeoPageFilter): Promise<SeoGridRow[]> {
  const supabase = createPublicSupabaseClient()

  // Property-type pages need an inner join so only projects carrying the
  // type survive; every other page keeps the plain select.
  const baseSelect =
    "id, name, slug, main_image, location, city, community, delivery_quarter, launch_price_from, launch_price_to, currency, status, is_featured, developers(name, logo_url, slug), project_units(price_from)"
  // Widened to string on purpose: supabase-js's type-level parser can't read
  // the conditional embed, and these rows are consumed loosely below anyway.
  const select: string = filter.propertyTypeLike
    ? `${baseSelect}, project_property_types!inner(property_types!inner(name))`
    : baseSelect

  let query = supabase
    .from("projects")
    .select(select)
    .eq("is_active", true)
    .eq("is_published", true)
    .order("created_at", { ascending: false })

  if (filter.cityLike) {
    query = query.ilike("city", `%${filter.cityLike}%`)
  } else {
    // Portfolio-wide pages say "UAE" — keep the one-off foreign projects out
    // so the claim stays true.
    for (const c of NON_UAE_CITIES) query = query.not("city", "ilike", `%${c}%`)
  }
  if (filter.statuses?.length) query = query.in("status", filter.statuses)
  if (filter.propertyTypeLike) {
    query = query.ilike("project_property_types.property_types.name", `%${filter.propertyTypeLike}%`)
  }
  if (filter.locationLike) {
    query = query.or(`location.ilike.%${filter.locationLike}%,community.ilike.%${filter.locationLike}%`)
  }
  if (filter.priceMin != null) query = query.gte("launch_price_from", filter.priceMin)
  if (filter.priceMax != null) {
    // The realistic floor keeps placeholder AED 1 rows off "budget" pages.
    query = query.gte("launch_price_from", MIN_REALISTIC_PRICE_AED).lte("launch_price_from", filter.priceMax)
  }
  if (filter.handoverYear) {
    const y = filter.handoverYear
    query = query.or(
      `delivery_quarter.ilike.%${y}%,and(expected_completion_date.gte.${y}-01-01,expected_completion_date.lte.${y}-12-31)`,
    )
  }

  const { data: projectsRaw } = await query
  const projects = (projectsRaw ?? []) as unknown as SeoGridRow[]

  const missingIds = (projects ?? []).filter((p) => !p.main_image?.trim()).map((p) => p.id)
  const galleryFallback = new Map<number, string>()
  if (missingIds.length > 0) {
    const { data: gallery } = await supabase
      .from("project_images")
      .select("project_id, url, is_main, rank")
      .in("project_id", missingIds)
      .order("is_main", { ascending: false })
      .order("rank", { ascending: true })
    for (const g of gallery ?? []) {
      if (g.url && !galleryFallback.has(g.project_id)) galleryFallback.set(g.project_id, g.url)
    }
  }
  return (projects ?? [])
    .map((p) => ({ ...p, main_image: p.main_image?.trim() || galleryFallback.get(p.id) || null }))
    .filter((p) => p.main_image)
}

/**
 * Lowest price actually on sale across a result set.
 *
 * launch_price_from undercuts the project's own unit table on 124 of the 174
 * projects that carry both, so a bare MIN over that column advertised prices
 * nothing was sold at (Al Jaddaf led with "AED 199,999" against a cheapest
 * real unit of AED 1,999,999). Same rule as priceFromValue on project pages.
 */
function projectFloorPrice(p: SeoGridRow): number | null {
  const head = Number(p.launch_price_from)
  const headline = Number.isFinite(head) && head >= MIN_REALISTIC_PRICE_AED ? head : null
  const units = (p.project_units ?? [])
    .map((u) => Number(u.price_from))
    .filter((n) => Number.isFinite(n) && n >= MIN_REALISTIC_PRICE_AED)
  if (units.length === 0) return headline
  const cheapestUnit = Math.min(...units)
  if (headline == null) return cheapestUnit
  return headline < cheapestUnit * 0.9 ? cheapestUnit : Math.min(headline, cheapestUnit)
}

/** Cheapest price on sale in a result set, formatted. */
function inventoryPriceFrom(rows: SeoGridRow[]): string | null {
  const priced = rows
    .map((p) => ({ p, floor: projectFloorPrice(p) }))
    .filter((x): x is { p: SeoGridRow; floor: number } => x.floor != null)
    .sort((a, b) => a.floor - b.floor)[0]
  if (!priced) return null
  const cheapest = priced.floor
  const currency = (priced.p.currency ?? "AED").toUpperCase()
  return `${currency} ${
    cheapest >= 1_000_000
      ? `${(cheapest / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`
      : cheapest.toLocaleString("en-AE", { maximumFractionDigits: 0 })
  }`
}

/**
 * "2026–2029" across the stock still being delivered. Completed projects are
 * excluded — an area guide that announced "Handover 2018–2028" was quoting a
 * building handed over years ago.
 */
function inventoryHandoverRange(rows: SeoGridRow[]): string | null {
  const years = rows
    .filter((p) => p.status !== "completed")
    .map((p) => p.delivery_quarter?.match(/\d{4}/)?.[0])
    .filter((y): y is string => Boolean(y))
    .sort()
  if (years.length === 0) return null
  const first = years[0]
  const last = years[years.length - 1]
  return first === last ? first : `${first}–${last}`
}

async function SeoLandingPage({ seo }: { seo: SeoPage }) {
  if (seo.kind === "guide") return <SeoGuidePage seo={seo} />

  const filter = seo.filter ?? {}
  const visible = await fetchSeoInventory(filter)

  // Masthead collage + facts, all from the projects already loaded — no extra
  // query, and every photo is one of the results below.
  const collagePhotos = visible.slice(0, 4).map((p) => p.main_image as string)
  const developerCount = new Set(
    visible.map((p) => (p.developers as { name?: string } | null)?.name).filter(Boolean),
  ).size
  const priceFrom = inventoryPriceFrom(visible)

  const shown = visible.slice(0, 24)
  const related = seo.related.map(getSeoPage).filter((r): r is SeoPage => Boolean(r))

  return (
    <div className="bg-[#f7f8fa]">
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

          {/* Collage — real projects from the grid below; on mobile it sits
              between the title and the facts. */}
          <div className="relative mt-6 aspect-[16/10] bg-[#001f3f] lg:absolute lg:inset-y-0 lg:right-0 lg:left-[56%] lg:z-10 lg:mt-0 lg:aspect-auto">
            {collagePhotos.length === 0 ? (
              <div className="absolute inset-0 flex items-center justify-center">
                <Building2 className="w-14 h-14 text-[#d6b357]/50" />
              </div>
            ) : collagePhotos.length === 1 ? (
              <Image
                src={collagePhotos[0]}
                alt={seo.h1}
                fill
                priority
                sizes="(min-width: 1024px) 44vw, 100vw"
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
                      priority={i === 0}
                      sizes="(min-width: 1024px) 22vw, 50vw"
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

          {/* CTAs + trust line — the column carries weight and routes the
              visitor instead of trailing off into white space. */}
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 px-6 py-3 bg-[#001f3f] text-white text-sm font-bold hover:bg-[#00152b] transition-colors"
            >
              Talk to a Consultant <ArrowLeft className="w-4 h-4 rotate-180" />
            </Link>
            <Link
              href="/developers"
              className="inline-flex items-center gap-2 px-6 py-3 border border-[#d6b357] text-[#8a6d2a] text-sm font-bold hover:bg-[#d6b357]/10 transition-colors"
            >
              Browse Developers
            </Link>
          </div>
          <p className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-[12px] font-semibold text-[#6b7280]">
            <span className="inline-flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#b8913f]" /> RERA-registered developers
            </span>
            <span className="inline-flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#b8913f]" /> Direct developer prices
            </span>
            <span className="inline-flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#b8913f]" /> Guidance from launch to handover
            </span>
          </p>
        </div>
      </section>

      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-12">
        {shown.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5">
            {shown.map((p, i) => (
              // Stagger across the row only, so later rows don't inherit an
              // ever-growing delay and arrive late.
              <Reveal key={p.id} delay={(i % 3) * 90}>
                <ProjectCard project={p as unknown as ProjectCardData} />
              </Reveal>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 bg-white border border-[#e8eaed] text-center">
            <Building2 className="w-8 h-8 text-[#001f3f]/25 mb-3" />
            <p className="font-['Outfit'] font-semibold text-[#0d1117] text-sm mb-1">Nothing here right now</p>
            <p className="text-[#6b7280] text-xs">New launches land regularly — check the full projects browser.</p>
          </div>
        )}

        {visible.length > shown.length && (
          <div className="text-center">
            <Link
              href="/projects"
              className="inline-flex items-center gap-2 px-6 py-3 bg-[#001f3f] text-white text-sm font-bold hover:bg-[#00152b] transition-colors"
            >
              Browse all {visible.length} projects <ArrowLeft className="w-4 h-4 rotate-180" />
            </Link>
          </div>
        )}

        {/* Enquiry — the lead form on the page itself, so the path from a
            Google search to a consultant is one scroll, not a navigation. */}
        <Reveal>
          <section className="bg-white border border-[#e8eaed] grid grid-cols-1 lg:grid-cols-5">
            <div className="lg:col-span-2 bg-[#001f3f] p-6 sm:p-8">
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#d6b357]">
                Enquire Now
              </p>
              <h2 className="mt-2 font-['Outfit'] text-2xl font-bold text-white leading-tight">
                Tell us what you&apos;re looking for
              </h2>
              <span className="block w-12 h-[3px] bg-[#d6b357] mt-4 mb-5" aria-hidden="true" />
              <p className="text-white/75 text-[14.5px] leading-relaxed">
                Share your budget and goals, and a consultant will come back the same business day
                with a shortlist matched to this search — developer pricing, no mark-up, and our
                guidance costs you nothing.
              </p>
            </div>
            <div className="lg:col-span-3 p-6 sm:p-8">
              <ContactForm />
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
/** Below this an area has too little of our own stock to headline a grid. */
const MIN_GUIDE_INVENTORY = 3

async function SeoGuidePage({ seo }: { seo: SeoPage }) {
  const supabase = createPublicSupabaseClient()

  // Our projects in this area. The guides used to query nothing at all, so
  // they showed no inventory and linked to no project — the reason a project
  // page like Binghatti Cullinan had two internal links on the whole site.
  const inventory = seo.inventoryFilter ? await fetchSeoInventory(seo.inventoryFilter) : []
  const hasInventory = inventory.length >= MIN_GUIDE_INVENTORY
  const gridProjects = hasInventory ? inventory.slice(0, 8) : []

  type Photo = { url: string; name: string; slug: string | null; devSlug: string | null }
  let photo: Photo | null = null
  // Prefer a project actually in this area — already loaded, so no extra query.
  if (hasInventory) {
    const lead = inventory[0]
    photo = {
      url: lead.main_image as string,
      name: lead.name,
      slug: lead.slug,
      devSlug: (lead.developers as { slug: string | null } | null)?.slug ?? null,
    }
  }

  if (seo.imageQuery) {
    const { data } = await supabase
      .from("projects")
      .select("name, slug, main_image, developers(slug)")
      .eq("is_active", true)
      .eq("is_published", true)
      .not("main_image", "is", null)
      .neq("main_image", "")
      .not("name", "ilike", "%test%")
      .or(`location.ilike.%${seo.imageQuery}%,name.ilike.%${seo.imageQuery}%`)
      .limit(1)
      .maybeSingle()
    if (data?.main_image) photo = { url: data.main_image, name: data.name, slug: data.slug, devSlug: (data.developers as unknown as { slug: string | null } | null)?.slug ?? null }
  }
  if (!photo) {
    // No project in this exact area yet — pick from the Dubai pool, keyed by
    // the slug so each guide keeps a stable, distinct photo between builds.
    const { data: pool } = await supabase
      .from("projects")
      .select("name, slug, main_image, developers(slug)")
      .eq("is_active", true)
      .eq("is_published", true)
      .not("main_image", "is", null)
      .neq("main_image", "")
      .not("name", "ilike", "%test%")
      .ilike("city", "%dubai%")
      .order("created_at", { ascending: true })
      .limit(12)
    if (pool?.length) {
      const idx = [...seo.slug].reduce((a, c) => a + c.charCodeAt(0), 0) % pool.length
      const pick = pool[idx]
      photo = { url: pick.main_image!, name: pick.name, slug: pick.slug, devSlug: (pick.developers as unknown as { slug: string | null } | null)?.slug ?? null }
    }
  }

  const related = seo.related.map(getSeoPage).filter((r): r is SeoPage => Boolean(r))

  return (
    <div className="bg-white">
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
        ]}
      />
      {/* Editorial intro — headline and copy on the left, our project photo on
          the right, like the area pages on the major portals. */}
      <section className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-4">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#d6b357]">
          FHI Global · Dubai Area Guide
        </p>
        <div className="mt-3 grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-14 items-start">
          <div>
            <h1 className="font-['Outfit'] text-3xl md:text-[40px] font-bold text-[#001f3f] leading-tight">
              {seo.h1}
            </h1>
            <span className="block w-14 h-1 bg-[#d6b357] mt-4 mb-6" aria-hidden="true" />
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
                  alt={photo.name}
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
                  From our portfolio: {photo.name}
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 max-w-6xl mx-auto">
            {seo.facts.map((f) => (
              <div
                key={f.label}
                className="group bg-white border border-[#e8eaed] p-6 transition-all duration-200 hover:border-[#d6b357]/50 hover:bg-[#d6b357]/[0.07] hover:shadow-[0_14px_32px_-16px_rgba(0,20,40,0.35)]"
              >
                <span className="inline-flex w-9 h-9 bg-[#d6b357]/12 items-center justify-center transition-colors duration-200 group-hover:bg-[#d6b357]">
                  <CheckCircle2 className="w-5 h-5 text-[#d6b357] transition-colors duration-200 group-hover:text-white" />
                </span>
                <p className="mt-3.5 font-['Outfit'] text-lg font-bold text-[#0d1117]">{f.label}</p>
                <p className="mt-1.5 text-[15px] leading-relaxed text-[#4b5563]">{f.value}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Live inventory — the stats and the projects come from the same query,
          so the numbers can never disagree with the cards beneath them. Only
          rendered for areas where we actually hold stock. */}
      {hasInventory && (
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
                href="/new-projects-in-dubai"
                className="inline-flex items-center gap-1.5 text-sm font-bold text-[#001f3f] hover:text-[#b8913f] transition-colors"
              >
                All new projects in Dubai
                <ArrowLeft className="w-4 h-4 rotate-180" />
              </Link>
            </div>

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
            <div key={s.heading}>
              <h2 className="font-['Outfit'] text-2xl font-bold text-[#001f3f]">{s.heading}</h2>
              <span className="block w-10 h-1 bg-[#d6b357] mt-2 mb-4" aria-hidden="true" />
              <p className="text-[16.5px] leading-[1.75] text-[#374151]">{s.body}</p>
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
              href="/new-projects-in-dubai"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#d6b357] text-[#001f3f] text-sm font-bold hover:bg-[#c8a544] transition-colors"
            >
              New Projects in Dubai
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
              Related areas &amp; searches
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
