import type { Metadata } from "next"
import Image from "next/image"
import { notFound } from "next/navigation"
import Link from "next/link"
import { createPublicSupabaseClient } from "@/lib/supabase/public"
import { createPageMetadata, truncateDescription } from "@/lib/seo"
import { ProjectCard, type ProjectCardData } from "@/components/project-card"
import { Reveal } from "@/components/public/reveal"
import { SOCIAL_URLS } from "@/lib/social"
import { getSeoPage, NON_UAE_CITIES, SEO_PAGES, type SeoPage } from "@/lib/seo-pages"
import { fetchSectionPage } from "@/lib/sitemap-sections"
import { breadcrumbList, developerOrganizationSchema, faqPageSchema, itemListSchema } from "@/lib/structured-data"
import { JsonLd } from "@/components/json-ld"
import { Building2, Facebook, Mail, MapPin, CheckCircle2, ArrowLeft } from "lucide-react"

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
    .select("name, description, logo_url, address")
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
    .select("id, name, slug, main_image, location, city, launch_price_from, launch_price_to, currency, status, is_featured, developers(name, logo_url, slug)")
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

  return (
    <div className="relative min-h-screen bg-[#fafafa] font-sans overflow-x-hidden">
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
      {/* Hero — light and compact (approved mockup): identity in dark ink over
          a daytime skyline that fades to white on the left. */}
      <section className="relative bg-white overflow-hidden">
        <div className="absolute inset-0" aria-hidden="true">
          <Image
            src="/background/developers.webp"
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover object-[70%_center]"
          />
          {/* Photo scrim: near-solid white where the identity sits, the
              skyline showing through on the right. */}
          <div className="absolute inset-0 bg-gradient-to-r from-white via-white/90 to-white/20" />
          <div className="absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-white/70 to-transparent" />
        </div>

        <div className="relative max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-8">
          {/* Back */}
          <Link
            href="/developers"
            className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-[#0d1117] hover:text-[#b8913f] transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> All Developers
          </Link>

          <div className="mt-5 flex flex-col sm:flex-row items-start gap-6">
            {/* Logo */}
            <div className="w-32 h-32 md:w-36 md:h-36 bg-white border border-[#d6b357]/50 shadow-[0_12px_32px_-16px_rgba(0,20,40,0.3)] flex items-center justify-center shrink-0 overflow-hidden">
              {developer.logo_url ? (
                <Image
                  src={developer.logo_url}
                  alt={`${developer.name} logo`}
                  width={110}
                  height={110}
                  className="max-w-[75%] max-h-[75%] object-contain"
                />
              ) : (
                <Building2 className="w-12 h-12 text-[#d6b357]" />
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="font-['Outfit'] text-3xl md:text-[40px] font-bold text-[#001f3f] leading-[1.08]">
                  {developer.name}
                </h1>
                {developer.is_verified && (
                  <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-white/85 border border-[#d6b357] text-[#b8913f] text-xs font-bold uppercase tracking-wider">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Verified
                  </span>
                )}
              </div>
              <span className="block w-12 h-1 bg-[#d6b357] mt-3 mb-3" aria-hidden="true" />
              <p className="text-[15px] text-[#374151] max-w-2xl mb-2">
                New Dubai launches, price drops and open houses — first.
              </p>
              {developer.address && (
                <div className="flex items-start gap-2 text-sm text-[#4b5563] max-w-xl">
                  <MapPin className="w-4 h-4 text-[#b8913f] shrink-0 mt-0.5" /> {developer.address}
                </div>
              )}
            </div>
          </div>

          {/* Two flat contact cards over the photo (mockup): icon block,
              title, subline, arrow. Square everything. */}
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <a
              href={SOCIAL_URLS.facebook}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Follow FHI Global on Facebook"
              className="group flex items-center gap-4 px-5 py-4 bg-white border border-[#e5e8ec] shadow-[0_14px_36px_-20px_rgba(0,20,40,0.4)] hover:border-[#d6b357]/60 transition-colors"
            >
              <span className="w-11 h-11 bg-[#1877F2] flex items-center justify-center shrink-0">
                <Facebook className="w-5 h-5 text-white fill-current" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-bold text-[#0d1117]">Follow us on Facebook</span>
                <span className="block text-xs text-[#6b7280] mt-0.5">Stay updated with the latest news and launches.</span>
              </span>
              <ArrowLeft className="w-5 h-5 rotate-180 text-[#001f3f] shrink-0 transition-transform group-hover:translate-x-1" />
            </a>
            <a
              href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(`Enquiry — ${developer.name}`)}`}
              aria-label={`Email FHI Global about ${developer.name}`}
              className="group flex items-center gap-4 px-5 py-4 bg-white border border-[#e5e8ec] shadow-[0_14px_36px_-20px_rgba(0,20,40,0.4)] hover:border-[#d6b357]/60 transition-colors"
            >
              <span className="w-11 h-11 bg-[#d6b357] flex items-center justify-center shrink-0">
                <Mail className="w-5 h-5 text-white" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-bold text-[#0d1117]">{CONTACT_EMAIL}</span>
                <span className="block text-xs text-[#6b7280] mt-0.5">Get in touch with us.</span>
              </span>
              <ArrowLeft className="w-5 h-5 rotate-180 text-[#001f3f] shrink-0 transition-transform group-hover:translate-x-1" />
            </a>
          </div>
        </div>
      </section>

      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10">
        {/* About — copy + CTA on the left, a portfolio photo in a gold offset
            frame on the right (mockup). */}
        {developer.description && (
          <section>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-14 items-center">
              <div>
                <div className="flex items-center gap-2.5 mb-3">
                  <span className="w-6 h-[3px] bg-[#d6b357]" aria-hidden="true" />
                  <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#0d1117]">About</span>
                </div>
                <h2 className="font-['Outfit'] text-2xl md:text-3xl font-bold text-[#0d1117] mb-3">
                  About {developer.name}
                </h2>
                <span className="block w-14 h-1 bg-[#d6b357] mb-6" aria-hidden="true" />
                <p className="text-[#374151] text-base leading-relaxed whitespace-pre-line">{developer.description}</p>
                <Link
                  href="/about"
                  className="mt-6 inline-flex items-center gap-2 px-5 py-3 bg-[#001f3f] text-white text-sm font-bold hover:bg-[#00152b] transition-colors"
                >
                  Learn More About Us <ArrowLeft className="w-4 h-4 rotate-180" />
                </Link>
              </div>
              {visibleProjects[0]?.main_image && (
                <div className="relative hidden lg:block">
                  <div className="absolute top-10 -bottom-4 -right-4 w-2/3 border border-[#d6b357]" aria-hidden="true" />
                  <div className="relative overflow-hidden ring-1 ring-[#e8eaed] aspect-[4/3] shadow-[0_18px_44px_-20px_rgba(0,20,40,0.35)]">
                    <Image
                      src={visibleProjects[0].main_image}
                      alt={`${developer.name} project`}
                      fill
                      sizes="(max-width: 1024px) 100vw, 50vw"
                      className="object-cover"
                    />
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#001428]/80 to-transparent px-4 pb-3 pt-10">
                      <p className="text-white text-sm font-bold truncate">{visibleProjects[0].name}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Available listings — live agent offers under this developer's projects */}
        {listings.length > 0 && (
          <section>
            <div className="flex items-end justify-between mb-5">
              <div>
                <div className="flex items-center gap-2.5 mb-3">
                  <span className="w-6 h-[3px] bg-[#d6b357]" aria-hidden="true" />
                  <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#0d1117]">On the Market</span>
                </div>
                <h2 className="font-['Outfit'] text-2xl font-bold text-[#0d1117] leading-tight">
                  Available Listings from{" "}
                  <span className="text-[#b8913f]">{developer.name}</span>
                </h2>
              </div>
              <div className="hidden sm:flex items-center gap-2">
                {forSaleCount > 0 && (
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#8a6d2a]">{forSaleCount} for sale</span>
                )}
                {forRentCount > 0 && (
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#2456b3]">{forRentCount} for rent</span>
                )}
              </div>
            </div>
            <div className="h-px bg-[#e5e8ec] mb-8" />

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5">
              {listings.map((l) => {
                const cover = listingCover(l)
                const proj = l.project_id != null ? projectById.get(l.project_id) : undefined
                return (
                  <Link
                    key={l.id}
                    href={`/listings/${l.slug ?? l.id}`}
                    className="group relative bg-white border border-[#e5e8ec] overflow-hidden transition-shadow duration-300 hover:shadow-[0_14px_40px_-16px_rgba(0,20,40,0.25)]"
                  >
                    <div className="relative h-44 bg-[#eef1f5]">
                      {cover ? (
                        <Image
                          src={cover}
                          alt={l.title}
                          fill
                          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                          className="object-cover group-hover:scale-[1.04] transition-transform duration-300"
                        />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center text-[#b8bfc9]">
                          <Building2 className="w-8 h-8" />
                        </div>
                      )}
                      <span
                        className={`absolute top-3 left-3 px-2.5 py-1 text-[11px] font-bold text-white ${
                          l.listing_kind === "rent" ? "bg-[#2f6fe4]" : "bg-[#d6b357]"
                        }`}
                      >
                        {l.listing_kind === "rent" ? "FOR RENT" : "FOR SALE"}
                      </span>
                    </div>
                    <div className="p-4">
                      <p className="font-['Outfit'] text-lg font-bold text-[#0f2940] leading-tight mb-1">
                        {listingPriceLabel(l)}
                      </p>
                      <p className="text-sm font-semibold text-[#374151] truncate">{l.title}</p>
                      {proj && (
                        <p className="text-xs text-[#6b7280] truncate mt-0.5">
                          {[proj.name, proj.city].filter(Boolean).join(" · ")}
                        </p>
                      )}
                    </div>
                  </Link>
                )
              })}
            </div>
          </section>
        )}

        {/* Projects */}
        <section>
          <div className="flex items-end justify-between mb-5">
            <div>
              <div className="flex items-center gap-2.5 mb-3">
                <span className="w-6 h-[3px] bg-[#d6b357]" aria-hidden="true" />
                <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#0d1117]">Portfolio</span>
              </div>
              <h2 className="font-['Outfit'] text-2xl font-bold text-[#0d1117] leading-tight">
                Projects by{" "}
                <span className="text-[#b8913f]">{developer.name}</span>
              </h2>
            </div>
            <div className="flex items-center gap-6">
              <Link
                href="/projects"
                className="hidden sm:inline-flex items-center gap-1.5 text-sm font-bold text-[#0d1117] hover:text-[#b8913f] transition-colors"
              >
                View All Projects <ArrowLeft className="w-4 h-4 rotate-180" />
              </Link>
              <div className="border border-[#e5e8ec] bg-white px-6 py-3 text-center">
                <p className="font-['Outfit'] text-3xl font-bold text-[#0d1117] leading-none">{visibleProjects.length}</p>
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#6b7280] mt-1">
                  Project{visibleProjects.length !== 1 ? "s" : ""}
                </p>
              </div>
            </div>
          </div>
          <div className="h-px bg-[#e5e8ec] mb-8" />

          {visibleProjects.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5">
              {visibleProjects.map((p) => (
                <ProjectCard key={p.id} project={p as unknown as ProjectCardData} />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 bg-white border border-[#e5e8ec] text-center">
              <div className="w-14 h-14 bg-[#001f3f]/5 flex items-center justify-center mb-4">
                <Building2 className="w-7 h-7 text-[#001f3f]/25" />
              </div>
              <p className="font-['Outfit'] font-semibold text-[#0d1117] text-sm mb-1">No projects yet</p>
              <p className="text-[#6b7280] text-xs">This developer hasn&apos;t published any projects.</p>
            </div>
          )}
        </section>
      </div>

      {/* Closing band — brand line on the left, contact CTA on the right
          (mockup's footer strip). */}
      <section className="border-t border-[#e8eaed] bg-white">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col lg:flex-row lg:items-center gap-6">
          <div className="flex items-center gap-4 flex-1 min-w-0">
            <span className="w-12 h-12 border border-[#d6b357] text-[#b8913f] flex items-center justify-center shrink-0">
              <Building2 className="w-6 h-6" />
            </span>
            <p className="font-['Outfit'] text-xl md:text-2xl font-bold leading-tight">
              <span className="text-[#001f3f]">Crafting exceptional spaces.</span>{" "}
              <span className="block text-[#b8913f]">Elevating lifestyles.</span>
            </p>
          </div>
          <div className="lg:border-l lg:border-[#e8eaed] lg:pl-8">
            <p className="text-[15px] font-bold text-[#0d1117]">Have questions or want to know more?</p>
            <p className="text-sm text-[#6b7280] mt-0.5">Our team is here to help.</p>
            <Link
              href="/contact"
              className="mt-3 inline-flex items-center gap-2 px-5 py-2.5 bg-[#d6b357] text-[#001f3f] text-sm font-bold hover:bg-[#c8a544] transition-colors"
            >
              Get in Touch <ArrowLeft className="w-4 h-4 rotate-180" />
            </Link>
          </div>
        </div>
      </section>

    </div>
  )
}

// ─── SEO landing pages ─────────────────────────────────────────────────────
// fhiglobal.ae/new-projects-in-dubai and friends: a curated intro + a live,
// server-rendered project grid. The grid uses the same visibility rule as the
// developer portfolio above — no picture anywhere, no card — so these pages
// can never degrade into grids of grey placeholders.
async function SeoLandingPage({ seo }: { seo: SeoPage }) {
  // Area guides are fully static content pages — no inventory query at all.
  if (seo.kind === "guide") return <SeoGuidePage seo={seo} />

  const filter = seo.filter ?? {}
  const supabase = createPublicSupabaseClient()

  // Property-type pages need an inner join so only projects carrying the
  // type survive; every other page keeps the plain select.
  const baseSelect =
    "id, name, slug, main_image, location, city, launch_price_from, launch_price_to, currency, status, is_featured, developers(name, logo_url, slug)"
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

  type SeoGridRow = {
    id: number
    name: string
    slug: string | null
    main_image: string | null
    location: string | null
    city: string | null
    launch_price_from: number | string | null
    launch_price_to: number | string | null
    currency: string | null
    status: string
    is_featured: boolean | null
    developers: { name: string | null; logo_url: string | null; slug: string | null } | null
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
  const visible = (projects ?? [])
    .map((p) => ({ ...p, main_image: p.main_image?.trim() || galleryFallback.get(p.id) || null }))
    .filter((p) => p.main_image)

  // Masthead collage + facts, all from the projects already loaded — no extra
  // query, and every photo is one of the results below.
  const collagePhotos = visible.slice(0, 4).map((p) => p.main_image as string)
  const developerCount = new Set(
    visible.map((p) => (p.developers as { name?: string } | null)?.name).filter(Boolean),
  ).size
  // Sanity floor: a placeholder launch_price_from of 1 in a single DB row
  // used to make the flagship landing page lead with "Starting from AED 1".
  const cheapest = visible
    .map((p) => Number(p.launch_price_from))
    .filter((n) => Number.isFinite(n) && n >= MIN_REALISTIC_PRICE_AED)
    .sort((a, b) => a - b)[0]
  const priceFrom = cheapest
    ? `${(visible.find((p) => Number(p.launch_price_from) === cheapest)?.currency ?? "AED").toUpperCase()} ${
        cheapest >= 1_000_000 ? `${(cheapest / 1_000_000).toFixed(1).replace(/\.0$/, "")}M` : cheapest.toLocaleString("en-AE", { maximumFractionDigits: 0 })
      }`
    : null

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

  type Photo = { url: string; name: string; slug: string | null; devSlug: string | null }
  let photo: Photo | null = null

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
