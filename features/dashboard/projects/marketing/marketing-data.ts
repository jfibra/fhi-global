// Client-side assembler that turns a Project row + its child tables into the
// normalized shape the Poster Studio and Reels Studio render from. Mirrors the
// listing-side lib/flyer/marketing-data.ts pattern, but for PROJECTS.

import {
  type Project,
  fetchProjectImages,
  fetchProjectFeatures,
  fetchProjectAmenities,
  fetchAmenities,
} from "@/lib/project-service"
import { createClient } from "@/lib/supabase/client"
import { SITE_URL } from "@/lib/seo"

export type ProjectMarketingData = {
  name: string
  statusLabel: string
  developerName: string
  developerLogo: string | null
  priceFrom: number | null
  currency: string
  /** Optional free-text override for the poster's price line — when set, the
   *  designs render it verbatim instead of formatting priceFrom. */
  priceLabel?: string | null
  locationLine: string
  handoverLabel: string | null
  /** Gallery URLs, cover first then by rank. */
  gallery: string[]
  /** Selling-point bullets from project_features. */
  features: string[]
  /** Amenity names for this project. */
  amenities: string[]
  contactPhone: string | null
  contactEmail: string | null
  /** Public project page — QR target. */
  publicUrl: string
  /** Short description, used as the default poster headline. */
  tagline: string
}

export const PROJECT_STATUS_POSTER_LABELS: Record<Project["status"], string> = {
  pre_launch: "Pre-Launch",
  launch: "New Launch",
  under_construction: "Under Construction",
  completed: "Ready to Move",
}

function quarterOf(dateStr: string): string | null {
  // Postgres DATE columns arrive as "YYYY-MM-DD" — parse the fields directly
  // to avoid the UTC-midnight/local-getter off-by-one at quarter boundaries.
  const m = /^(\d{4})-(\d{2})/.exec(dateStr)
  if (!m) return null
  const year = Number(m[1])
  const month = Number(m[2])
  if (month < 1 || month > 12) return null
  return `Q${Math.ceil(month / 3)} ${year}`
}

export function handoverLabelFor(project: Project): string | null {
  if (project.delivery_quarter?.trim()) return project.delivery_quarter.trim()
  const src = project.delivery_date ?? project.expected_completion_date
  return src ? quarterOf(src) : null
}

export function locationLineFor(project: Project): string {
  const area = project.location?.trim() || project.community?.trim() || project.sub_community?.trim() || ""
  const city = project.city?.trim() || "Dubai"
  // avoid "Business Bay, Dubai, Dubai" / "Dubai, Dubai"
  if (!area || area.toLowerCase().includes(city.toLowerCase())) return area || city
  return `${area}, ${city}`
}

/** Rows returned by createProject/duplicateProject lack the developers join —
 *  fall back to fetching the developer directly so branding never goes blank. */
async function resolveDeveloper(project: Project): Promise<{ name: string; logo_url: string | null; slug: string | null }> {
  if (project.developers?.name) {
    return { name: project.developers.name, logo_url: project.developers.logo_url ?? null, slug: project.developers.slug ?? null }
  }
  if (!project.developer_id) return { name: "", logo_url: null, slug: null }
  const { data } = await createClient()
    .from("developers")
    .select("name, logo_url, slug")
    .eq("id", project.developer_id)
    .maybeSingle()
  const dev = data as { name: string; logo_url: string | null; slug: string | null } | null
  return { name: dev?.name ?? "", logo_url: dev?.logo_url ?? null, slug: dev?.slug ?? null }
}

export async function assembleProjectMarketing(project: Project): Promise<ProjectMarketingData> {
  const [imagesRes, featuresRes, amenityIdsRes, amenitiesRes, developer] = await Promise.all([
    fetchProjectImages(project.id),
    fetchProjectFeatures(project.id),
    fetchProjectAmenities(project.id),
    fetchAmenities(),
    resolveDeveloper(project),
  ])

  // Cover first, then by rank; fall back to the denormalized main_image.
  const images = imagesRes.data
  const gallery = [
    ...images.filter((i) => i.is_main).map((i) => i.url),
    ...images.filter((i) => !i.is_main).map((i) => i.url),
  ]
  if (gallery.length === 0 && project.main_image) gallery.push(project.main_image)

  const amenityNameById = new Map(amenitiesRes.data.map((a) => [a.id, a.name]))
  const amenities = amenityIdsRes.data
    .map((id) => amenityNameById.get(id))
    .filter((n): n is string => Boolean(n))

  return {
    name: project.name,
    statusLabel: PROJECT_STATUS_POSTER_LABELS[project.status] ?? "New Launch",
    developerName: developer.name,
    developerLogo: developer.logo_url,
    priceFrom: project.launch_price_from,
    currency: project.currency?.trim() || "AED",
    locationLine: locationLineFor(project),
    handoverLabel: handoverLabelFor(project),
    gallery,
    features: featuresRes.data.map((f) => f.description).filter(Boolean),
    amenities,
    contactPhone: project.sales_contact_phone?.trim() || null,
    contactEmail: project.sales_contact_email?.trim() || null,
    publicUrl: developer.slug
      ? `${SITE_URL}/${developer.slug}/${project.slug}`
      : `${SITE_URL}/projects/${project.slug}`,
    tagline: project.description?.trim() || "",
  }
}
