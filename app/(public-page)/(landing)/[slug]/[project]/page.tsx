import type { Metadata } from "next"
import Image from "next/image"
import { notFound, permanentRedirect } from "next/navigation"
import Link from "next/link"
import { createPublicSupabaseClient } from "@/lib/supabase/public"
import { createPageMetadata } from "@/lib/seo"
import { TopBar } from "@/components/topbar"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { SocialShare } from "@/components/social-share"
import { ProjectGallery } from "@/components/public/project-gallery"
import { AmenitiesGrid, NearbyPlaces } from "@/components/public/amenities-grid"
import {
  MapPin, Building2, Calendar, Home, Layers, Phone, Mail, ArrowLeft,
  CheckCircle2, Play, Globe, BedDouble, Bath, Maximize2, DollarSign,
  TrendingUp, Star
} from "lucide-react"

export const revalidate = 120

// slug = the developer's slug (the parent segment), project = the project's.
type Props = { params: Promise<{ slug: string; project: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug: devSlug, project: slug } = await params
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://fhiglobal.ae"
  const supabase = createPublicSupabaseClient()
  const { data } = await supabase
    .from("projects")
    .select("name, description, meta_title, meta_description, main_image, city, location, developers(slug)")
    .eq("slug", slug)
    .eq("is_published", true)
    .is("deleted_at", null)
    .maybeSingle()
  if (!data) return { title: "Project Not Found" }
  // Wrong developer segment: the page body issues the permanent redirect to
  // the canonical pair; metadata just needs to not claim the wrong URL.
  const devRel = data.developers as unknown as { slug: string | null } | null
  if (devRel?.slug && devRel.slug !== devSlug) return { title: data.meta_title ?? data.name }

  const title = data.meta_title ?? `${data.name} | FHI Global`
  const description = data.meta_description ?? `Discover ${data.name} – a premium real estate project in Dubai.`
  const ogImage = `${siteUrl}/og/project/${slug}`
  const keywords = [
    data.name,
    data.city,
    data.location,
    "Dubai project",
    "off-plan property",
    "real estate Dubai",
  ].filter(Boolean) as string[]

  return createPageMetadata({
    title,
    description,
    imageUrl: ogImage || data.main_image,
    pathname: `/${devSlug}/${slug}`,
    keywords,
    openGraphTitle: data.name,
    openGraphDescription: data.description ?? description,
  })
}

const STATUS_STYLES: Record<string, { label: string; bg: string; text: string; border: string }> = {
  pre_launch:         { label: "Pre-Launch",         bg: "#f0f9ff", text: "#0369a1", border: "#bae6fd" },
  launch:             { label: "Launching",           bg: "#f0fdf4", text: "#15803d", border: "#bbf7d0" },
  under_construction: { label: "Under Construction", bg: "#fffbeb", text: "#b45309", border: "#fde68a" },
  completed:          { label: "Completed",           bg: "#f0fdf4", text: "#15803d", border: "#bbf7d0" },
}

