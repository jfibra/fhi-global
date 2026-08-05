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
import { PdfPagePreviews } from "@/components/public/pdf-page-previews"
import { AmenitiesGrid, NearbyPlaces } from "@/components/public/amenities-grid"
import { ProjectInquireForm } from "@/components/public/project-inquire-form"
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
  // Fetched separately (not embedded) so a missing table in older environments
  // never breaks the page; the anon RLS policy gates rows to published projects.
  const { data: cuRows } = await supabase
    .from("construction_updates")
    .select("id, title, file_url, file_type, created_at")
    .eq("project_id", project.id as number)
    .order("created_at", { ascending: false })
  const constructionUpdates = (cuRows ?? []) as { id:string; title:string; file_url:string; file_type:string; created_at:string|null }[]
  const propertyTypes = ((project.project_property_types ?? []) as { property_types: { name: string } | null }[])
    .map((pt) => pt.property_types?.name).filter(Boolean) as string[]
  const quickFacts = [
    { icon: CheckCircle2, label: "Ownership", value: project.ownership_type ?? (project.freehold ? "Freehold" : null) },
    { icon: MapPin, label: "Region", value: project.region },
    { icon: Home, label: "Community", value: project.community },
    { icon: Building2, label: "City", value: project.city },
    { icon: Globe, label: "Country", value: project.country },
    { icon: DollarSign, label: "Currency", value: project.currency },
  ].filter((f) => f.value) as { icon: typeof MapPin; label: string; value: string }[]
  const quickStats = [
    project.delivery_quarter ?? project.expected_completion_date,
    project.total_units, project.number_of_buildings, project.floors,
    project.expected_roi, project.rental_yield, project.down_payment_percentage,
  ].filter(Boolean)
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

      {/* ── Hero ──────────────────────────────────────────────
          Editorial layout: one calm left column (eyebrow, title, blurb, fact
          row) over a scrimmed photo, with a quiet bordered share panel to the
          right. The old version stacked pills, title, and a loud navy CTA card
          in the same space — seven fat share buttons ended up shouting louder
          than the project name. */}
      <section className="relative min-h-[420px] flex items-center overflow-hidden">
        {project.main_image ? (
          <Image
            src={project.main_image}
            alt={project.name}
            fill
            sizes="100vw"
            priority
            className="absolute inset-0 object-cover"
          />
        ) : (
          <div className="absolute inset-0 bg-[#001f3f]" />
        )}
        {/* Left-weighted scrim: keeps the copy legible while the photo stays
            visible on the right, where the building usually is. */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#001428]/75 via-[#001428]/35 to-[#001428]/5" />

        <div className="relative w-full max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-10 md:py-12">
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_auto] gap-10 lg:gap-14 items-end">
            <div className="max-w-2xl">
              <div className="flex items-center gap-3 mb-4">
                <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#d6b357]">
                  {status.label}
                </span>
                <span className="h-px w-10 bg-[#d6b357]/70" aria-hidden="true" />
                {project.is_featured && (
                  <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/70">Featured</span>
                )}
              </div>

              <h1
                className="font-['Outfit'] text-4xl md:text-5xl font-bold text-white leading-[1.06]"
                style={{ textShadow: "0 2px 30px rgba(0,10,30,0.6)" }}
              >
                {project.name}
              </h1>
              <span className="block w-14 h-1 bg-[#d6b357] mt-4 mb-5" aria-hidden="true" />

              {(project.description || project.about_project) && (
                <p
                  className="text-[16.5px] leading-[1.75] text-white/80 max-w-xl line-clamp-3"
                  style={{ textShadow: "0 1px 10px rgba(0,10,30,0.7)" }}
                >
                  {project.description || project.about_project}
                </p>
              )}

              {/* Fact row — the mockup's Developer / Location / Type / Status
                  strip. Empty fields drop out rather than printing a dash. */}
              <dl className="mt-7 flex flex-wrap gap-x-10 gap-y-5">
                {[
                  {
                    label: "Developer",
                    node: developer
                      ? (developer.slug
                          ? <Link href={`/${developer.slug}`} className="text-white hover:text-[#d6b357] transition-colors">{developer.name}</Link>
                          : developer.name)
                      : null,
                  },
                  { label: "Location", node: locationStr || null },
                  { label: "Type", node: propertyTypes[0] ?? null },
                  { label: "Status", node: status.label },
                  { label: "Starting From", node: price },
                ]
                  .filter((f) => f.node)
                  .map((f) => (
                    <div key={f.label}>
                      <dt className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#d6b357] mb-1.5">
                        {f.label}
                      </dt>
                      <dd className="text-[15px] font-semibold text-white" style={{ textShadow: "0 1px 8px rgba(0,10,30,0.7)" }}>
                        {f.node}
                      </dd>
                    </div>
                  ))}
              </dl>
            </div>

            {/* Share — a bordered panel, not a stack of pills. */}
            <div className="lg:w-[500px] shrink-0 border border-white/20 bg-[#001428]/60 backdrop-blur-md p-6">
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-white">Share this project</p>
              <span className="block w-full h-px bg-white/15 mt-3 mb-4" aria-hidden="true" />
              <SocialShare
                title={`${project.name} | FHI Global`}
                text={`Discover ${project.name} on FHI Global.`}
                variant="bare"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Back link — out of the hero so it doesn't crowd the title. */}
      <div className="bg-white border-b border-[#e8eaed]">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <Link
            href={developer?.slug ? `/${developer.slug}` : "/projects"}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#6b7280] hover:text-[#001f3f] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            {developer?.name ? `All ${developer.name} projects` : "All Projects"}
          </Link>
        </div>
      </div>

      {/* ── Quick stats band — omitted entirely when a project carries no
             stats, rather than leaving an empty navy strip under the hero. ── */}
      {quickStats.length > 0 && (
      <div className="bg-[#001f3f] border-b border-[#d6b357]/25">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-wrap gap-x-10 gap-y-5">
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
      )}

      {/* ── Main content — flat editorial layout, per the approved mockup:
             uppercase section headings with a hairline, content directly on
             the white page. No floating cards, no rounded corners. ── */}
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-12 grid grid-cols-1 lg:grid-cols-3 gap-10 lg:gap-12">
        {/* Left / main column */}
        <div className="lg:col-span-2 space-y-12">

          {/* Overview */}
          {(project.description || project.about_project) && (
            <section>
              <SectionHeading title="Overview" />
              {project.description && (
                <p className="mt-5 text-[15.5px] leading-[1.8] text-[#374151]">{project.description}</p>
              )}
              {project.about_project && project.about_project !== project.description && (
                <p className="mt-4 text-[15.5px] leading-[1.8] text-[#374151]">{project.about_project}</p>
              )}
            </section>
          )}

          {/* Features */}
          {features.length > 0 && (
            <section>
              <SectionHeading title="Key Features" />
              <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3">
                {features.map((f) => (
                  <div key={f.id} className="flex items-start gap-3">
                    <CheckCircle2 className="w-[18px] h-[18px] text-[#d6b357] shrink-0 mt-0.5" />
                    <p className="text-[15px] text-[#374151] leading-relaxed">{f.description}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Gallery */}
          {images.length > 0 && (
            <section>
              <SectionHeading
                title="Gallery"
                action={
                  <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#6b7280]">
                    {images.length} photos
                  </span>
                }
              />
              <div className="mt-5">
                <ProjectGallery images={images} />
              </div>
            </section>
          )}

          {/* Units */}
          {units.length > 0 && (
            <section id="units" className="scroll-mt-24">
              <SectionHeading title="Available Unit Types" />
              <div className="mt-5 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b-2 border-[#0d1117]">
                      {["Type", "Beds", "Baths", "Size (sqft)", "Starting Price", "Status"].map((h) => (
                        <th key={h} className="text-left text-[11px] font-bold text-[#0d1117] uppercase tracking-wider py-3 pr-6 last:pr-0">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {units.map((u) => (
                      <tr key={u.id} className="border-b border-[#eef0f3]">
                        <td className="py-3.5 pr-6 font-semibold text-[#0d1117]">{u.unit_type ?? "—"}</td>
                        <td className="py-3.5 pr-6 text-[#374151]">
                          {u.bedrooms !== null ? (
                            <span className="flex items-center gap-1"><BedDouble className="w-3.5 h-3.5 text-[#9ca3af]" />{u.bedrooms}</span>
                          ) : "—"}
                        </td>
                        <td className="py-3.5 pr-6 text-[#374151]">
                          {u.bathrooms !== null ? (
                            <span className="flex items-center gap-1"><Bath className="w-3.5 h-3.5 text-[#9ca3af]" />{u.bathrooms}</span>
                          ) : "—"}
                        </td>
                        <td className="py-3.5 pr-6 text-[#374151]">
                          {u.size_sqft ? (
                            <span className="flex items-center gap-1"><Maximize2 className="w-3.5 h-3.5 text-[#9ca3af]" />{u.size_sqft.toLocaleString()}</span>
                          ) : "—"}
                        </td>
                        <td className="py-3.5 pr-6 font-semibold text-[#001f3f]">
                          {u.price_from ? formatPrice(u.price_from, u.price_to, project.currency) : "On Request"}
                        </td>
                        <td className="py-3.5">
                          {u.is_available !== false ? (
                            <span className="text-[13px] font-semibold text-[#15803d]">
                              {u.available_units != null ? `${u.available_units} available` : "Available"}
                            </span>
                          ) : (
                            <span className="text-[13px] font-semibold text-[#dc2626]">Sold Out</span>
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
            <section>
              <SectionHeading title="Amenities" />
              <div className="mt-5">
                <AmenitiesGrid amenities={project.project_amenities as any} />
              </div>
            </section>
          )}

          {/* Nearby */}
          {((project.project_points && project.project_points.length > 0) || (project.project_neighbors && project.project_neighbors.length > 0)) && (
            <section>
              <SectionHeading title="Nearby Places" />
              <div className="mt-5">
                <NearbyPlaces
                  points={(project.project_points as any[])?.map((p) => ({ ...p, place_type: p.category }))}
                  neighbors={(project.project_neighbors as any[])?.map((p) => ({ ...p, place_type: p.category }))}
                />
              </div>
            </section>
          )}

          {/* Construction Updates — PDFs show their first four pages so a
              visitor sees the progress without opening the file; images keep
              the simple tile. Every item still links to the original. */}
          {constructionUpdates.length > 0 && (
            <section>
              <SectionHeading title="Construction Updates" />
              <div className="mt-5 space-y-5">
                {constructionUpdates.map((u) =>
                  u.file_type === "image" ? (
                    <a
                      key={u.id}
                      href={u.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group flex items-center gap-4 p-4 border border-[#e5e8ec] hover:border-[#001f3f]/40 transition-colors"
                    >
                      <div className="w-12 h-12 bg-[#f3f4f6] flex items-center justify-center shrink-0 overflow-hidden">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={u.file_url} alt={u.title} className="w-full h-full object-cover" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-[#0d1117] truncate">{u.title}</p>
                        <p className="text-xs text-[#9ca3af] uppercase tracking-wide">Image · View</p>
                      </div>
                    </a>
                  ) : (
                    <PdfPagePreviews key={u.id} url={u.file_url} title={u.title} />
                  ),
                )}
              </div>
            </section>
          )}

          {/* Media */}
          {media.length > 0 && (
            <section>
              <SectionHeading title="Media & Virtual Tours" />
              <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                {media.map((m) => (
                  <a
                    key={m.id}
                    href={m.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex items-center gap-4 p-4 border border-[#e5e8ec] hover:border-[#001f3f]/40 transition-colors"
                  >
                    <div className="w-10 h-10 bg-[#001f3f] flex items-center justify-center shrink-0">
                      <Play className="w-4 h-4 text-[#d6b357]" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-[#0d1117]">
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

        {/* ── Right sidebar — headings sit on the page, panels are square.
               Sticky so the developer and enquiry panels stay with the reader
               through a long gallery instead of leaving the column blank. ── */}
        <div className="space-y-10">
          {/* Developer */}
          {developer && (
            <SidePanel title="Developer">
              <Link href={`/${developer.slug}`} className="flex items-center gap-4 group">
                <div className="w-14 h-14 border border-[#e5e8ec] bg-white flex items-center justify-center overflow-hidden shrink-0">
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
                  <p className="font-['Outfit'] font-bold text-[#0d1117] group-hover:text-[#001f3f] transition-colors">{developer.name}</p>
                  {developer.is_verified && (
                    <span className="text-xs text-[#15803d] flex items-center gap-1 mt-0.5"><CheckCircle2 className="w-3 h-3" /> Verified</span>
                  )}
                </div>
              </Link>
              {(developer.website_url || developer.email) && (
                <div className="mt-4 pt-4 border-t border-[#eef0f3] flex flex-col gap-2">
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
              )}
              <div className="mt-4 pt-4 border-t border-[#eef0f3]">
                <Link
                  href={`/${developer.slug}`}
                  className="inline-flex items-center gap-1.5 text-sm font-bold text-[#001f3f] hover:text-[#d6b357] transition-colors"
                >
                  View Developer Profile <ArrowLeft className="w-4 h-4 rotate-180" />
                </Link>
              </div>
            </SidePanel>
          )}

          {/* Payment plan */}
          {(project.down_payment_percentage || project.payment_plan_details || project.installment_available) && (
            <SidePanel title="Payment Plan">
              <div className="space-y-3">
                {project.down_payment_percentage && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[#6b7280]">Down Payment</span>
                    <span className="font-bold text-[#0d1117]">{project.down_payment_percentage}%</span>
                  </div>
                )}
                {project.government_fee_percentage && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[#6b7280]">DLD Fee</span>
                    <span className="font-bold text-[#0d1117]">{project.government_fee_percentage}%</span>
                  </div>
                )}
                {project.installment_available && (
                  <div className="flex items-center gap-2 text-sm font-semibold text-[#15803d]">
                    <CheckCircle2 className="w-4 h-4" /> Installment Available
                  </div>
                )}
                {project.payment_plan_details && (
                  <p className="text-xs text-[#6b7280] leading-relaxed pt-2 border-t border-[#eef0f3]">{project.payment_plan_details}</p>
                )}
              </div>
            </SidePanel>
          )}

          {/* Quick facts — 2-col icon grid, like the mockup (built from real
              fields; the mockup's own box had garbled labels). */}
          {quickFacts.length > 0 && (
            <SidePanel title="Quick Facts">
              <div className="grid grid-cols-2 gap-x-6 gap-y-5">
                {quickFacts.map(({ icon: Icon, label, value }) => (
                  <div key={label} className="flex items-start gap-2.5">
                    <Icon className="w-4 h-4 text-[#d6b357] shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="text-[11px] text-[#6b7280]">{label}</p>
                      <p className="text-[13px] font-semibold text-[#0d1117] leading-snug">{value}</p>
                    </div>
                  </div>
                ))}
              </div>
            </SidePanel>
          )}

          {/* Inquire Now — lead capture, with direct contact as secondary links */}
          <SidePanel title="Inquire Now" className="lg:sticky lg:top-24">
            <p className="text-sm text-[#6b7280] leading-relaxed">
              Leave your details and our team will reach out with availability, payment plans and exclusive offers.
            </p>
            <div className="mt-4">
              <ProjectInquireForm
                projectId={Number(project.id)}
                projectName={project.name}
                defaultCategory={project.status === "completed" ? "ready" : "off_plan"}
              />
            </div>
            <div className="mt-4 pt-4 border-t border-[#eef0f3] flex flex-col gap-2">
              {(project.sales_contact_phone || developer?.phone) && (
                <a href={`tel:${project.sales_contact_phone ?? developer?.phone}`}
                  className="inline-flex items-center gap-2 text-[13px] font-semibold text-[#001f3f] hover:text-[#c8a544] transition-colors">
                  <Phone className="w-3.5 h-3.5 text-[#d6b357]" /> {project.sales_contact_phone ?? "Call our team"}
                </a>
              )}
              <a href={`mailto:${project.sales_contact_email ?? "info@fhiglobal.ae"}`}
                className="inline-flex items-center gap-2 text-[13px] font-semibold text-[#001f3f] hover:text-[#c8a544] transition-colors">
                <Mail className="w-3.5 h-3.5 text-[#d6b357]" /> {project.sales_contact_email ?? "info@fhiglobal.ae"}
              </a>
            </div>
          </SidePanel>
        </div>
      </div>

      <Footer />
    </div>
    </>
  )
}

// ── Flat-layout helpers (approved mockup): headings live on the page, not in
//    cards, and every surface is square. ──────────────────────────────────────
function SectionHeading({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-end justify-between gap-4">
        <h2 className="font-['Outfit'] text-[19px] font-bold uppercase tracking-[0.1em] text-[#0d1117]">
          {title}
        </h2>
        {action}
      </div>
      <div className="h-px bg-[#e5e8ec] mt-3" />
    </div>
  )
}

function SidePanel({ title, children, className = "" }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <p className="font-['Outfit'] text-[13px] font-bold uppercase tracking-[0.16em] text-[#0d1117] mb-3">
        {title}
      </p>
      <div className="border border-[#e5e8ec] bg-white p-6">{children}</div>
    </div>
  )
}
