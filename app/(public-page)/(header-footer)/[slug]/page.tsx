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
import { breadcrumbList, developerOrganizationSchema, itemListSchema } from "@/lib/structured-data"
import { JsonLd } from "@/components/json-ld"
import { Building2, Facebook, Mail, MapPin, Star, CheckCircle2, ArrowLeft } from "lucide-react"

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
      <div className="fixed top-[-10%] left-[-10%] w-[600px] h-[600px] rounded-full opacity-25 blur-[120px] -z-10 bg-[radial-gradient(circle,rgb(200,245,255)_0%,rgba(255,255,255,0)_70%)]" />
      <div className="fixed bottom-0 right-[-5%] w-[500px] h-[500px] rounded-full opacity-20 blur-[120px] -z-10 bg-[radial-gradient(circle,rgb(250,240,210)_0%,rgba(255,255,255,0)_70%)]" />


      {/* Hero Banner — skyline photo with navy wash (approved mockup) */}
      <section className="relative pt-16 pb-16 overflow-hidden bg-[#001428]">
        <div className="absolute inset-0">
          <Image
            src="/background/home.webp"
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover object-center"
            aria-hidden="true"
          />
          {/* Heavier on the left where the identity sits; skyline glows on the right */}
          <div className="absolute inset-0 bg-gradient-to-r from-[#001428]/60 via-[#001f3f]/30 to-[#001f3f]/10" />
          <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-[#000d1c]/40 to-transparent" />
        </div>
        {/* Gold accents: top rule + faint arcs on the left (mockup's line art) */}
        <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-transparent via-[#d6b357]/70 to-transparent" />

        <div className="relative max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8">
          {/* Back */}
          <Link
            href="/developers"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#d6b357] hover:text-[#f0d890] transition-colors mb-8"
          >
            <ArrowLeft className="w-4 h-4" /> All Developers
          </Link>

          <div className="flex flex-col md:flex-row items-start md:items-center gap-8">
            {/* Logo */}
            <div className="w-32 h-32 md:w-36 md:h-36 bg-white ring-1 ring-white/60 shadow-[0_18px_50px_-16px_rgba(0,10,25,0.6)] flex items-center justify-center shrink-0 overflow-hidden">
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

            <div className="flex-1">
              <div className="flex items-center gap-4 mb-3 flex-wrap">
                <h1
                  className="font-['Outfit'] text-4xl md:text-5xl font-bold text-white leading-[1.08]"
                  style={{ textShadow: "0 2px 12px rgba(0,10,30,0.85), 0 2px 32px rgba(0,10,30,0.6)" }}
                >
                  {developer.name}
                </h1>
                {developer.is_verified && (
                  <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-[#0a1f38]/80 border border-[#d6b357]/60 text-[#d6b357] text-sm font-bold backdrop-blur-sm">
                    <CheckCircle2 className="w-4 h-4" /> Verified
                  </span>
                )}
              </div>
              <span className="block w-14 h-1 bg-[#d6b357] mb-4" aria-hidden="true" />
              <p className="text-lg text-white/85 max-w-2xl mb-2" style={{ textShadow: "0 1px 8px rgba(0,10,30,0.7)" }}>
                New Dubai launches, price drops and open houses — first.
              </p>
              {developer.address && (
                <div className="flex items-start gap-2 text-base text-white/85 max-w-xl" style={{ textShadow: "0 1px 8px rgba(0,10,30,0.7)" }}>
                  <MapPin className="w-4 h-4 text-[#d6b357] shrink-0 mt-1" /> {developer.address}
                </div>
              )}
            </div>
          </div>

          {/* Two calls to action in the mockup's flat band: icon block,
              title, subline, arrow. Square everything. */}
          <div className="mt-8 border border-white/15 bg-[#001428]/70 backdrop-blur-md grid grid-cols-1 sm:grid-cols-2">
            <a
              href={SOCIAL_URLS.facebook}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Follow FHI Global on Facebook"
              className="group flex items-center gap-4 px-6 py-5 border-b sm:border-b-0 sm:border-r border-white/10 hover:bg-white/[0.05] transition-colors"
            >
              <span className="w-11 h-11 bg-[#1877F2] flex items-center justify-center shrink-0">
                <Facebook className="w-5 h-5 text-white fill-current" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-bold text-white">Follow us on Facebook</span>
                <span className="block text-xs text-white/60 mt-0.5">Stay updated with the latest news and launches.</span>
              </span>
              <ArrowLeft className="w-5 h-5 rotate-180 text-[#d6b357] shrink-0 transition-transform group-hover:translate-x-1" />
            </a>
            <a
              href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(`Enquiry — ${developer.name}`)}`}
              aria-label={`Email FHI Global about ${developer.name}`}
              className="group flex items-center gap-4 px-6 py-5 hover:bg-white/[0.05] transition-colors"
            >
              <span className="w-11 h-11 bg-[#d6b357] flex items-center justify-center shrink-0">
                <Mail className="w-5 h-5 text-[#001f3f]" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-bold text-white">{CONTACT_EMAIL}</span>
                <span className="block text-xs text-white/60 mt-0.5">Get in touch with us.</span>
              </span>
              <ArrowLeft className="w-5 h-5 rotate-180 text-[#d6b357] shrink-0 transition-transform group-hover:translate-x-1" />
            </a>
          </div>
        </div>
      </section>

      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-12">
        {/* About */}
        {developer.description && (
          <section>
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-8 lg:gap-12 items-start">
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
              </div>
              {visibleProjects[0]?.main_image && (
                <div className="relative hidden lg:block overflow-hidden ring-1 ring-[#e8eaed] aspect-[3/4]">
                  <Image
                    src={visibleProjects[0].main_image}
                    alt={`${developer.name} project`}
                    fill
                    sizes="320px"
                    className="object-cover"
                  />
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#001428]/80 to-transparent px-4 pb-3 pt-10">
                    <p className="text-white text-sm font-bold truncate">{visibleProjects[0].name}</p>
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

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
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

  let query = supabase
    .from("projects")
    .select("id, name, slug, main_image, location, city, launch_price_from, launch_price_to, currency, status, is_featured, developers(name, logo_url, slug)")
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

  const { data: projects } = await query

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

  // Hero backdrop + facts, all from the projects already loaded — no extra
  // query, and the photo is guaranteed to be one of the results below.
  const heroPhoto = visible[0]?.main_image ? { url: visible[0].main_image } : null
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
      {/* Trail + exactly the projects rendered in the grid below. */}
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
        ]}
      />
      {/* Masthead — the copy sits over a real project from the very list below,
          rather than a flat navy block or stock imagery. Left-weighted scrim so
          the text stays legible while the building shows through on the right. */}
      <section className="relative bg-[#001f3f] overflow-hidden">
        {heroPhoto && (
          <>
            <Image
              src={heroPhoto.url}
              alt=""
              fill
              sizes="100vw"
              priority
              // Slow cinematic drift, so the masthead isn't a still slab.
              className="absolute inset-0 object-cover animate-kenburns"
              aria-hidden="true"
            />
            {/* Scrim only where the type sits — heavy enough on the left to
                keep the headline legible, clear on the right so the building
                reads as a photo rather than a flat blue panel. */}
            <div className="absolute inset-0 bg-gradient-to-r from-[#001428]/88 via-[#001428]/45 to-transparent" />
          </>
        )}

        {/* Deliberately short: the visitor came to see projects, so the header
            states what this page is and gets out of the way. The explanatory
            copy — which is what actually ranks — sits under the grid. */}
        <div className="relative max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-9">
          <p
            className="animate-hero-item text-[11px] font-bold uppercase tracking-[0.2em] text-[#d6b357]"
            style={{ animationDelay: "60ms" }}
          >
            FHI Global · Popular Searches
          </p>
          <h1
            className="animate-hero-item font-['Outfit'] text-4xl md:text-[46px] font-bold text-white mt-2.5 leading-[1.1] tracking-tight"
            style={{ textShadow: "0 2px 22px rgba(0,10,30,0.55)", animationDelay: "150ms" }}
          >
            {seo.h1}
          </h1>
          <span
            className="animate-hero-item block w-14 h-[3px] bg-[#d6b357] mt-5"
            style={{ animationDelay: "240ms" }}
            aria-hidden="true"
          />

          {/* Facts strip — the count plus what the filter actually means, so the
              header carries information instead of one lonely pill. */}
          <dl className="animate-hero-item mt-7 flex flex-wrap gap-x-12 gap-y-5" style={{ animationDelay: "330ms" }}>
            {[
              { label: "Projects available", value: String(visible.length) },
              { label: "Developers", value: String(developerCount) },
              ...(priceFrom ? [{ label: "Starting from", value: priceFrom }] : []),
            ].map((f) => (
              <div key={f.label}>
                <dt className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#d6b357] mb-1.5">
                  {f.label}
                </dt>
                <dd
                  className="font-['Outfit'] text-2xl font-bold text-white leading-none"
                  style={{ textShadow: "0 1px 10px rgba(0,10,30,0.5)" }}
                >
                  {f.value}
                </dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="relative h-[3px] bg-[#d6b357]" />
      </section>

      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-12">
        {shown.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
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
      <JsonLd schema={breadcrumbList([{ name: "Home", path: "/" }, { name: seo.h1 }])} />
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
            Why invest in {seo.label}
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
