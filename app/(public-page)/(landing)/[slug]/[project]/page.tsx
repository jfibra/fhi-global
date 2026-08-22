import type { Metadata } from "next"
import Image from "next/image"
import { notFound, permanentRedirect } from "next/navigation"
import Link from "next/link"
import { createPublicSupabaseClient } from "@/lib/supabase/public"
import { createPageMetadata, truncateDescription } from "@/lib/seo"
import { fetchSectionPage } from "@/lib/sitemap-sections"
import { breadcrumbList, realEstateListingSchema } from "@/lib/structured-data"
import { JsonLd } from "@/components/json-ld"
import { TopBar } from "@/components/topbar"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { SocialShare } from "@/components/social-share"
import { ProjectGallery } from "@/components/public/project-gallery"
import { PdfPagePreviews } from "@/components/public/pdf-page-previews"
import { AmenitiesGrid, NearbyPlaces } from "@/components/public/amenities-grid"
import { ProjectInquireForm } from "@/components/public/project-inquire-form"
import { ProjectLocationMap } from "@/components/public/project-location-map"
import {
  MapPin, Building2, Calendar, Home, Layers, Phone, Mail, ArrowLeft,
  CheckCircle2, Play, Globe, BedDouble, Bath, Maximize2, DollarSign,
  TrendingUp, Star
} from "lucide-react"

export const revalidate = 120

/**
 * Prerender the published catalog (only in production) so these pages serve
 * from the ISR cache instead of cold SSR on every crawl. Reuses the sitemap's
 * enumeration — same table, same published filters. New projects still render
 * on demand (dynamicParams defaults to true) and are cached on first hit.
 */
export async function generateStaticParams(): Promise<{ slug: string; project: string }[]> {
  if (process.env.VERCEL_ENV !== "production") return []
  try {
    const rows = await fetchSectionPage("projects", 1)
    return (rows ?? []).flatMap((r) =>
      r.slug && r.developers?.slug ? [{ slug: r.developers.slug, project: r.slug }] : [],
    )
  } catch {
    return []
  }
}

