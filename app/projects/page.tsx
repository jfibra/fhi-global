import type { Metadata } from "next"
import { createClient } from "@/lib/supabase/server"
import { TopBar } from "@/components/topbar"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { ProjectCard, type ProjectCardData } from "@/components/project-card"
import { ProjectFilters } from "@/components/public/project-filters"
import { Building2 } from "lucide-react"
import { Suspense } from "react"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Real Estate Projects in Dubai | FHI Global",
  description: "Browse premium off-plan and ready residential projects from top Dubai developers.",
  openGraph: {
    title: "Real Estate Projects in Dubai | FHI Global",
    description: "Browse premium off-plan and ready residential projects from top Dubai developers.",
    type: "website",
  },
}

type SearchParams = Promise<{
  q?: string
  developer?: string
  status?: string
  city?: string
  featured?: string
}>

export default async function ProjectsPage({ searchParams }: { searchParams: SearchParams }) {
  const { q, developer, status, city, featured } = await searchParams
  const supabase = await createClient()

  // Fetch filter options
  const [{ data: devOptions }, { data: cityOptions }] = await Promise.all([
    supabase.from("developers").select("id, name").eq("is_active", true).order("name"),
    supabase.from("projects").select("city").eq("is_active", true).not("city", "is", null),
  ])

  const uniqueCities = Array.from(new Set((cityOptions ?? []).map((r) => r.city).filter(Boolean))) as string[]

  // Fetch projects
  let query = supabase
    .from("projects")
    .select("id, name, slug, main_image, location, city, launch_price_from, launch_price_to, currency, status, is_featured, developers(name, logo_url, slug)")
    .eq("is_active", true)
    .eq("is_published", true)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })

  if (featured === "true") query = query.eq("is_featured", true)
  if (q) query = (query as any).ilike("name", `%${q}%`)
  if (developer) query = query.eq("developer_id", developer)
  if (status) query = query.eq("status", status)
  if (city) query = query.eq("city", city)

  const { data: projects } = await query

  return (
    <div className="relative min-h-screen bg-[#fafafa] font-sans overflow-x-hidden">
      <div className="fixed top-[-10%] left-[-10%] w-[600px] h-[600px] rounded-full opacity-25 blur-[120px] -z-10 bg-[radial-gradient(circle,rgb(200,245,255)_0%,rgba(255,255,255,0)_70%)]" />
      <div className="fixed bottom-0 right-[-5%] w-[500px] h-[500px] rounded-full opacity-20 blur-[120px] -z-10 bg-[radial-gradient(circle,rgb(250,240,210)_0%,rgba(255,255,255,0)_70%)]" />

      <TopBar />
      <Header />

      {/* Page Hero */}
      <section className="bg-gradient-to-br from-[#001f3f] via-[#002a52] to-[#001428] pt-16 pb-16 relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-[0.05]"
          style={{ backgroundImage: "radial-gradient(circle, #fff 1px, transparent 1px)", backgroundSize: "28px 28px" }}
        />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/10 border border-white/20 rounded-full text-xs font-medium text-white/80 mb-5 backdrop-blur-sm">
            <Building2 className="w-3.5 h-3.5 text-[#d6b357]" />
            {featured === "true" ? "Featured Projects" : "All Projects"}
          </div>
          <h1 className="font-['Space_Grotesk'] text-4xl md:text-5xl font-bold text-white leading-tight mb-3" style={{ textShadow: "0 2px 20px rgba(0,0,0,0.4)" }}>
            Discover Premium<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#d6b357] to-[#f0d890]">
              Property Projects
            </span>
          </h1>
          <p className="text-white/55 text-lg max-w-xl">
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
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-[#e8eaed] rounded-full shadow-sm">
            <span className="w-2 h-2 rounded-full bg-[#d6b357]" />
            <span className="text-sm font-semibold text-[#0d1117]">{projects?.length ?? 0}</span>
            <span className="text-sm text-[#6b7280]">project{(projects?.length ?? 0) !== 1 ? "s" : ""} found</span>
          </div>
        </div>

        {projects && projects.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {projects.map((p) => (
              <ProjectCard key={p.id} project={p as unknown as ProjectCardData} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-28 text-center">
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-[#001f3f]/6 to-[#d6b357]/6 border border-[#e8eaed] flex items-center justify-center mb-5 shadow-sm">
              <Building2 className="w-9 h-9 text-[#001f3f]/30" />
            </div>
            <h3 className="font-['Space_Grotesk'] font-bold text-[#0d1117] text-xl mb-2">No projects found</h3>
            <p className="text-sm text-[#6b7280] max-w-xs">Try adjusting your filters or explore all available listings.</p>
          </div>
        )}
      </section>

      <Footer />
    </div>
  )
}
