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
import { ProjectCard, type ProjectCardData } from "@/components/project-card"
import { ProjectFilters } from "@/components/public/project-filters"
import { Building2 } from "lucide-react"
import { Suspense } from "react"

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
}

type SearchParams = Promise<SpValues>

function parsePage(raw: string | undefined): number {
  const n = Number.parseInt(raw ?? "1", 10)
  return Number.isInteger(n) && n >= 1 ? n : 1
}

/** The filters pagination links carry forward — a whitelist, so arbitrary or
 *  array-valued query params can never propagate into crawlable hrefs. */
const FILTER_KEYS = ["q", "developer", "status", "city", "featured", "price_min", "price_max"] as const

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

export async function generateMetadata({ searchParams }: { searchParams: SearchParams }): Promise<Metadata> {
  const { page } = await searchParams
  const pageNum = parsePage(page)
  // Self-canonical per page: canonicalizing everything to page 1 would orphan
  // every project card beyond the first 24 from the crawl graph.
  return createPageMetadata({
    title: pageNum > 1 ? `Real Estate Projects in Dubai — Page ${pageNum}` : "Real Estate Projects in Dubai",
    description: "Browse premium off-plan and ready residential projects from top Dubai developers.",
    pathname: pageNum > 1 ? `/projects?page=${pageNum}` : "/projects",
    keywords: ["Dubai projects", "off-plan properties Dubai", "ready properties UAE", "Dubai investment properties"],
  })
}

// Filter facets change rarely; the route itself stays dynamic (searchParams),
// so cache them at the data layer like lib/data/home.ts does.
const getProjectFacets = unstable_cache(
  async () => {
    const supabase = createPublicSupabaseClient()
    const [{ data: devOptions }, { data: cityOptions }] = await Promise.all([
      supabase.from("developers").select("id, name").eq("is_active", true).order("name"),
      supabase.from("projects").select("city").eq("is_active", true).not("city", "is", null),
    ])
    const uniqueCities = Array.from(new Set((cityOptions ?? []).map((r) => r.city).filter(Boolean))) as string[]
    return { devOptions: devOptions ?? [], uniqueCities }
  },
  ["projects-facets"],
  { revalidate: 120, tags: ["projects"] },
)