function formatPrice(from: number | null, to: number | null, currency: string | null) {
  const cur = currency ?? "AED"
  if (!from) return null
  const fmt = (n: number) => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
    if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`
    return n.toLocaleString()
  }
  if (to && to !== from) return `${cur} ${fmt(from)} – ${fmt(to)}`
  return `${cur} ${fmt(from)}`
}

export default async function ProjectDetailPage({ params }: Props) {
  const { slug: devSlug, project: slug } = await params
  const supabase = createPublicSupabaseClient()

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select(`
      *,
      developers ( id, name, slug, logo_url, website_url, phone, email, description, is_verified ),
      project_images ( id, url, thumb, is_main, rank ),
      project_units ( id, unit_type, bedrooms, bathrooms, size_sqft, price_from, price_to, available_units, is_available ),
      project_amenities ( amenities ( name ) ),
      project_points ( id, category, description ),
      project_neighbors ( id, category, description ),
      project_media ( id, media_type, url ),
      project_features ( id, description ),
      project_keywords ( id, keyword ),
      project_property_types ( property_types ( name ) )
    `)
    .eq("slug", slug)
    .is("deleted_at", null)
    .maybeSingle()

  if (projectError) {
    console.error("[project-detail] query error:", projectError.message, projectError.details)
    notFound()
  }
  if (!project) notFound()

  const status = STATUS_STYLES[project.status] ?? { label: project.status, bg: "#f3f4f6", text: "#374151", border: "#e5e7eb" }
  const price = formatPrice(project.launch_price_from, project.launch_price_to, project.currency)
  const locationStr = [project.community, project.location, project.city].filter(Boolean).join(", ")
  const images = ((project.project_images ?? []) as {id:number;url:string;thumb:string|null;is_main:boolean|null;rank:number|null}[])
    .sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0))
    .map((img) => ({ id: img.id, image_url: img.url, caption: null, rank: img.rank }))
  const developer = project.developers as { id:string;name:string;slug:string;logo_url:string|null;website_url:string|null;phone:string|null;email:string|null;description:string|null;is_verified:boolean|null } | null

  // The URL's developer segment must be the project's actual developer. A
  // mismatch 308s to the canonical pair (old links and typos both land right);
  // a project with no sluggable developer has no nested address at all.
  if (!developer?.slug) notFound()
  if (developer.slug !== devSlug) permanentRedirect(`/${developer.slug}/${project.slug}`)
  const units = (project.project_units ?? []) as { id:number; unit_type:string|null; bedrooms:number|null; bathrooms:number|null; size_sqft:number|null; price_from:number|null; price_to:number|null; available_units:number|null; is_available:boolean|null }[]
  const features = (project.project_features ?? []) as { id:number; description:string }[]
  const media = (project.project_media ?? []) as { id:number; media_type:string|null; url:string }[]
  const propertyTypes = ((project.project_property_types ?? []) as { property_types: { name: string } | null }[])
    .map((pt) => pt.property_types?.name).filter(Boolean) as string[]
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://fhiglobal.ae"
  const listingSchema = {
    "@context": "https://schema.org",
    "@type": "RealEstateListing",
    name: project.name,
    description: project.meta_description || project.description || project.about_project || project.name,
    url: `${siteUrl}/${developer.slug}/${project.slug}`,
    image: [project.main_image, ...images.map((image) => image.image_url)].filter(Boolean),
    offers: project.launch_price_from
      ? {
          "@type": "Offer",
          priceCurrency: project.currency ?? "AED",
          price: project.launch_price_from,
        }
      : undefined,
    address: {
      "@type": "PostalAddress",
      addressLocality: project.city || undefined,
      streetAddress: [project.location, project.community].filter(Boolean).join(", ") || undefined,
      addressCountry: "AE",
    },
    geo: project.latitude && project.longitude
      ? {
          "@type": "GeoCoordinates",
          latitude: project.latitude,
          longitude: project.longitude,
        }
      : undefined,
    seller: developer
      ? {
          "@type": "Organization",
          name: developer.name,
          url: developer.slug ? `${siteUrl}/${developer.slug}` : undefined,
        }
      : undefined,
  }

  return (
    <>
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(listingSchema) }}
    />
    <div className="relative min-h-screen bg-[#fafafa] font-sans overflow-x-hidden">
      <div className="fixed top-[-10%] left-[-10%] w-[600px] h-[600px] rounded-full opacity-20 blur-[120px] -z-10 bg-[radial-gradient(circle,rgb(200,245,255)_0%,rgba(255,255,255,0)_70%)]" />

      <TopBar />
      <Header />

      {/* ── Hero ──────────────────────────────────────────── */}
      <section className="relative min-h-[60vh] flex items-end overflow-hidden">
        {/* BG image */}
        {project.main_image ? (
          <Image
            src={project.main_image}
            alt={project.name}
            fill
            sizes="100vw"
            className="absolute inset-0 object-cover"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-[#001f3f] to-[#002a52]" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#001428]/95 via-[#001428]/35 to-[#001428]/10" />
        <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-gradient-to-r from-transparent via-[#d6b357]/70 to-transparent" />

        <div className="relative w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12 pt-16">
          {/* Back */}
          <Link href="/projects" className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#d6b357] hover:text-[#f0d890] transition-colors mb-6">
            <ArrowLeft className="w-4 h-4" /> All Projects
          </Link>

          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
            <div className="max-w-2xl">
              {/* Tags row */}
              <div className="flex flex-wrap items-center gap-2 mb-4">
                <span
                  className="px-3 py-1 rounded-full text-xs font-bold"
                  style={{ backgroundColor: status.bg, color: status.text, border: `1px solid ${status.border}` }}
                >
                  {status.label}
                </span>
                {project.is_featured && (
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-[#d6b357] text-[#001f3f]">Featured</span>
                )}
                {propertyTypes.map((t) => (
                  <span key={t} className="px-3 py-1 rounded-full text-xs font-medium bg-white/15 text-white border border-white/20 backdrop-blur-sm">
                    {t}
                  </span>
                ))}
              </div>

              <h1
                className="font-['Outfit'] text-5xl md:text-6xl font-bold text-white leading-[1.05] mb-3"
                style={{ textShadow: "0 2px 30px rgba(0,10,30,0.6)" }}
              >
                {project.name}
              </h1>
              <span className="block w-14 h-1 rounded-full bg-[#d6b357] mb-4" aria-hidden="true" />

              {developer && (
                <p className="text-white/80 text-base mb-2" style={{ textShadow: "0 1px 8px rgba(0,10,30,0.7)" }}>
                  by{" "}
                  {developer.slug ? (
                    <Link
                      href={`/${developer.slug}`}
                      className="font-bold text-[#d6b357] hover:text-[#f0d890] transition-colors"
                    >
                      {developer.name}
                    </Link>
                  ) : (
                    <span className="font-bold text-white">{developer.name}</span>
                  )}
                </p>
              )}

              {locationStr && (
                <div className="flex items-center gap-1.5 text-white/85 text-sm" style={{ textShadow: "0 1px 8px rgba(0,10,30,0.7)" }}>
                  <MapPin className="w-4 h-4 text-[#d6b357]" /> {locationStr}
                </div>
              )}
            </div>

            {/* Price + CTA — solid navy card with gold ring (premium look) */}
            <div className="bg-[#0a1f38]/95 backdrop-blur-md ring-1 ring-[#d6b357]/40 rounded-[20px] p-6 min-w-[280px] shadow-[0_30px_80px_-20px_rgba(0,10,25,0.8)]">
              {price ? (
                <div className="mb-5">
                  <p className="text-xs text-[#d6b357] uppercase tracking-[0.2em] font-bold mb-1.5">Starting From</p>
                  <p className="font-['Outfit'] text-3xl font-bold text-white leading-none">{price}</p>
                </div>
              ) : null}
              <div className="flex flex-col gap-2.5">
                {developer?.phone && (
                  <a
                    href={`tel:${developer.phone}`}
                    className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-[#d6b357] to-[#c9a449] hover:from-[#c9a449] hover:to-[#b8913f] text-[#001f3f] text-sm font-bold transition-all shadow-[0_8px_24px_-6px_rgba(214,179,87,0.5)]"
                  >
                    <Phone className="w-3.5 h-3.5" /> Contact Agent
                  </a>
                )}
                <a
                  href="#units"
                  className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-[#d6b357]/50 text-white text-sm font-semibold hover:bg-[#d6b357]/15 hover:border-[#d6b357] transition-all"
                >
                  View Units
                </a>
              </div>

              <SocialShare
                title={`${project.name} | FHI Global`}
                text={`Discover ${project.name} on FHI Global.`}
                variant="dark"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ── Quick stats band — navy with gold-ringed icons (premium) ── */}
      <div className="bg-gradient-to-r from-[#001f3f] to-[#002a52] border-b border-[#d6b357]/25">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-wrap gap-x-10 gap-y-5">
          {[
            { icon: Calendar, label: "Completion", value: project.delivery_quarter ?? (project.expected_completion_date ? new Date(project.expected_completion_date).toLocaleDateString("en-AE", { month: "short", year: "numeric" }) : null) },
            { icon: Home, label: "Total Units", value: project.total_units?.toLocaleString() },
            { icon: Building2, label: "Buildings", value: project.number_of_buildings?.toString() },
            { icon: Layers, label: "Floors", value: project.floors?.toString() },
            { icon: TrendingUp, label: "Expected ROI", value: project.expected_roi ? `${project.expected_roi}%` : null },
            { icon: Star, label: "Rental Yield", value: project.rental_yield ? `${project.rental_yield}%` : null },
            { icon: DollarSign, label: "Down Payment", value: project.down_payment_percentage ? `${project.down_payment_percentage}%` : null },
          ]
            .filter((s) => s.value)
            .map(({ icon: Icon, label, value }) => (
              <div key={label} className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-full border-2 border-[#d6b357]/60 bg-[#d6b357]/10 flex items-center justify-center shrink-0">
                  <Icon className="w-[18px] h-[18px] text-[#d6b357]" />
                </div>
                <div>
                  <p className="text-[10px] text-white/60 font-bold uppercase tracking-widest">{label}</p>
                  <p className="font-['Outfit'] text-lg font-bold text-white leading-tight">{value}</p>
                </div>
              </div>
            ))}
        </div>
      </div>

      {/* ── Main content ─────────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left / main column */}
        <div className="lg:col-span-2 space-y-10">

          {/* Overview */}
          {(project.description || project.about_project) && (
            <section className="relative bg-white rounded-[28px] border border-[#e8eaed] p-8 shadow-sm hover:shadow-xl hover:border-[#d6b357]/25 hover:-translate-y-1 transition-all duration-300 overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-[#d6b357] via-[#f0d890] to-transparent" />
              <h2 className="font-['Outfit'] text-xl font-bold text-[#0d1117] mt-1 mb-2">Project Overview</h2>
              <div className="h-px bg-gradient-to-r from-[#d6b357]/40 via-[#d6b357]/15 to-transparent mb-5" />
              {project.description && (
                <p className="text-[#374151] leading-relaxed mb-4">{project.description}</p>
              )}
              {project.about_project && project.about_project !== project.description && (
                <div className="pt-4 border-t border-[#f3f4f6]">
                  <h3 className="font-semibold text-[#0d1117] mb-2 text-sm">About This Project</h3>
                  <p className="text-[#374151] leading-relaxed text-sm">{project.about_project}</p>
                </div>
              )}
            </section>
          )}

          {/* Features */}
          {features.length > 0 && (
            <section className="relative bg-white rounded-[28px] border border-[#e8eaed] p-8 shadow-sm hover:shadow-xl hover:border-[#d6b357]/25 hover:-translate-y-1 transition-all duration-300 overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-[#d6b357] via-[#f0d890] to-transparent" />
              <h2 className="font-['Outfit'] text-xl font-bold text-[#0d1117] mt-1 mb-2">Key Features</h2>
              <div className="h-px bg-gradient-to-r from-[#d6b357]/40 via-[#d6b357]/15 to-transparent mb-5" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {features.map((f) => (
                  <div key={f.id} className="flex items-start gap-3 p-4 rounded-2xl bg-gradient-to-br from-[#fdf9f0] to-white border border-[#d6b357]/20 hover:border-[#d6b357]/40 hover:shadow-md transition-all duration-200">
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[#d6b357] to-[#f0d890] flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#001f3f]" />
                    </div>
                    <p className="text-sm text-[#374151] leading-relaxed">{f.description}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Gallery */}
          {images.length > 0 && (
            <section className="relative bg-white rounded-[28px] border border-[#e8eaed] p-8 shadow-sm hover:shadow-xl hover:border-[#d6b357]/25 hover:-translate-y-1 transition-all duration-300 overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-[#d6b357] via-[#f0d890] to-transparent" />
              <h2 className="font-['Outfit'] text-xl font-bold text-[#0d1117] mt-1 mb-2">
                Gallery <span className="text-sm font-normal text-[#9ca3af]">({images.length} photos)</span>
              </h2>
              <div className="h-px bg-gradient-to-r from-[#d6b357]/40 via-[#d6b357]/15 to-transparent mb-5" />
              <ProjectGallery images={images} />
            </section>
          )}

          {/* Units */}
          {units.length > 0 && (
            <section id="units" className="relative bg-white rounded-[28px] border border-[#e8eaed] p-8 shadow-sm hover:shadow-xl hover:border-[#d6b357]/25 hover:-translate-y-1 transition-all duration-300 overflow-hidden scroll-mt-24">
              <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-[#d6b357] via-[#f0d890] to-transparent" />
              <h2 className="font-['Outfit'] text-xl font-bold text-[#0d1117] mt-1 mb-2">Available Unit Types</h2>
              <div className="h-px bg-gradient-to-r from-[#d6b357]/40 via-[#d6b357]/15 to-transparent mb-5" />
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b-2 border-[#d6b357]/20 bg-gradient-to-r from-[#fdf9f0] to-white">
                      {["Type", "Beds", "Baths", "Size (sqft)", "Starting Price", "Status"].map((h) => (
                        <th key={h} className="text-left text-xs font-bold text-[#001f3f] uppercase tracking-wider py-3 pr-6 last:pr-0">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {units.map((u) => (
                      <tr key={u.id} className="border-b border-[#f9fafb] hover:bg-[#fdf9f0] transition-colors">
                        <td className="py-3 pr-6 font-semibold text-[#0d1117]">{u.unit_type ?? "—"}</td>
                        <td className="py-3 pr-6 text-[#374151]">
                          {u.bedrooms !== null ? (
                            <span className="flex items-center gap-1"><BedDouble className="w-3.5 h-3.5 text-[#9ca3af]" />{u.bedrooms}</span>
                          ) : "—"}
                        </td>
                        <td className="py-3 pr-6 text-[#374151]">
                          {u.bathrooms !== null ? (
                            <span className="flex items-center gap-1"><Bath className="w-3.5 h-3.5 text-[#9ca3af]" />{u.bathrooms}</span>
                          ) : "—"}
                        </td>
                        <td className="py-3 pr-6 text-[#374151]">
                          {u.size_sqft ? (
                            <span className="flex items-center gap-1"><Maximize2 className="w-3.5 h-3.5 text-[#9ca3af]" />{u.size_sqft.toLocaleString()}</span>
                          ) : "—"}
                        </td>
                        <td className="py-3 pr-6 font-semibold text-[#001f3f]">
                          {u.price_from ? formatPrice(u.price_from, u.price_to, project.currency) : "On Request"}
                        </td>
                        <td className="py-3">
                          {u.is_available !== false ? (
                            <span className="inline-block px-2.5 py-1 rounded-full text-[11px] font-semibold bg-[#f0fdf4] text-[#15803d]">
                              {u.available_units != null ? `${u.available_units} available` : "Available"}
                            </span>
                          ) : (
                            <span className="inline-block px-2.5 py-1 rounded-full text-[11px] font-semibold bg-[#fef2f2] text-[#dc2626]">
                              Sold Out
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* Amenities */}
          {project.project_amenities && project.project_amenities.length > 0 && (
            <section className="relative bg-white rounded-[28px] border border-[#e8eaed] p-8 shadow-sm hover:shadow-xl hover:border-[#d6b357]/25 hover:-translate-y-1 transition-all duration-300 overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-[#d6b357] via-[#f0d890] to-transparent" />
              <h2 className="font-['Outfit'] text-xl font-bold text-[#0d1117] mt-1 mb-2">Amenities</h2>
              <div className="h-px bg-gradient-to-r from-[#d6b357]/40 via-[#d6b357]/15 to-transparent mb-5" />
              <AmenitiesGrid amenities={project.project_amenities as any} />
            </section>
          )}

          {/* Nearby */}
          {((project.project_points && project.project_points.length > 0) || (project.project_neighbors && project.project_neighbors.length > 0)) && (
            <section className="relative bg-white rounded-[28px] border border-[#e8eaed] p-8 shadow-sm hover:shadow-xl hover:border-[#d6b357]/25 hover:-translate-y-1 transition-all duration-300 overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-[#d6b357] via-[#f0d890] to-transparent" />
              <h2 className="font-['Outfit'] text-xl font-bold text-[#0d1117] mt-1 mb-2">Nearby Places</h2>
              <div className="h-px bg-gradient-to-r from-[#d6b357]/40 via-[#d6b357]/15 to-transparent mb-5" />
              <NearbyPlaces
                points={(project.project_points as any[])?.map((p) => ({ ...p, place_type: p.category }))}
                neighbors={(project.project_neighbors as any[])?.map((p) => ({ ...p, place_type: p.category }))}
              />
            </section>
          )}

          {/* Media */}
          {media.length > 0 && (
            <section className="relative bg-white rounded-[28px] border border-[#e8eaed] p-8 shadow-sm hover:shadow-xl hover:border-[#d6b357]/25 hover:-translate-y-1 transition-all duration-300 overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-[#d6b357] via-[#f0d890] to-transparent" />
              <h2 className="font-['Outfit'] text-xl font-bold text-[#0d1117] mt-1 mb-2">Media & Virtual Tours</h2>
              <div className="h-px bg-gradient-to-r from-[#d6b357]/40 via-[#d6b357]/15 to-transparent mb-5" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {media.map((m) => (
                  <a
                    key={m.id}
                    href={m.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex items-center gap-4 p-4 rounded-2xl bg-[#f7f8fa] border border-[#e8eaed] hover:border-[#001f3f]/20 hover:bg-[#001f3f]/4 transition-all"
                  >
                    <div className="w-10 h-10 rounded-xl bg-[#001f3f] flex items-center justify-center shrink-0">
                      <Play className="w-4 h-4 text-[#d6b357]" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-[#0d1117] group-hover:text-[#001f3f] transition-colors">
                        {m.media_type === "video" ? "Watch Video" : "Virtual Tour"}
                      </p>
                      <p className="text-xs text-[#9ca3af] capitalize">{m.media_type ?? "media"}</p>
                    </div>
                  </a>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* ── Right sidebar ───────────────────────────────── */}
        <div className="space-y-6">
          {/* Payment plan */}
          {(project.down_payment_percentage || project.payment_plan_details || project.installment_available) && (
            <div className="relative bg-white rounded-[28px] border border-[#e8eaed] p-6 shadow-sm hover:shadow-xl hover:border-[#d6b357]/25 transition-all duration-300 overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-[#d6b357] via-[#f0d890] to-transparent" />
              <h3 className="font-['Outfit'] font-bold text-[#0d1117] mt-1 mb-4">Payment Plan</h3>
              <div className="space-y-3">
                {project.down_payment_percentage && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[#6b7280]">Down Payment</span>
                    <span className="px-2.5 py-1 rounded-full bg-gradient-to-r from-[#d6b357]/15 to-[#f0d890]/15 border border-[#d6b357]/30 font-bold text-[#001f3f] text-xs">{project.down_payment_percentage}%</span>
                  </div>
                )}
                {project.government_fee_percentage && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[#6b7280]">DLD Fee</span>
                    <span className="px-2.5 py-1 rounded-full bg-[#f3f4f6] border border-[#e5e7eb] font-bold text-[#0d1117] text-xs">{project.government_fee_percentage}%</span>
                  </div>
                )}
                {project.installment_available && (
                  <div className="flex items-center gap-2 p-3 rounded-xl bg-[#f0fdf4] border border-[#bbf7d0]">
                    <CheckCircle2 className="w-4 h-4 text-[#15803d]" />
                    <span className="text-sm font-medium text-[#15803d]">Installment Available</span>
                  </div>
                )}
                {project.payment_plan_details && (
                  <p className="text-xs text-[#6b7280] leading-relaxed">{project.payment_plan_details}</p>
                )}
              </div>
            </div>
          )}

          {/* Developer card */}
          {developer && (
            <div className="relative bg-white rounded-[28px] border border-[#e8eaed] p-6 shadow-sm hover:shadow-xl hover:border-[#001f3f]/20 transition-all duration-300 overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-[#001f3f] via-[#002a52] to-transparent" />
              <p className="text-xs font-bold uppercase tracking-widest text-[#9ca3af] mt-1 mb-4">Developer</p>
              <Link href={`/${developer.slug}`} className="flex items-center gap-4 group mb-4">
                <div className="w-14 h-14 rounded-2xl bg-[#f7f8fa] border border-[#e8eaed] flex items-center justify-center overflow-hidden shrink-0">
                  {developer.logo_url ? (
                    <Image
                      src={developer.logo_url}
                      alt={`${developer.name} logo`}
                      width={44}
                      height={44}
                      className="max-w-[80%] max-h-[80%] object-contain"
                    />
                  ) : (
                    <Building2 className="w-6 h-6 text-[#9ca3af]" />
                  )}
                </div>
                <div>
                  <p className="font-bold text-[#0d1117] group-hover:text-[#001f3f] transition-colors">{developer.name}</p>
                  {developer.is_verified && (
                    <span className="text-xs text-[#15803d] flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Verified</span>
                  )}
                </div>
              </Link>
              <div className="flex flex-col gap-2">
                {developer.website_url && (
                  <a href={developer.website_url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2 text-xs text-[#6b7280] hover:text-[#001f3f] transition-colors">
                    <Globe className="w-3.5 h-3.5" /> {developer.website_url.replace(/^https?:\/\//, "")}
                  </a>
                )}
                {developer.email && (
                  <a href={`mailto:${developer.email}`}
                    className="flex items-center gap-2 text-xs text-[#6b7280] hover:text-[#001f3f] transition-colors">
                    <Mail className="w-3.5 h-3.5" /> {developer.email}
                  </a>
                )}
              </div>
              <Link
                href={`/${developer.slug}`}
                className="mt-4 flex items-center justify-center gap-1.5 w-full py-2.5 rounded-full bg-gradient-to-r from-[#001f3f] to-[#002a52] hover:from-[#002a52] hover:to-[#003366] text-white text-sm font-semibold shadow-md hover:shadow-[0_8px_24px_rgba(0,31,63,0.3)] hover:-translate-y-0.5 transition-all duration-300"
              >
                View Developer Profile
              </Link>
            </div>
          )}

          {/* Quick facts */}
          <div className="bg-gradient-to-br from-[#001f3f] to-[#001428] rounded-[28px] p-6 shadow-lg">
            <div className="flex items-center gap-2 mb-4">
              <span className="w-1.5 h-5 rounded-full bg-gradient-to-b from-[#d6b357] to-[#f0d890]" />
              <h3 className="font-['Outfit'] font-bold text-white">Quick Facts</h3>
            </div>
            <div className="space-y-3">
              {[
                { label: "Ownership", value: project.ownership_type ?? (project.freehold ? "Freehold" : null) },
                { label: "Region", value: project.region },
                { label: "Community", value: project.community },
                { label: "City", value: project.city },
                { label: "Country", value: project.country },
                { label: "Currency", value: project.currency },
              ].filter((f) => f.value).map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between text-sm border-b border-white/10 pb-2 last:border-0 last:pb-0">
                  <span className="text-white/50">{label}</span>
                  <span className="font-medium text-white">{value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Contact CTA */}
          <div className="bg-gradient-to-br from-[#d6b357] to-[#c9a449] rounded-[28px] p-6 shadow-[0_8px_32px_rgba(214,179,87,0.4)]">
            <h3 className="font-['Outfit'] font-bold text-[#001f3f] text-lg mb-2">Interested in this project?</h3>
            <p className="text-[#001f3f]/70 text-sm mb-4">Get in touch with our team for more details and exclusive offers.</p>
            <div className="flex flex-col gap-2.5">
              {project.sales_contact_phone && (
                <a href={`tel:${project.sales_contact_phone}`}
                  className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#001f3f] text-white text-sm font-bold transition-colors hover:bg-[#002a52]">
                  <Phone className="w-3.5 h-3.5" /> {project.sales_contact_phone}
                </a>
              )}
              {project.sales_contact_email && (
                <a href={`mailto:${project.sales_contact_email}`}
                  className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white/40 hover:bg-white/60 text-[#001f3f] text-sm font-semibold transition-colors">
                  <Mail className="w-3.5 h-3.5" /> Email Us
                </a>
              )}
              {!project.sales_contact_phone && !project.sales_contact_email && developer?.phone && (
                <a href={`tel:${developer.phone}`}
                  className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#001f3f] text-white text-sm font-bold transition-colors hover:bg-[#002a52]">
                  <Phone className="w-3.5 h-3.5" /> Contact Agent
                </a>
              )}
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </div>
    </>
  )
}
