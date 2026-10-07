import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import { notFound } from "next/navigation"
import { unstable_cache } from "next/cache"
import { createPublicSupabaseClient } from "@/lib/supabase/public"
import { createPageMetadata } from "@/lib/seo"
import { breadcrumbList } from "@/lib/structured-data"
import { JsonLd } from "@/components/json-ld"
import { TopBar } from "@/components/topbar"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { ProjectCard, formatProjectPrice, type ProjectCardData } from "@/components/project-card"
import { ProjectsMap, type MapProject } from "@/components/public/projects-map"
import { ProjectFilters, type QuickPick } from "@/components/public/project-filters"
import { InView } from "@/components/public/in-view"
import { Pager } from "@/components/public/pager"
import { CountUp } from "@/components/public/count-up"
import { MagneticLink } from "@/components/public/magnetic-link"
import { countByEmirate } from "@/lib/emirates"
import { handoverDisplay } from "@/lib/project-seo"
import { normalizeCommunity } from "@/lib/communities"
import { ArrowUpRight, Building2 } from "lucide-react"
import { Suspense, Fragment } from "react"

// The full catalog rendered on one page shipped ~1.9 MB of HTML (half of it
// RSC flight data duplicating the markup). 24 cards keeps the document a
// crawlable, parseable size; the rest is reachable through real <a> links.
const PAGE_SIZE = 24

type SpValues = {
  q?: string
  developer?: string
  status?: string
  city?: string
  featured?: string
  price_min?: string
  price_max?: string
  page?: string
  /** "map" opens the Bayut-style map view. */
  view?: string
}

type SearchParams = Promise<SpValues>

function parsePage(raw: string | undefined): number {
  const n = Number.parseInt(raw ?? "1", 10)
  return Number.isInteger(n) && n >= 1 ? n : 1
}

/** Every param as a single string: a repeated param (?city=a&city=b) arrives as an array, which the queries below must never see. */
function normalizeSearchParams(raw: Record<string, string | string[] | undefined>): SpValues {
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)
  return {
    q: one(raw.q),
    // Lower-cased: ?developer=ABC… and ?developer=abc… are one view, not two self-canonical duplicates.
    developer: one(raw.developer)?.toLowerCase(),
    status: one(raw.status),
    city: one(raw.city),
    featured: one(raw.featured),
    price_min: one(raw.price_min),
    price_max: one(raw.price_max),
    page: one(raw.page),
    view: one(raw.view),
  }
}

/** The filters pagination links carry forward — a whitelist, so arbitrary or
 *  array-valued query params can never propagate into crawlable hrefs. */
const FILTER_KEYS = ["q", "developer", "status", "city", "featured", "price_min", "price_max"] as const

// Plain 8-4-4-4-12 hex: the shape that keeps Postgres from throwing on the cast. Whether the id exists is
// decided by membership in the facet list, which is the real gate.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** True when any whitelisted filter is set (page and view are not filters). */
function hasFilters(sp: SpValues): boolean {
  return FILTER_KEYS.some((k) => typeof sp[k] === "string" && sp[k] !== "")
}

/** Pagination href that keeps every active filter and drops page=1. */
function pageHref(sp: SpValues, page: number): string {
  const p = new URLSearchParams()
  for (const k of FILTER_KEYS) {
    const v = sp[k]
    if (typeof v === "string" && v) p.set(k, v)
  }
  if (page > 1) p.set("page", String(page))
  const qs = p.toString()
  return qs ? `/projects?${qs}` : "/projects"
}

/** This exact view's own path: the filters, the page number and the map flag. */
function selfHref(sp: SpValues, page: number): string {
  const base = pageHref(sp, page)
  if (sp.view !== "map") return base
  return base.includes("?") ? `${base}&view=map` : "/projects?view=map"
}

/**
 * A ?developer= value must be an active developer's id. Anything else — not a
 * uuid, or a uuid nobody has — is a URL that cannot show a catalogue, so it is
 * a real 404 instead of a Postgres "invalid input syntax for type uuid" that
 * surfaced as a 500 (and let crawlers mint endless junk URLs).
 */