export default async function ProjectsPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams
  const { q, developer, status, city, featured, price_min, price_max } = sp
  const pageNum = parsePage(sp.page)
  const supabase = createPublicSupabaseClient()

  const priceMin = price_min ? Number(price_min) : null
  const priceMax = price_max ? Number(price_max) : null
  const hasPriceMin = Number.isFinite(priceMin)
  const hasPriceMax = Number.isFinite(priceMax)

  const { devOptions, uniqueCities } = await getProjectFacets()

  // Fetch one page of projects (+ the exact total for the pager).
  let query = supabase
    .from("projects")
    .select(
      "id, name, slug, main_image, location, city, launch_price_from, launch_price_to, currency, status, is_featured, developers(name, logo_url, slug)",
      { count: "exact" },
    )
    .eq("is_active", true)
    .eq("is_published", true)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })

  if (featured === "true") query = query.eq("is_featured", true)
  if (q) query = (query as any).ilike("name", `%${q}%`)
  if (developer) query = query.eq("developer_id", developer)
  if (status) query = query.eq("status", status)
  if (city) query = query.eq("city", city)
  if (hasPriceMin && priceMin !== null) query = query.gte("launch_price_from", priceMin)
  if (hasPriceMax && priceMax !== null) query = query.lte("launch_price_from", priceMax)

  const from = (pageNum - 1) * PAGE_SIZE
  const { data: projects, count, error } = await query.range(from, from + PAGE_SIZE - 1)

  // Transient failure → 5xx; a query error must not read as "empty page"
  // and 404 the archive (ISR would cache it).
  if (error) throw new Error("Failed to load projects")

  const total = count ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  // Out-of-range pages 404 rather than serving an empty shell that indexes.
  if (pageNum > 1 && (projects ?? []).length === 0) notFound()

  return (
    <div className="relative min-h-screen bg-[#fafafa] font-sans overflow-x-hidden">
      <JsonLd schema={breadcrumbList([{ name: "Home", path: "/" }, { name: "Projects" }])} />
      <div className="fixed top-[-10%] left-[-10%] w-[600px] h-[600px] rounded-full opacity-25 blur-[120px] -z-10 bg-[radial-gradient(circle,rgb(200,245,255)_0%,rgba(255,255,255,0)_70%)]" />
      <div className="fixed bottom-0 right-[-5%] w-[500px] h-[500px] rounded-full opacity-20 blur-[120px] -z-10 bg-[radial-gradient(circle,rgb(250,240,210)_0%,rgba(255,255,255,0)_70%)]" />

      <TopBar />
      <Header />

      {/* Page Hero */}
      <section className="relative pt-16 pb-16 overflow-hidden">
        {/* Background */}
        <div className="absolute inset-0">
          <Image
            src="/background/dubai.webp"
            alt=""
            fill
            sizes="100vw"
            className="object-cover object-center"
            aria-hidden="true"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#001f3f]/85 via-[#001f3f]/55 to-[#001f3f]/25" />
        </div>
        <div
          className="absolute inset-0 opacity-[0.05]"
          style={{ backgroundImage: "radial-gradient(circle, #fff 1px, transparent 1px)", backgroundSize: "28px 28px" }}
        />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#0a2647]/80 border border-white/20 text-[11px] font-bold uppercase tracking-[0.14em] text-white mb-6 backdrop-blur-sm">
            <Building2 className="w-3.5 h-3.5 text-[#d6b357]" />
            {featured === "true" ? "Featured Projects" : "All Projects"}
          </div>
          <h1 className="font-['Outfit'] text-5xl md:text-[64px] font-bold text-white leading-[1.05] tracking-tight mb-4" style={{ textShadow: "0 2px 24px rgba(0,10,30,0.55)" }}>
            Discover Premium<br />
            <span className="text-[#d6b357]">Property Projects</span>
          </h1>
          <p className="text-white/85 text-lg max-w-xl" style={{ textShadow: "0 1px 10px rgba(0,10,30,0.6)" }}>
            Browse off-plan and ready properties from Dubai&apos;s most trusted developers.
          </p>
        </div>
      </section>

      {/* Content */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Filters */}
        <Suspense>
          <ProjectFilters
            developers={(devOptions ?? []).map((d) => ({ value: d.id, label: d.name }))}
            cities={uniqueCities.map((c) => ({ value: c, label: c }))}
          />
        </Suspense>

        {/* Count */}
        <div className="flex items-center gap-3 mt-6 mb-6">
          <span className="w-2 h-2 rounded-full bg-[#d6b357]" aria-hidden="true" />
          <span className="text-[15px] font-bold text-[#0d1117]">{total}</span>
          <span className="text-[15px] text-[#6b7280]">
            project{total !== 1 ? "s" : ""} found
            {totalPages > 1 ? ` · page ${pageNum} of ${totalPages}` : ""}
          </span>
        </div>

        {projects && projects.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {projects.map((p) => (
              <ProjectCard key={p.id} project={p as unknown as ProjectCardData} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-28 text-center">
            <div className="w-20 h-20 bg-[#001f3f]/5 border border-[#e5e8ec] flex items-center justify-center mb-5">
              <Building2 className="w-9 h-9 text-[#001f3f]/30" />
            </div>
            <h3 className="font-['Outfit'] font-bold text-[#0d1117] text-xl mb-2">No projects found</h3>
            <p className="text-sm text-[#6b7280] max-w-xs">Try adjusting your filters or explore all available listings.</p>
          </div>
        )}

        {/* Pagination — real <a> links so every card page stays in the crawl
            graph (this catalog used to render all ~185 cards in one 1.9 MB
            document). Numbers are windowed around the current page. */}
        {totalPages > 1 && (
          <nav aria-label="Pagination" className="mt-10 flex flex-wrap items-center justify-center gap-2">
            {pageNum > 1 && (
              <Link
                href={pageHref(sp, pageNum - 1)}
                className="px-4 py-2 border border-[#e5e8ec] bg-white text-sm font-semibold text-[#001f3f] hover:border-[#d6b357] transition-colors"
              >
                Previous
              </Link>
            )}
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter((n) => n === 1 || n === totalPages || Math.abs(n - pageNum) <= 2)
              .map((n, idx, arr) => (
                <span key={n} className="flex items-center gap-2">
                  {idx > 0 && arr[idx - 1] !== n - 1 && <span className="text-[#9ca3af]">…</span>}
                  {n === pageNum ? (
                    <span aria-current="page" className="px-4 py-2 bg-[#001f3f] text-sm font-bold text-white">
                      {n}
                    </span>
                  ) : (
                    <Link
                      href={pageHref(sp, n)}
                      className="px-4 py-2 border border-[#e5e8ec] bg-white text-sm font-semibold text-[#001f3f] hover:border-[#d6b357] transition-colors"
                    >
                      {n}
                    </Link>
                  )}
                </span>
              ))}
            {pageNum < totalPages && (
              <Link
                href={pageHref(sp, pageNum + 1)}
                className="px-4 py-2 border border-[#e5e8ec] bg-white text-sm font-semibold text-[#001f3f] hover:border-[#d6b357] transition-colors"
              >
                Next
              </Link>
            )}
          </nav>
        )}
      </section>

      <Footer />
    </div>
  )
}