// slug = the developer's slug (the parent segment), project = the project's.
type Props = { params: Promise<{ slug: string; project: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug: devSlug, project: slug } = await params
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://fhiglobal.ae"
  const supabase = createPublicSupabaseClient()
  const { data, error } = await supabase
    .from("projects")
    .select("name, description, meta_title, meta_description, main_image, city, location, developers(slug)")
    .eq("slug", slug)
    .eq("is_published", true)
    .is("deleted_at", null)
    .maybeSingle()
  // Transient failure → 5xx; only a clean miss may 404 (an outage-time
  // notFound() would be ISR-cached as a hard 404 over a live page).
  if (error) throw new Error("Failed to load project")
  // notFound() here, not a placeholder title: returning metadata lets the
  // route start streaming, after which the page body's notFound() can only
  // swap the UI — the 200 is already on the wire. Aborting in metadata is
  // what turns a dead project URL into a real HTTP 404.
  if (!data) notFound()
  // Wrong developer segment: the page body issues the permanent redirect to
  // the canonical pair; metadata just needs to not claim the wrong URL.
  const devRel = data.developers as unknown as { slug: string | null } | null
  if (devRel?.slug && devRel.slug !== devSlug) return { title: data.meta_title ?? data.name }

  // Curated meta titles render verbatim (absolute bypasses the layout's
  // "%s | FHI Global" template); bare names get the template's single brand.
  const title = data.meta_title ? { absolute: data.meta_title } : data.name
  const locality = [data.location, data.city].filter(Boolean).join(", ")
  const description =
    truncateDescription(data.meta_description) ||
    truncateDescription(data.description) ||
    `Discover ${data.name}${locality ? ` in ${locality}` : ""} — a premium real estate project in Dubai on FHI Global.`
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
    .eq("is_published", true)
    .is("deleted_at", null)
    .maybeSingle()

  if (projectError) {
    console.error("[project-detail] query error:", projectError.message, projectError.details)
    // 5xx, not 404: a transient failure must never deindex (or ISR-cache a
    // 404 over) a live project page.
    throw new Error("Failed to load project")
  }
  if (!project) notFound()

  const status = STATUS_STYLES[project.status] ?? { label: project.status, bg: "#f3f4f6", text: "#374151", border: "#e5e7eb" }
  const price = formatPrice(project.launch_price_from, project.launch_price_to, project.currency)
  const locationStr = [project.community, project.location, project.city].filter(Boolean).join(", ")
  const mapsApiKey =
    process.env.GOOGLE_MAPS_API_KEY?.trim() || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() || ""
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
  // Masthead collage — the main image plus gallery shots, four at most.
  const mastheadImages = [project.main_image as string | null, ...images.map((i) => i.image_url)]
    .filter((u, idx, arr): u is string => Boolean(u) && arr.indexOf(u) === idx)
    .slice(0, 4)
  const listingSchema = realEstateListingSchema({
    name: project.name,
    description: project.meta_description || project.description || project.about_project || project.name,
    path: `/${developer.slug}/${project.slug}`,
    images: [project.main_image, ...images.map((image) => image.image_url)],
    price: project.launch_price_from,
    currency: project.currency,
    city: project.city,
    street: [project.location, project.community].filter(Boolean).join(", ") || null,
    latitude: project.latitude,
    longitude: project.longitude,
    seller: { name: developer.name, path: developer.slug ? `/${developer.slug}` : null },
  })

  return (
    <>
    <JsonLd
      schema={[
        listingSchema,
        breadcrumbList([
          { name: "Home", path: "/" },
          { name: "Projects", path: "/projects" },
          { name: developer.name, path: `/${developer.slug}` },
          { name: project.name },
        ]),
      ]}
    />
    {/* No overflow-x-hidden here: overflow on an ancestor disables
        position:sticky for the whole subtree (the Inquire Now panel).
        Sections that need clipping (the hero) clip themselves. */}
    <div className="relative min-h-screen bg-[#fafafa] font-sans">
      <TopBar />
      <Header />

      {/* ── Masthead — light editorial header (approved mockup): navy type
             on white, gold caps labels with hairline dividers, the photo
             filling the right half, and the navy stats band anchoring it.
             On mobile the photo slots in right after the title. */}
      <section className="relative overflow-hidden bg-white">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-10 lg:pr-[46%] lg:min-h-[430px]">
          <div className="flex items-center gap-3 mb-3">
            <span className="h-px w-10 bg-[#d6b357]" aria-hidden="true" />
            <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#b8913f]">
              {status.label}
            </span>
            {project.is_featured && (
              <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#9ca3af]">Featured</span>
            )}
          </div>

          <h1 className="font-['Outfit'] text-3xl md:text-[42px] font-bold text-[#001f3f] leading-[1.08]">
            {project.name}
          </h1>

          {/* The photos — a collage of up to four fills the masthead's right
              half on desktop, running all the way down past the stats band;
              on mobile it sits between the title and the facts. */}
          <div className="relative mt-6 aspect-[16/10] bg-[#001f3f] lg:absolute lg:inset-y-0 lg:right-0 lg:left-[56%] lg:z-10 lg:mt-0 lg:aspect-auto">
            {mastheadImages.length === 0 ? (
              <div className="absolute inset-0 flex items-center justify-center">
                <Building2 className="w-14 h-14 text-[#d6b357]/50" />
              </div>
            ) : mastheadImages.length === 1 ? (
              <Image
                src={mastheadImages[0]}
                alt={project.name}
                fill
                priority
                sizes="(min-width: 1024px) 44vw, 100vw"
                className="object-cover"
              />
            ) : (
              <div className={`absolute inset-0 grid grid-cols-2 gap-[3px] bg-white ${mastheadImages.length > 2 ? "grid-rows-2" : ""}`}>
                {mastheadImages.map((url, i) => (
                  <div
                    key={url}
                    className={`relative overflow-hidden ${mastheadImages.length === 3 && i === 0 ? "row-span-2" : ""}`}
                  >
                    <Image
                      src={url}
                      alt={`${project.name} — photo ${i + 1}`}
                      fill
                      priority={i === 0}
                      sizes="(min-width: 1024px) 22vw, 50vw"
                      className="object-cover"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Fact columns — Developer / Location / Type / Status / Price with
              hairline dividers. Empty fields drop out, never a dash. */}
          <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-5 sm:flex sm:flex-wrap sm:gap-x-0 sm:gap-y-4">
            {[
              {
                label: "Developer",
                node: developer
                  ? (developer.slug
                      ? <Link href={`/${developer.slug}`} className="hover:text-[#b8913f] transition-colors">{developer.name}</Link>
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
                <div
                  key={f.label}
                  className="sm:max-w-[250px] sm:pr-7 sm:mr-7 sm:border-r sm:border-[#e8eaed] sm:last:mr-0 sm:last:border-0 sm:last:pr-0"
                >
                  <dt className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#b8913f] mb-1.5">
                    {f.label}
                  </dt>
                  <dd className="text-[15px] font-semibold text-[#001f3f] leading-snug">
                    {f.node}
                  </dd>
                </div>
              ))}
          </dl>

          {/* Share — slim strip of boxed icons. */}
          <div className="mt-7 flex flex-wrap items-start gap-x-5 gap-y-2">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#9ca3af] pt-3">Share</p>
            <SocialShare
              title={`${project.name} | FHI Global`}
              text={`Discover ${project.name} on FHI Global.`}
              variant="bare-light"
            />
          </div>
        </div>

        {/* ── Quick stats band — inside the masthead so the photo runs all
               the way down past it; on desktop it only shows left of the
               photo. Omitted when a project carries no stats. ── */}
        {quickStats.length > 0 && (
        <div className="relative bg-[#001f3f] border-b border-[#d6b357]/25">
          <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-4 lg:pr-[46%] flex flex-wrap gap-x-10 gap-y-3">
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
              <div key={label} className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full border-2 border-[#d6b357]/60 bg-[#d6b357]/10 flex items-center justify-center shrink-0">
                  <Icon className="w-4 h-4 text-[#d6b357]" />
                </div>
                <div>
                  <p className="text-[10px] text-white/60 font-bold uppercase tracking-widest">{label}</p>
                  <p className="font-['Outfit'] text-base font-bold text-white leading-tight">{value}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
        )}
      </section>

      {/* Back link — under the band, out of the masthead's way. */}
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
                <ProjectGallery
                  images={images}
                  projectName={project.name}
                  location={project.city ?? project.location}
                />
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

          {/* Location — 3D aerial / satellite / Street View */}
          {mapsApiKey && locationStr && (
            <section>
              <SectionHeading title="Location" />
              <div className="mt-5">
                <ProjectLocationMap
                  apiKey={mapsApiKey}
                  projectName={project.name}
                  address={locationStr}
                  lat={project.latitude ? Number(project.latitude) : null}
                  lng={project.longitude ? Number(project.longitude) : null}
                />
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
                        <Image src={u.file_url} alt={u.title} width={48} height={48} className="w-full h-full object-cover" />
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
