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
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://fhiglobal.ae"
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

  // Published agent listings under this developer's projects (the "on the
  // market right now" view — bridges the projects catalog to buy/rent).
  type DevListing = {
    id: string
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
      .select("id, title, listing_kind, price, currency, project_id, agent_listing_images(url, sort_order)")
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
      <div className="fixed top-[-10%] left-[-10%] w-[600px] h-[600px] rounded-full opacity-25 blur-[120px] -z-10 bg-[radial-gradient(circle,rgb(200,245,255)_0%,rgba(255,255,255,0)_70%)]" />
      <div className="fixed bottom-0 right-[-5%] w-[500px] h-[500px] rounded-full opacity-20 blur-[120px] -z-10 bg-[radial-gradient(circle,rgb(250,240,210)_0%,rgba(255,255,255,0)_70%)]" />

      <TopBar />
      <Header />

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
          <div className="absolute inset-0 bg-gradient-to-r from-[#001428]/95 via-[#001f3f]/75 to-[#001f3f]/25" />
          <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-[#000d1c]/60 to-transparent" />
        </div>
        {/* Gold accents: top rule + faint arcs on the left (mockup's line art) */}
        <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-transparent via-[#d6b357]/70 to-transparent" />
        <div className="absolute -left-24 top-10 w-[340px] h-[340px] rounded-full border border-[#d6b357]/20 pointer-events-none" aria-hidden="true" />
        <div className="absolute -left-14 top-24 w-[240px] h-[240px] rounded-full border border-[#d6b357]/15 pointer-events-none" aria-hidden="true" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Back */}
          <Link
            href="/developers"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#d6b357] hover:text-[#f0d890] transition-colors mb-8"
          >
            <ArrowLeft className="w-4 h-4" /> All Developers
          </Link>

          <div className="flex flex-col md:flex-row items-start md:items-center gap-8">
            {/* Logo */}
            <div className="w-32 h-32 md:w-36 md:h-36 rounded-[28px] bg-white ring-1 ring-white/60 shadow-[0_24px_70px_-16px_rgba(0,10,25,0.7)] flex items-center justify-center shrink-0 overflow-hidden">
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
                  style={{ textShadow: "0 2px 24px rgba(0,10,30,0.6)" }}
                >
                  {developer.name}
                </h1>
                {developer.is_verified && (
                  <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-[#0a1f38]/80 border border-[#d6b357]/60 text-[#d6b357] text-sm font-bold backdrop-blur-sm">
                    <CheckCircle2 className="w-4 h-4" /> Verified
                  </span>
                )}
              </div>
              {developer.rating > 0 && (
                <div className="flex items-center gap-1.5 mb-3">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star key={s} className={`w-5 h-5 ${s <= Math.round(developer.rating) ? "text-[#d6b357] fill-[#d6b357]" : "text-white/25"}`} />
                  ))}
                  <span className="text-base font-bold text-white ml-1.5">{Number(developer.rating).toFixed(1)}</span>
                </div>
              )}
              {developer.address && (
                <div className="flex items-start gap-2 text-base text-white/85 max-w-xl" style={{ textShadow: "0 1px 8px rgba(0,10,30,0.7)" }}>
                  <MapPin className="w-4 h-4 text-[#d6b357] shrink-0 mt-1" /> {developer.address}
                </div>
              )}
            </div>
          </div>

          <div className="mt-8">
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
          <section className="relative bg-white rounded-[28px] border border-[#e8eaed] p-8 md:p-10 shadow-[0_16px_50px_-16px_rgba(0,20,40,0.15)] overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-[#d6b357] via-[#f0d890] to-transparent" />
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-8 lg:gap-12 items-start">
              <div>
                <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-[#d6b357]/15 border border-[#d6b357]/40 rounded-full text-xs font-bold uppercase tracking-wider text-[#8a6d2a] mb-4">
                  <Building2 className="w-3.5 h-3.5 text-[#b8913f]" /> About
                </div>
                <h2 className="font-['Outfit'] text-2xl md:text-3xl font-bold text-[#0d1117] mb-3">
                  About {developer.name}
                </h2>
                <span className="block w-14 h-1 rounded-full bg-[#d6b357] mb-6" aria-hidden="true" />
                <p className="text-[#374151] text-base leading-relaxed whitespace-pre-line">{developer.description}</p>
              </div>
              {projects?.[0]?.main_image && (
                <div className="relative hidden lg:block rounded-[20px] overflow-hidden ring-1 ring-[#e8eaed] shadow-[0_20px_50px_-16px_rgba(0,20,40,0.3)] aspect-[3/4]">
                  <Image
                    src={projects[0].main_image}
                    alt={`${developer.name} project`}
                    fill
                    sizes="320px"
                    className="object-cover"
                  />
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#001428]/80 to-transparent px-4 pb-3 pt-10">
                    <p className="text-white text-sm font-bold truncate">{projects[0].name}</p>
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
                <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-white border border-[#d6b357]/50 rounded-full text-xs font-bold uppercase tracking-wider text-[#001f3f] mb-3 shadow-sm">
                  <Star className="w-3.5 h-3.5 text-[#d6b357] fill-[#d6b357]" /> On the Market
                </div>
                <h2 className="font-['Outfit'] text-2xl font-bold text-[#0d1117] leading-tight">
                  Available Listings from{" "}
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#001f3f] to-[#d6b357]">
                    {developer.name}
                  </span>
                </h2>
              </div>
              <div className="hidden sm:flex items-center gap-2">
                {forSaleCount > 0 && (
                  <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#d6b357]/15 border border-[#d6b357]/40 text-xs font-bold text-[#8a6d2a]">
                    {forSaleCount} for sale
                  </span>
                )}
                {forRentCount > 0 && (
                  <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#2f6fe4]/10 border border-[#2f6fe4]/30 text-xs font-bold text-[#2456b3]">
                    {forRentCount} for rent
                  </span>
                )}
              </div>
            </div>
            <div className="h-px bg-gradient-to-r from-[#d6b357]/40 via-[#d6b357]/15 to-transparent mb-8" />

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {listings.map((l) => {
                const cover = listingCover(l)
                const proj = l.project_id != null ? projectById.get(l.project_id) : undefined
                return (
                  <Link
                    key={l.id}
                    href={`/listings/${l.id}`}
                    className="group relative bg-white rounded-2xl border border-[#e8eaed] overflow-hidden shadow-sm hover:shadow-[0_16px_44px_-14px_rgba(0,20,40,0.3)] hover:-translate-y-1 transition-all duration-300"
                  >
                    <span className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-[#d6b357] via-[#f0d890] to-[#d6b357]/30 z-10" aria-hidden="true" />
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
                        className={`absolute top-3 left-3 px-2.5 py-1 rounded-full text-[11px] font-bold text-white shadow ${
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
              <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-white border border-[#d6b357]/50 rounded-full text-xs font-bold uppercase tracking-wider text-[#001f3f] mb-3 shadow-sm">
                <Star className="w-3.5 h-3.5 text-[#d6b357] fill-[#d6b357]" /> Portfolio
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
