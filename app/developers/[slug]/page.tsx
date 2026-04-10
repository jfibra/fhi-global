import type { Metadata } from "next"
import Image from "next/image"
import { notFound } from "next/navigation"
import Link from "next/link"
import { createPublicSupabaseClient } from "@/lib/supabase/public"
import { createPageMetadata } from "@/lib/seo"
import { TopBar } from "@/components/topbar"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { ProjectCard, type ProjectCardData } from "@/components/project-card"
import { SocialShare } from "@/components/social-share"
import { Building2, Globe, Phone, Mail, MapPin, Star, CheckCircle2, ArrowLeft } from "lucide-react"

export const revalidate = 120

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://fhiglobal.com"
  const supabase = createPublicSupabaseClient()
  const { data } = await supabase
    .from("developers")
    .select("name, description, logo_url, address")
    .eq("slug", slug)
    .is("deleted_at", null)
    .maybeSingle()
  if (!data) return { title: "Developer Not Found" }

  const ogImage = `${siteUrl}/og/developer/${slug}`
  const description = data.description ?? `Explore projects by ${data.name} on FHI Global.`
  const keywords = [data.name, data.address, "Dubai developer", "real estate developer UAE"].filter(Boolean) as string[]

  return createPageMetadata({
    title: `${data.name} | FHI Global Developers`,
    description,
    openGraphTitle: `${data.name} | FHI Global`,
    openGraphDescription: description,
    imageUrl: ogImage || data.logo_url,
    pathname: `/developers/${slug}`,
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
    notFound()
  }
  if (!developer) notFound()

  const { data: projects } = await supabase
    .from("projects")
    .select("id, name, slug, main_image, location, city, launch_price_from, launch_price_to, currency, status, is_featured, developers(name, logo_url, slug)")
    .eq("developer_id", developer.id)
    .eq("is_active", true)
    .eq("is_published", true)
    .order("created_at", { ascending: false })

  return (
    <div className="relative min-h-screen bg-[#fafafa] font-sans overflow-x-hidden">
      <div className="fixed top-[-10%] left-[-10%] w-[600px] h-[600px] rounded-full opacity-25 blur-[120px] -z-10 bg-[radial-gradient(circle,rgb(200,245,255)_0%,rgba(255,255,255,0)_70%)]" />
      <div className="fixed bottom-0 right-[-5%] w-[500px] h-[500px] rounded-full opacity-20 blur-[120px] -z-10 bg-[radial-gradient(circle,rgb(250,240,210)_0%,rgba(255,255,255,0)_70%)]" />

      <TopBar />
      <Header />

      {/* Hero Banner */}
      <section className="bg-gradient-to-br from-[#001f3f] via-[#002a52] to-[#001428] pt-16 pb-20 relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-[0.05]"
          style={{ backgroundImage: "radial-gradient(circle, #fff 1px, transparent 1px)", backgroundSize: "28px 28px" }}
        />
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#d6b357]/40 to-transparent" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Back */}
          <Link
            href="/developers"
            className="inline-flex items-center gap-1.5 text-sm text-white/50 hover:text-white transition-colors mb-8"
          >
            <ArrowLeft className="w-4 h-4" /> All Developers
          </Link>

          <div className="flex flex-col md:flex-row items-start md:items-center gap-8">
            {/* Logo */}
            <div className="w-28 h-28 rounded-[24px] bg-white border-2 border-[#d6b357]/40 shadow-[0_0_0_6px_rgba(214,179,87,0.1),0_8px_32px_rgba(0,0,0,0.25)] flex items-center justify-center shrink-0 overflow-hidden">
              {developer.logo_url ? (
                <Image
                  src={developer.logo_url}
                  alt={`${developer.name} logo`}
                  width={84}
                  height={84}
                  className="max-w-[75%] max-h-[75%] object-contain"
                />
              ) : (
                <Building2 className="w-10 h-10 text-[#d6b357]" />
              )}
            </div>

            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2 flex-wrap">
                <h1 className="font-['Outfit'] text-3xl md:text-4xl font-bold text-white" style={{ textShadow: "0 2px 20px rgba(0,0,0,0.4)" }}>
                  {developer.name}
                </h1>
                {developer.is_verified && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#d6b357]/15 border border-[#d6b357]/30 text-[#d6b357] text-xs font-bold">
                    <CheckCircle2 className="w-3 h-3" /> Verified
                  </span>
                )}
              </div>
              {developer.rating > 0 && (
                <div className="flex items-center gap-1.5 mb-3">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star key={s} className={`w-4 h-4 ${s <= Math.round(developer.rating) ? "text-[#d6b357] fill-[#d6b357]" : "text-white/20"}`} />
                  ))}
                  <span className="text-sm text-white/60 ml-1">{Number(developer.rating).toFixed(1)}</span>
                </div>
              )}
              {developer.address && (
                <div className="flex items-center gap-1.5 text-sm text-white/50">
                  <MapPin className="w-3.5 h-3.5" /> {developer.address}
                </div>
              )}
            </div>



          </div>

          <div className="mt-6">
            <SocialShare
              title={`${developer.name} | FHI Global`}
              text={`Explore projects by ${developer.name} on FHI Global.`}
              variant="dark"
            />
          </div>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-12">
        {/* About */}
        {developer.description && (
          <section className="relative bg-white rounded-[28px] border border-[#e8eaed] p-8 shadow-sm hover:shadow-xl hover:border-[#d6b357]/25 hover:-translate-y-1 transition-all duration-300 overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-[#d6b357] via-[#f0d890] to-transparent" />
            <div className="inline-flex items-center px-3 py-1.5 bg-[#fdf9f0] border border-[#d6b357]/25 rounded-full text-xs font-semibold uppercase tracking-wider mb-3 shadow-sm">
              <span className="w-2 h-2 bg-[#d6b357] rounded-full mr-2" /> About
            </div>
            <h2 className="font-['Outfit'] text-xl font-bold text-[#0d1117] mb-2">About {developer.name}</h2>
            <div className="h-px bg-gradient-to-r from-[#d6b357]/40 via-[#d6b357]/15 to-transparent mb-5" />
            <p className="text-[#374151] leading-relaxed whitespace-pre-line">{developer.description}</p>
          </section>
        )}

        {/* Projects */}
        <section>
          <div className="flex items-end justify-between mb-5">
            <div>
              <div className="inline-flex items-center px-3 py-1.5 bg-white border border-[#e5e5e5] rounded-full text-xs font-semibold uppercase tracking-wider mb-3 shadow-sm">
                <span className="w-2 h-2 bg-[#d6b357] rounded-full mr-2" /> Portfolio
              </div>
              <h2 className="font-['Outfit'] text-2xl font-bold text-[#0d1117] leading-tight">
                Projects by{" "}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#001f3f] to-[#d6b357]">{developer.name}</span>
              </h2>
            </div>
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-[#e8eaed] rounded-full shadow-sm">
              <span className="w-2 h-2 rounded-full bg-[#d6b357]" />
              <span className="text-sm font-semibold text-[#0d1117]">{projects?.length ?? 0}</span>
              <span className="text-sm text-[#6b7280]">project{(projects?.length ?? 0) !== 1 ? "s" : ""}</span>
            </div>
          </div>
          <div className="h-px bg-gradient-to-r from-[#d6b357]/40 via-[#d6b357]/15 to-transparent mb-8" />

          {projects && projects.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {projects.map((p) => (
                <ProjectCard key={p.id} project={p as unknown as ProjectCardData} />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 bg-gradient-to-br from-[#f8f6f0] to-white rounded-[28px] border border-[#e8eaed] text-center">
              <div className="w-14 h-14 rounded-2xl bg-[#001f3f]/6 flex items-center justify-center mb-4">
                <Building2 className="w-7 h-7 text-[#001f3f]/25" />
              </div>
              <p className="font-['Outfit'] font-semibold text-[#0d1117] text-sm mb-1">No projects yet</p>
              <p className="text-[#6b7280] text-xs">This developer hasn&apos;t published any projects.</p>
            </div>
          )}
        </section>
      </div>

      <Footer />
    </div>
  )
}