async function assertKnownDeveloper(developer: string | undefined) {
  if (developer === undefined || developer === "") return
  if (!UUID_RE.test(developer)) notFound()
  // The cached facet list is only read when a developer is actually asked for.
  const { devOptions } = await getProjectFacets()
  if (!devOptions.some((d) => String(d.id).toLowerCase() === developer)) notFound()
}

export async function generateMetadata({ searchParams }: { searchParams: SearchParams }): Promise<Metadata> {
  const sp = normalizeSearchParams(await searchParams)
  const pageNum = parsePage(sp.page)
  await assertKnownDeveloper(sp.developer)
  const map = sp.view === "map"
  // The unfiltered catalogue is the one indexable view (its pages 2, 3… are
  // self-canonical so every card stays reachable). Every filtered or map view is
  // another way of looking at the same rows: kept out of the index (links are
  // still followed) and canonical to ITSELF — a noindex page that canonicalises
  // somewhere else sends two opposing signals, and a canonical that drops the
  // filters points Google at a page whose content differs.
  const keepOut = map || hasFilters(sp)
  return createPageMetadata({
    title: map
      ? "Real Estate Projects in Dubai on the Map"
      : pageNum > 1
        ? `Real Estate Projects in Dubai — Page ${pageNum}`
        : "Real Estate Projects in Dubai",
    description: map
      ? "Browse premium off-plan and ready residential projects from top Dubai developers on the map."
      : "Browse premium off-plan and ready residential projects from top Dubai developers.",
    pathname: selfHref(sp, pageNum),
    robots: keepOut ? { index: false, follow: true } : undefined,
    keywords: map ? undefined : ["Dubai projects", "off-plan properties Dubai", "ready properties UAE", "Dubai investment properties"],
  })
}

// Filter facets change rarely; the route itself stays dynamic (searchParams),
// so cache them at the data layer like lib/data/home.ts does.
const getProjectFacets = unstable_cache(
  async () => {
    const supabase = createPublicSupabaseClient()
    const [{ data: devOptions, error: devError }, { data: cityOptions, error: cityError }, { data: live, error: liveError }] = await Promise.all([
      supabase.from("developers").select("id, name").eq("is_active", true).is("deleted_at", null).order("name"),
      supabase.from("projects").select("city").eq("is_active", true).eq("is_published", true).is("deleted_at", null).not("city", "is", null),
      // The published catalogue, for the masthead counters and the quick
      // picks' live counts. Same rows the grid draws from.
      supabase
        .from("projects")
        .select("city, developer_id, status, launch_price_from, is_featured")
        .eq("is_active", true)
        .eq("is_published", true)
        .is("deleted_at", null)
        .limit(4000),
    ])
    // THROW rather than cache a partial answer: unstable_cache never stores a throw, so one Supabase blip can no
    // longer pin an empty developer list for 120 s — which assertKnownDeveloper would read as "every
    // ?developer= link is unknown" and 404 them all. (A failure here is a 5xx; crawlers retry a 5xx.)
    if (devError || cityError || liveError) throw new Error("Failed to load project facets")
    const uniqueCities = Array.from(new Set((cityOptions ?? []).map((r) => r.city).filter(Boolean))) as string[]
    const rows = (live ?? []) as { city: string | null; developer_id: string | null; status: string; launch_price_from: number | string | null; is_featured: boolean | null }[]
    const stats = {
      total: rows.length,
      developers: new Set(rows.map((r) => r.developer_id).filter(Boolean)).size,
      emirates: Object.keys(countByEmirate(rows)).length,
      ready: rows.filter((r) => r.status === "completed").length,
      underMillion: rows.filter((r) => r.launch_price_from != null && Number(r.launch_price_from) > 0 && Number(r.launch_price_from) <= 1_000_000).length,
      featured: rows.filter((r) => r.is_featured).length,
    }
    return { devOptions: devOptions ?? [], uniqueCities, stats }
  },
  ["projects-facets-v2"],
  { revalidate: 120, tags: ["projects"] },
)

