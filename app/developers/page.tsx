import type { Metadata } from "next"
import Image from "next/image"
import { createClient } from "@/lib/supabase/server"
import { createPageMetadata } from "@/lib/seo"
import { TopBar } from "@/components/topbar"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { DeveloperCard, type DeveloperCardData } from "@/components/developer-card"
import { DeveloperSearch } from "./developer-search"
import { Building2, BadgeCheck, Users } from "lucide-react"

export const dynamic = "force-dynamic"

export const metadata: Metadata = createPageMetadata({
  title: "Real Estate Developers in Dubai | FHI Global",
  description: "Browse top real estate developers in Dubai. Discover verified developers and their premium property projects.",
  pathname: "/developers",
  keywords: ["Dubai developers", "real estate developers Dubai", "verified developers UAE"],
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

  const verifiedCount = (developers ?? []).filter((d) => d.is_verified).length

  return (
    <div className="relative min-h-screen bg-[#f6f7f9] font-sans overflow-x-hidden">
      {/* Ambient blobs */}
      <div className="fixed top-[-10%] left-[-10%] w-[600px] h-[600px] rounded-full opacity-25 blur-[130px] -z-10 bg-[radial-gradient(circle,rgb(200,235,255)_0%,rgba(255,255,255,0)_70%)]" />
      <div className="fixed bottom-0 right-[-5%] w-[500px] h-[500px] rounded-full opacity-20 blur-[120px] -z-10 bg-[radial-gradient(circle,rgb(250,240,210)_0%,rgba(255,255,255,0)_70%)]" />

      <TopBar />
      <Header />

      {/* ─── Page Hero ─── */}
      <section className="relative pt-20 pb-20 overflow-hidden">
        <div className="absolute inset-0">
          <Image
            src="https://hefwmaoborpfuyhbguzv.supabase.co/storage/v1/object/public/Dubai%20Image%20Ratio%201920x1080/4.png"
            alt=""
            fill
            sizes="100vw"
            className="object-cover object-center"
            aria-hidden="true"
          />
          <div className="absolute inset-0 bg-gradient-to-br from-[#001428]/94 via-[#001f3f]/90 to-[#002c58]/94" />
        </div>
        {/* dot grid */}
        <div
          className="absolute inset-0 opacity-[0.045]"
          style={{ backgroundImage: "radial-gradient(circle, #fff 1px, transparent 1px)", backgroundSize: "28px 28px" }}
        />
        {/* gold glow blob */}
        <div className="absolute top-[-80px] right-[-60px] w-[500px] h-[500px] rounded-full opacity-15 blur-[120px] bg-[radial-gradient(circle,#d6b357,transparent)] pointer-events-none" />
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#d6b357]/30 to-transparent" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-8">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/10 border border-white/20 rounded-full text-xs font-medium text-white/80 mb-5 backdrop-blur-sm">
                <Building2 className="w-3.5 h-3.5 text-[#d6b357]" />
                Trusted Developers
              </div>
              <h1
                className="font-['Outfit'] text-4xl md:text-6xl font-bold text-white leading-[1.1] mb-4 tracking-tight"
                style={{ textShadow: "0 2px 24px rgba(0,0,0,0.35)" }}
              >
                Dubai&apos;s Top<br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#d6b357] to-[#f0d890]">
                  Real Estate Developers
                </span>
              </h1>
              <p className="text-white/50 text-lg max-w-lg leading-relaxed">
                Explore verified developers behind Dubai&apos;s most iconic residential
                and commercial projects — vetted, RERA-registered, and trusted.
              </p>
            </div>

            {/* Quick stats */}
            <div className="flex gap-4 shrink-0">
              <div className="bg-white/8 backdrop-blur-xl border border-white/12 rounded-2xl px-5 py-4 text-center min-w-[100px]">
                <p className="font-['Outfit'] text-3xl font-bold text-white">{developers?.length ?? 0}</p>
                <p className="text-xs text-white/50 mt-0.5 uppercase tracking-wider">Total</p>
              </div>
              <div className="bg-[#d6b357]/12 backdrop-blur-xl border border-[#d6b357]/25 rounded-2xl px-5 py-4 text-center min-w-[100px]">
                <p className="font-['Outfit'] text-3xl font-bold text-[#d6b357]">{verifiedCount}</p>
                <p className="text-xs text-[#d6b357]/70 mt-0.5 uppercase tracking-wider">Verified</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Content ─── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">

        {/* Search + count row */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-10">
          <div className="flex-1">
            <DeveloperSearch initialQ={q ?? ""} />
          </div>
          {/* Count badge */}
          <div className="shrink-0 inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-[#e8eaed] rounded-full shadow-sm self-start sm:self-auto">
            <Users className="w-3.5 h-3.5 text-[#d6b357]" />
            <span className="text-sm font-semibold text-[#0d1117]">{developers?.length ?? 0}</span>
            <span className="text-sm text-[#6b7280]">
              developer{(developers?.length ?? 0) !== 1 ? "s" : ""}
              {q ? <> matching <span className="font-medium text-[#001f3f]">&ldquo;{q}&rdquo;</span></> : ""}
            </span>
          </div>
        </div>

        {/* Verified filter hint */}
        {!q && verifiedCount > 0 && (
          <div className="flex items-center gap-2 mb-8 text-xs text-[#6b7280]">
            <BadgeCheck className="w-3.5 h-3.5 text-[#d6b357]" />
            <span>{verifiedCount} verified developer{verifiedCount !== 1 ? "s" : ""} on this platform</span>
          </div>
        )}

        {developers && developers.length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {developers.map((dev) => (
              <DeveloperCard key={dev.id} developer={dev as DeveloperCardData} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-32 text-center">
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-[#001f3f]/6 to-[#d6b357]/6 border border-[#e8eaed] flex items-center justify-center mb-6 shadow-sm">
              <Building2 className="w-9 h-9 text-[#001f3f]/25" />
            </div>
            <h3 className="font-['Outfit'] font-bold text-[#0d1117] text-xl mb-2">No developers found</h3>
            <p className="text-sm text-[#6b7280] max-w-xs leading-relaxed">
              Try adjusting your search or{" "}
              <a href="/developers" className="text-[#001f3f] font-medium hover:underline">browse all developers</a>.
            </p>
          </div>
        )}
      </section>

      <Footer />
    </div>
  )
}
