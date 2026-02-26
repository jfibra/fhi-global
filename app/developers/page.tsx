import type { Metadata } from "next"
import { createClient } from "@/lib/supabase/server"
import { createPageMetadata } from "@/lib/seo"
import { TopBar } from "@/components/topbar"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { DeveloperCard, type DeveloperCardData } from "@/components/developer-card"
import { DeveloperSearch } from "./developer-search"
import { Building2 } from "lucide-react"

export const dynamic = "force-dynamic"

export const metadata: Metadata = createPageMetadata({
  title: "Real Estate Developers in Dubai | FHI Global",
  description: "Browse top real estate developers in Dubai. Discover verified developers and their premium property projects.",
})

type SearchParams = Promise<{ q?: string }>

export default async function DevelopersPage({ searchParams }: { searchParams: SearchParams }) {
  const { q } = await searchParams
  const supabase = await createClient()

  let query = supabase
    .from("developers")
    .select("id, name, slug, description, logo_url, rating, is_verified")
    .eq("is_active", true)
    .is("deleted_at", null)
    .order("name")

  if (q) {
    query = query.ilike("name", `%${q}%`)
  }

  const { data: developers } = await query

  return (
    <div className="relative min-h-screen bg-[#fafafa] font-sans overflow-x-hidden">
      {/* Ambient blobs */}
      <div className="fixed top-[-10%] left-[-10%] w-[600px] h-[600px] rounded-full opacity-30 blur-[120px] -z-10 bg-[radial-gradient(circle,rgb(200,245,255)_0%,rgba(255,255,255,0)_70%)]" />
      <div className="fixed bottom-0 right-[-5%] w-[500px] h-[500px] rounded-full opacity-20 blur-[120px] -z-10 bg-[radial-gradient(circle,rgb(250,240,210)_0%,rgba(255,255,255,0)_70%)]" />

      <TopBar />
      <Header />

      {/* Page Hero */}
      <section className="relative pt-16 pb-16 overflow-hidden">
        {/* Background */}
        <div className="absolute inset-0">
          <img
            src="https://hefwmaoborpfuyhbguzv.supabase.co/storage/v1/object/public/Dubai%20Image%20Ratio%201920x1080/4.png"
            alt=""
            className="w-full h-full object-cover object-center"
            aria-hidden="true"
          />
          <div className="absolute inset-0 bg-gradient-to-br from-[#001f3f]/88 via-[#002a52]/85 to-[#001428]/92" />
        </div>
        <div
          className="absolute inset-0 opacity-[0.05]"
          style={{ backgroundImage: "radial-gradient(circle, #fff 1px, transparent 1px)", backgroundSize: "28px 28px" }}
        />
        <div className="absolute top-[-60px] left-[-60px] w-[400px] h-[400px] rounded-full opacity-20 blur-[100px] bg-[radial-gradient(circle,#d6b357,transparent)]" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/10 border border-white/20 rounded-full text-xs font-medium text-white/80 mb-5 backdrop-blur-sm">
            <Building2 className="w-3.5 h-3.5 text-[#d6b357]" />
            Trusted Developers
          </div>
          <h1 className="font-['Space_Grotesk'] text-4xl md:text-5xl font-bold text-white leading-tight mb-3" style={{ textShadow: "0 2px 20px rgba(0,0,0,0.4)" }}>
            Dubai&apos;s Top Real Estate<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#d6b357] to-[#f0d890]">Developers</span>
          </h1>
          <p className="text-white/55 text-lg max-w-xl">
            Explore verified developers behind Dubai&apos;s most iconic residential and commercial projects.
          </p>
        </div>
      </section>

      {/* Content */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Search */}
        <DeveloperSearch initialQ={q ?? ""} />

        {/* Count */}
        <div className="flex items-center gap-3 mb-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-[#e8eaed] rounded-full shadow-sm">
            <span className="w-2 h-2 rounded-full bg-[#d6b357]" />
            <span className="text-sm font-semibold text-[#0d1117]">{developers?.length ?? 0}</span>
            <span className="text-sm text-[#6b7280]">developer{(developers?.length ?? 0) !== 1 ? "s" : ""}{q ? ` matching "${q}"` : ""}</span>
          </div>
        </div>

        {developers && developers.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {developers.map((dev) => (
              <DeveloperCard key={dev.id} developer={dev as DeveloperCardData} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-28 text-center">
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-[#001f3f]/6 to-[#d6b357]/6 border border-[#e8eaed] flex items-center justify-center mb-5 shadow-sm">
              <Building2 className="w-9 h-9 text-[#001f3f]/30" />
            </div>
            <h3 className="font-['Space_Grotesk'] font-bold text-[#0d1117] text-xl mb-2">No developers found</h3>
            <p className="text-sm text-[#6b7280] max-w-xs">Try adjusting your search criteria or browse all developers.</p>
          </div>
        )}
      </section>

      <Footer />
    </div>
  )
}