// The columns the list cards and the map pins read — the same rows either way.
const LIST_COLUMNS =
  "id, name, slug, main_image, location, city, community, delivery_quarter, launch_price_from, launch_price_to, currency, status, is_featured, developers(name, logo_url, slug)"
const MAP_COLUMNS =
  "id, name, slug, main_image, location, city, community, delivery_quarter, launch_price_from, currency, status, latitude, longitude, developers(name, slug, logo_url, logo_bg)"

type GridArgs = {
  view: "list" | "map"
  /** Row offset of the page (list view). */
  from: number
  q: string
  developer: string
  status: string
  city: string
  featured: boolean
  priceMin: number | null
  priceMax: number | null
}

/**
 * One page of the published catalogue with the page's filters applied — the
 * grid (a page of cards + the exact total for the pager) or, for the map, every
 * filtered project with its coordinates. Throws on a failed query so an error is
 * never cached or read as "no results".
 */
async function fetchProjectsView(a: GridArgs): Promise<{ rows: unknown[]; count: number; outOfRange: boolean }> {
  const supabase = createPublicSupabaseClient()
  const filtered = (columns: string, count?: "exact") => {
    let query = supabase
      .from("projects")
      .select(columns, count ? { count } : undefined)
      .eq("is_active", true)
      .eq("is_published", true)
      .is("deleted_at", null)
    if (a.featured) query = query.eq("is_featured", true)
    if (a.q) query = query.ilike("name", `%${a.q}%`)
    if (a.developer) query = query.eq("developer_id", a.developer)
    // "off_plan" is the buyer's word, not a database value: everything that
    // has not completed.
    if (a.status === "off_plan") query = query.neq("status", "completed")
    else if (a.status) query = query.eq("status", a.status)
    if (a.city) query = query.eq("city", a.city)
    if (a.priceMin !== null) query = query.gte("launch_price_from", a.priceMin)
    if (a.priceMax !== null) query = query.lte("launch_price_from", a.priceMax)
    return query
  }

  if (a.view === "map") {
    const { data, error } = await filtered(MAP_COLUMNS)
      .order("is_featured", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(1000)
    if (error) throw new Error("Failed to load projects")
    return { rows: (data ?? []) as unknown[], count: (data ?? []).length, outOfRange: false }
  }

  const { data, count, error } = await filtered(LIST_COLUMNS, "exact")
    .order("created_at", { ascending: false })
    .range(a.from, a.from + PAGE_SIZE - 1)
  // A page past the end comes back from PostgREST as PGRST103 ("range not
  // satisfiable"), not as an empty page: that's the 404 below, not a failure.
  const outOfRange = (error as { code?: string } | null)?.code === "PGRST103"
  // Transient failure → 5xx; a query error must not read as "empty page"
  // and 404 the archive (ISR would cache it).
  if (error && !outOfRange) throw new Error("Failed to load projects")
  return { rows: outOfRange ? [] : ((data ?? []) as unknown[]), count: count ?? 0, outOfRange }
}

// Cached at the data layer for 2 minutes (the route itself stays dynamic — it
// reads searchParams — so `export const revalidate` cannot do this), keyed by
// the arguments, i.e. by filters + page. Only a WHITELIST is cached (below): free-text
// search, price bounds, deep pages and values that are not real cities/statuses take the
// live query, so a crawler cannot mint an unbounded number of cache entries. The "projects"
// tag is the one the facets use, and publishing a project drops it (/api/seo/revalidate and
// the developer company route call revalidateTag("projects", { expire: 0 })).
const fetchProjectsViewCached = unstable_cache(fetchProjectsView, ["projects-view-v1"], {
  revalidate: 120,
  tags: ["projects"],
})

/** Deepest page whose result is cached — beyond it a visitor (or a bot) is off the beaten path. */
const MAX_CACHED_PAGE = 20
const KNOWN_STATUSES = new Set(["off_plan", "pre_launch", "launch", "under_construction", "completed"])

export default async function ProjectsPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = normalizeSearchParams(await searchParams)
  const { q, developer, status, city, featured, price_min, price_max } = sp
  const pageNum = parsePage(sp.page)

  const priceMin = price_min ? Number(price_min) : null
  const priceMax = price_max ? Number(price_max) : null
  const hasPriceMin = Number.isFinite(priceMin)
  const hasPriceMax = Number.isFinite(priceMax)

  const { devOptions, uniqueCities, stats } = await getProjectFacets()
  await assertKnownDeveloper(developer)
  const view = sp.view === "map" ? "map" : "list"

  const from = (pageNum - 1) * PAGE_SIZE
  const args: GridArgs = {
    view,
    // The map ignores the page, so ?view=map&page=N must not mint a cache key per N.
    from: view === "map" ? 0 : from,
    q: q ?? "",
    developer: developer ?? "",
    status: status ?? "",
    city: city ?? "",
    featured: featured === "true",
    priceMin: hasPriceMin ? priceMin : null,
    priceMax: hasPriceMax ? priceMax : null,
  }
  const cacheable =
    !args.q &&
    args.priceMin === null &&
    args.priceMax === null &&
    pageNum <= MAX_CACHED_PAGE &&
    (!args.city || uniqueCities.includes(args.city)) &&
    (!args.status || KNOWN_STATUSES.has(args.status))
  const result = await (cacheable ? fetchProjectsViewCached : fetchProjectsView)(args)
  const { outOfRange } = result

  const projects = view === "list" ? result.rows : []
  const mapResult = { data: view === "map" ? result.rows : [] }
  const count = result.count
  const gridProjects = (projects ?? []) as unknown as ProjectCardData[]
  const mapRows = (mapResult.data ?? []) as unknown as MapRow[]
  const mapProjects = mapRows.map(toMapProject).filter((m): m is MapProject => m !== null)
  const total = view === "map" ? mapRows.length : count ?? 0
  const totalPages = view === "map" ? 1 : Math.max(1, Math.ceil(total / PAGE_SIZE))
  const mapsKey = process.env.GOOGLE_MAPS_API_KEY?.trim() || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() || ""
  const anyFilter = Boolean(q || developer || status || city || featured === "true" || hasPriceMin || hasPriceMax)
  const pick = (label: string, count: number, params: Record<string, string>): QuickPick => ({ label, count, params })
  const picks: QuickPick[] = [
    pick("Ready to move in", stats.ready, { status: "completed" }),
    pick("Under AED 1M", stats.underMillion, { price_max: "1000000" }),
    pick("Featured", stats.featured, { featured: "true" }),
  ].filter((p) => p.count > 0)
  const headline = featured === "true" ? "Featured Projects" : status === "completed" ? "Ready-to-Move Homes" : status === "off_plan" ? "Off-Plan Projects" : "Property Projects"
  // Out-of-range pages 404 rather than serving an empty shell that indexes.
  if (view === "list" && pageNum > 1 && (outOfRange || gridProjects.length === 0)) notFound()

  return (
    <div className="pl wf relative min-h-screen bg-[#fafafa] font-sans overflow-x-clip">
      <noscript>
        <style>{`.pl [class*="wf-"], .pl .wf-word > span, .pl .pl-card { opacity: 1 !important; transform: none !important; clip-path: none !important; filter: none !important; }`}</style>
      </noscript>
      <JsonLd schema={breadcrumbList([{ name: "Home", path: "/" }, { name: "Projects" }])} />
      <TopBar />
      <Header />
      <main>

      {/* Masthead — short, because the visitor came for the grid, but with
          the site's entrance: the rule draws, the title rises word by word,
          and the catalogue's real counts count up beside it. The map view
          skips it: the map wants the height. */}
      {view === "map" && <h1 className="sr-only">Property projects on the map</h1>}
      {view === "list" && (
      <section className="relative overflow-hidden bg-[#06182e] text-white">
        <div className="absolute inset-0" aria-hidden="true">
          <Image src="/background/dubai.webp" alt="" fill preload fetchPriority="high" sizes="100vw" className="object-cover object-center" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#06182e]/95 via-[#06182e]/70 to-[#06182e]/30" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#06182e]/80 via-transparent to-transparent" />
        </div>
        <InView className="relative mx-auto max-w-7xl px-4 pb-8 pt-9 sm:px-6 lg:px-8 lg:pb-10 lg:pt-12" threshold={0.2} rootMargin="0px">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="inline-flex items-center gap-3 text-[11px] font-bold uppercase tracking-[0.3em] text-[#f0d89b]">
                <span className="wf-rule h-px w-10 bg-[#d6b357]" aria-hidden="true" />
                <span className="wf-fade" style={{ ["--d" as string]: "200ms" }}>FHI Global · {anyFilter ? "Filtered" : "All projects"}</span>
              </p>
              <h1 className="mt-3 font-['Outfit'] text-[34px] font-bold leading-[1.06] tracking-tight drop-shadow-[0_2px_16px_rgba(0,10,30,0.5)] sm:text-[44px] lg:text-[52px]">
                <span className="wf-word"><span style={{ ["--i" as string]: 0 }}>Discover</span></span>{" "}
                <span className="wf-word"><span style={{ ["--i" as string]: 1 }}>Premium</span></span>{" "}
                {headline.split(" ").map((w, i) => (
                  <Fragment key={`${w}-${i}`}><span className="wf-word"><span style={{ ["--i" as string]: 2 + i }} className="wf-gold">{w}</span></span>{" "}</Fragment>
                ))}
              </h1>
            </div>
            <dl className="wf-fade flex flex-wrap gap-x-8 gap-y-3 lg:pb-1" style={{ ["--d" as string]: "700ms" }}>
              {[
                { value: stats.total, label: "Live projects" },
                { value: stats.developers, label: "Developers" },
                { value: stats.emirates, label: "Emirates" },
              ].filter((st) => st.value > 0).map((st, i) => (
                <div key={st.label}>
                  <dd className="font-['Outfit'] text-[30px] font-bold leading-none text-white">
                    <CountUp value={st.value} delay={800 + i * 120} duration={1200} />
                  </dd>
                  <dt className="mt-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-[#d6b357]">{st.label}</dt>
                </div>
              ))}
            </dl>
          </div>
        </InView>
        <div className="relative h-[3px] bg-[#d6b357]" />
      </section>
      )}

      {/* Filter bar — sticks under the slim header on wide screens */}
      <Suspense fallback={<div className="h-[371px] sm:h-[296px] lg:h-[148px] xl:h-[110px]" aria-hidden="true" />}>
        <ProjectFilters
          developers={(devOptions ?? []).map((d) => ({ value: d.id, label: d.name }))}
          cities={uniqueCities.map((c) => ({ value: c, label: c }))}
          total={total}
          page={pageNum}
          totalPages={totalPages}
          picks={picks}
          view={view}
        />
      </Suspense>

      {view === "map" ? (
        <ProjectsMap apiKey={mapsKey} projects={mapProjects} />
      ) : (
      /* Content */
      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {gridProjects.length > 0 ? (
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {gridProjects.map((p, i) => (
              <InView key={p.id} className="pl-card" threshold={0.12} style={{ ["--d" as string]: `${(i % 4) * 90}ms` }}>
                <ProjectCard project={p} />
              </InView>
            ))}
          </div>
        ) : (
          <InView className="wf border border-[#e5e8ec] bg-white px-6 py-16 text-center sm:px-14" threshold={0.2}>
            <span className="wf-fade mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-[#d6b357]/50 bg-[#d6b357]/10">
              <Building2 className="h-6 w-6 text-[#b8913f]" />
            </span>
            <h3 className="wf-fade mt-5 font-['Outfit'] text-2xl font-bold text-[#0d1117]" style={{ ["--d" as string]: "120ms" }}>No projects match those filters</h3>
            <p className="wf-fade mx-auto mt-2 max-w-md text-[15px] leading-relaxed text-[#6b7280]" style={{ ["--d" as string]: "220ms" }}>
              Loosen one filter, or tell a consultant what you are after and we will look beyond what is published.
            </p>
            <div className="wf-fade mt-7 flex flex-wrap justify-center gap-3" style={{ ["--d" as string]: "320ms" }}>
              <Link href="/projects" className="inline-flex items-center gap-2 border border-[#0d1117]/20 px-6 py-3.5 text-[15px] font-bold text-[#0d1117] transition-colors hover:border-[#d6b357] hover:text-[#b8913f]">
                Clear filters
              </Link>
              <MagneticLink href="/contact" className="inline-flex items-center gap-2 bg-[#0d1117] px-6 py-3.5 text-[15px] font-bold text-white transition-colors hover:bg-[#001f3f]">
                Ask a consultant <ArrowUpRight className="h-4 w-4 text-[#d6b357]" />
              </MagneticLink>
            </div>
          </InView>
        )}

        {/* Pagination — real <a> links so every card page stays in the crawl
            graph (this catalog used to render all ~185 cards in one 1.9 MB
            document). Numbers are windowed around the current page; a gold
            line shows how far through the catalogue the reader is. */}
        {totalPages > 1 && (
          <InView as="div" className="wf mt-12" threshold={0.3}>
            <div className="mx-auto max-w-2xl">
              <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-[0.16em] text-[#6b7280]">
                <span>Page {pageNum} of {totalPages}</span>
                <span>{fmtRange(from, gridProjects.length, total)}</span>
              </div>
              <div className="mt-2 h-[2px] w-full bg-[#e5e8ec]">
                <span className="pl-pager-fill block h-full bg-[#d6b357]" style={{ ["--p" as string]: (pageNum / totalPages).toFixed(3) }} />
              </div>
            </div>
            <Pager page={pageNum} totalPages={totalPages} hrefFor={(n) => pageHref(sp, n)} className="mt-6" />
          </InView>
        )}
      </section>
      )}

      </main>
      <Footer />
    </div>
  )
}

type MapRow = {
  id: string
  name: string
  slug: string
  main_image: string | null
  location: string | null
  city: string | null
  community: string | null
  delivery_quarter: string | null
  launch_price_from: number | string | null
  currency: string | null
  status: string | null
  latitude: number | string | null
  longitude: number | string | null
  developers: { name: string; slug: string | null; logo_url: string | null; logo_bg: string | null } | null
}

/** A map pin for a project, or null without usable coordinates (anything outside the UAE is a data slip, not a pin). */
function toMapProject(p: MapRow): MapProject | null {
  const lat = Number(p.latitude)
  const lng = Number(p.longitude)
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < 22 || lat > 27 || lng < 51 || lng > 57) return null
  const price = p.launch_price_from != null && Number(p.launch_price_from) > 0 ? formatProjectPrice(Number(p.launch_price_from), p.currency ?? "AED") : null
  // Same order as the grid's cards: community, then the free location, then the city.
  const area = [normalizeCommunity(p.community), p.location].map((v) => v?.trim()).find(Boolean) ?? p.city?.trim() ?? null
  const dev = p.developers
  return {
    id: String(p.id),
    name: p.name,
    href: dev?.slug ? `/${dev.slug}/${p.slug}` : `/projects/${p.slug}`,
    image: p.main_image?.trim() || null,
    lat,
    lng,
    price,
    // A quarter that has already ended on a project still being built reads "under review".
    handover: handoverDisplay({ status: p.status, delivery_quarter: p.delivery_quarter }),
    area,
    developer: dev?.name ?? null,
    developerLogo: dev?.logo_url?.trim() || null,
    developerLogoBg: dev?.logo_bg?.trim() || null,
    status: p.status,
  }
}

/** "Showing 25 to 48 of 273". */
function fmtRange(from: number, shown: number, total: number): string {
  if (shown === 0) return ""
  const a = (from + 1).toLocaleString("en-US")
  const b = (from + shown).toLocaleString("en-US")
  return `Showing ${a} to ${b} of ${total.toLocaleString("en-US")}`
}
