import { createClient } from "@/lib/supabase/client"

// ─── Types ─────────────────────────────────────────────────────────────────────

/** Which agent Buy/Rent listing views include this project (admins can set all; developers create sale-only). */
export type ProjectListingType = "sale" | "rent" | "both"

export const PROJECT_LISTING_TYPE_LABELS: Record<ProjectListingType, string> = {
  sale: "For sale only",
  rent: "For rent only",
  both: "Sale & rent",
}

/** Compact label for badges and tables. */
export const PROJECT_LISTING_TYPE_SHORT: Record<ProjectListingType, string> = {
  sale: "Sale",
  rent: "Rent",
  both: "Both",
}

export type Project = {
  id: number
  uuid: string
  name: string
  slug: string
  listing_type: ProjectListingType
  description: string | null
  about_project: string | null
  status: "pre_launch" | "launch" | "under_construction" | "completed"
  developer_id: string | null
  location: string | null
  region: string | null
  community: string | null
  sub_community: string | null
  city: string | null
  country: string | null
  latitude: string | null
  longitude: string | null
  launch_price_from: number | null
  launch_price_to: number | null
  currency: string | null
  government_fee_percentage: number | null
  down_payment_percentage: number | null
  payment_plan_details: string | null
  installment_available: boolean
  booking_date: string | null
  construction_start_date: string | null
  expected_completion_date: string | null
  delivery_date: string | null
  delivery_quarter: string | null
  number_of_buildings: number | null
  total_units: number | null
  floors: number | null
  main_image: string | null
  floor_plans: string | null
  video_url: string | null
  meta_title: string | null
  meta_description: string | null
  is_featured: boolean
  is_premium: boolean
  views_count: number
  expected_roi: number | null
  rental_yield: number | null
  freehold: boolean
  ownership_type: string | null
  sales_contact_phone: string | null
  sales_contact_email: string | null
  direct_from_developer: boolean
  rating: number
  reviews_count: number
  is_active: boolean
  is_published: boolean
  published_at: string | null
  created_by: string | null
  updated_by: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
  developers?: { name: string; logo_url: string | null; slug?: string | null } | null
}

export type ProjectUnit = {
  id: number
  project_id: number | null
  unit_type: string
  layout_name: string | null
  bedrooms: number | null
  bathrooms: number | null
  size_sqft: number | null
  size_sqm: number | null
  price_from: number | null
  price_to: number | null
  floor_plan_image: string | null
  available_units: number | null
  is_available: boolean
  created_at: string
  updated_at: string
}

export type ProjectImage = {
  id: number
  project_id: number | null
  url: string
  thumb: string | null
  is_main: boolean
  rank: number
}

export type ProjectMedia = {
  id: number
  project_id: number | null
  media_type: "video" | "virtual_tour"
  url: string
}

export type ProjectFeature = {
  id: number
  project_id: number | null
  description: string
}

export type ProjectKeyword = {
  id: number
  project_id: number | null
  keyword: string
}

export type ProjectNeighbor = {
  id: number
  project_id: number | null
  category: "school" | "hospital" | "shopping" | null
  description: string
}

export type ProjectPoint = {
  id: number
  project_id: number | null
  category: "attraction" | "transport" | "school" | "hospital" | "shopping" | null
  description: string | null
}

export type Developer = {
  id: string
  name: string
  slug: string
  logo_url: string | null
  is_active: boolean
  is_verified: boolean
}

export type Amenity = {
  id: number
  name: string
}

export type PropertyType = {
  id: number
  name: string
}

export type ProjectStats = {
  images: number
  media: number
  units: number
  features: number
  amenities: number
  property_types: number
  keywords: number
  neighbors: number
}

export type ProjectFormData = Partial<Omit<Project, "id" | "uuid" | "developers" | "created_at" | "updated_at" | "deleted_at" | "views_count" | "rating" | "reviews_count">>

// ─── Helpers ───────────────────────────────────────────────────────────────────

export function generateProjectSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
}

async function projectSlugExists(
  supabase: ReturnType<typeof createClient>,
  slug: string,
): Promise<boolean> {
  const { count, error } = await supabase
    .from("projects")
    .select("id", { count: "exact", head: true })
    .eq("slug", slug)

  if (error) return true
  return (count ?? 0) > 0
}

/** Resolves a base slug to one not present on any project row (including soft-deleted). */
async function allocateUniqueProjectSlug(
  supabase: ReturnType<typeof createClient>,
  baseSlug: string,
): Promise<string> {
  let slug = baseSlug.replace(/^-+|-+$/g, "")
  if (!slug) slug = "project"

  if (!(await projectSlugExists(supabase, slug))) return slug

  for (let attempt = 0; attempt < 25; attempt++) {
    const candidate = `${slug}-${Math.random().toString(36).slice(2, 8)}`
    if (!(await projectSlugExists(supabase, candidate))) return candidate
  }
  return `${slug}-${Date.now()}`
}

const NULLABLE_STRING_FIELDS = new Set<keyof ProjectFormData>([
  "developer_id",
  "description",
  "about_project",
  "location",
  "region",
  "community",
  "sub_community",
  "city",
  "country",
  "latitude",
  "longitude",
  "currency",
  "payment_plan_details",
  "booking_date",
  "construction_start_date",
  "expected_completion_date",
  "delivery_date",
  "delivery_quarter",
  "main_image",
  "floor_plans",
  "video_url",
  "ownership_type",
  "sales_contact_phone",
  "sales_contact_email",
  "meta_title",
  "meta_description",
  "published_at",
])

function sanitizeProjectPatch(form: Partial<ProjectFormData>): Partial<ProjectFormData> {
  const patch: Record<string, unknown> = { ...form }

  for (const key of NULLABLE_STRING_FIELDS) {
    const value = patch[key as string]
    if (typeof value === "string" && value.trim() === "") {
      patch[key as string] = null
    }
  }

  return patch as Partial<ProjectFormData>
}

// ─── Projects ──────────────────────────────────────────────────────────────────

export async function fetchProjects(params: {
  page?: number
  perPage?: number
  search?: string
  developerId?: string
  status?: string
  isActive?: boolean | null
  isPublished?: boolean | null
}): Promise<{ data: Project[]; total: number; error: string | null }> {
  const supabase = createClient()
  const page = params.page ?? 1
  const perPage = params.perPage ?? 20
  const from = (page - 1) * perPage
  const to = from + perPage - 1

  let q = supabase
    .from("projects")
    .select("id, uuid, name, slug, listing_type, status, developer_id, city, country, main_image, is_active, is_published, is_featured, is_premium, launch_price_from, launch_price_to, currency, created_at, updated_at, deleted_at, developers(name, logo_url)", { count: "exact" })
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .range(from, to)

  if (params.search) {
    const t = `%${params.search}%`
    q = q.or(`name.ilike.${t},city.ilike.${t},country.ilike.${t}`)
  }
  if (params.developerId) q = q.eq("developer_id", params.developerId)
  if (params.status) q = q.eq("status", params.status)
  if (params.isActive !== undefined && params.isActive !== null) q = q.eq("is_active", params.isActive)
  if (params.isPublished !== undefined && params.isPublished !== null) q = q.eq("is_published", params.isPublished)

  const { data, count, error } = await q
  if (error) return { data: [], total: 0, error: error.message }
  return { data: (data ?? []) as unknown as Project[], total: count ?? 0, error: null }
}

export async function fetchProject(id: number): Promise<{ data: Project | null; error: string | null }> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("projects")
    .select("*, developers(name, logo_url, slug)")
    .eq("id", id)
    .is("deleted_at", null)
    .single()

  if (error) return { data: null, error: error.message }
  return { data: data as unknown as Project, error: null }
}

/**
 * Same as fetchProject but keyed by slug — the dashboard detail route is
 * /{role}/projects/{slug}. Slugs are allocated unique by
 * allocateUniqueProjectSlug, so maybeSingle is safe here.
 */
export async function fetchProjectBySlug(slug: string): Promise<{ data: Project | null; error: string | null }> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("projects")
    .select("*, developers(name, logo_url, slug)")
    .eq("slug", slug)
    .is("deleted_at", null)
    .maybeSingle()

  if (error) return { data: null, error: error.message }
  if (!data) return { data: null, error: "Project not found" }
  return { data: data as unknown as Project, error: null }
}

export async function createProject(form: ProjectFormData): Promise<{ data: Project | null; error: string | null }> {
  const supabase = createClient()
  const name = form.name?.trim() ?? ""
  const rawSlug = form.slug?.trim()
  const baseSlug = rawSlug ? generateProjectSlug(rawSlug) : generateProjectSlug(name)
  const slug = await allocateUniqueProjectSlug(supabase, baseSlug)

  const { data, error } = await supabase
    .from("projects")
    .insert({ ...form, slug, updated_at: new Date().toISOString() })
    .select()
    .single()

  if (error) return { data: null, error: error.message }
  return { data: data as Project, error: null }
}

export async function updateProject(id: number, form: Partial<ProjectFormData>): Promise<{ error: string | null }> {
  const supabase = createClient()
  const payload = sanitizeProjectPatch(form)
  const { error } = await supabase
    .from("projects")
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq("id", id)

  return { error: error?.message ?? null }
}

export async function softDeleteProject(id: number): Promise<{ error: string | null }> {
  const supabase = createClient()
  const { error } = await supabase
    .from("projects")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)

  return { error: error?.message ?? null }
}

export async function publishProject(id: number, publish: boolean): Promise<{ error: string | null }> {
  const supabase = createClient()
  const { error } = await supabase
    .from("projects")
    .update({
      is_published: publish,
      published_at: publish ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)

  return { error: error?.message ?? null }
}

export async function duplicateProject(id: number): Promise<{ data: Project | null; error: string | null }> {
  const supabase = createClient()
  const { data: src, error: fetchErr } = await supabase
    .from("projects")
    .select("*")
    .eq("id", id)
    .single()

  if (fetchErr || !src) return { data: null, error: fetchErr?.message ?? "Not found" }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { id: _id, uuid: _uuid, created_at: _ca, updated_at: _ua, deleted_at: _da, published_at: _pa, ...rest } = src as Record<string, unknown>
  const slug = `${rest.slug as string}-copy-${Date.now()}`
  const name = `${rest.name as string} (Copy)`

  const { data: dup, error: insErr } = await supabase
    .from("projects")
    .insert({ ...rest, name, slug, is_published: false, published_at: null })
    .select()
    .single()

  if (insErr) return { data: null, error: insErr.message }
  return { data: dup as Project, error: null }
}

// ─── Units ─────────────────────────────────────────────────────────────────────

export async function fetchProjectUnits(projectId: number): Promise<{ data: ProjectUnit[]; error: string | null }> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("project_units")
    .select("*")
    .eq("project_id", projectId)
    .order("id", { ascending: true })

  if (error) return { data: [], error: error.message }
  return { data: (data ?? []) as ProjectUnit[], error: null }
}

export async function upsertProjectUnit(unit: Partial<ProjectUnit> & { project_id: number }): Promise<{ error: string | null }> {
  const supabase = createClient()
  const { error } = unit.id
    ? await supabase.from("project_units").update({ ...unit, updated_at: new Date().toISOString() }).eq("id", unit.id)
    : await supabase.from("project_units").insert({ ...unit })

  return { error: error?.message ?? null }
}

export async function deleteProjectUnit(id: number): Promise<{ error: string | null }> {
  const supabase = createClient()
  const { error } = await supabase.from("project_units").delete().eq("id", id)
  return { error: error?.message ?? null }
}

// ─── Images ────────────────────────────────────────────────────────────────────

export async function fetchProjectImages(projectId: number): Promise<{ data: ProjectImage[]; error: string | null }> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("project_images")
    .select("*")
    .eq("project_id", projectId)
    .order("rank", { ascending: true })

  if (error) return { data: [], error: error.message }
  return { data: (data ?? []) as ProjectImage[], error: null }
}

export async function addProjectImage(
  projectId: number,
  url: string,
  thumb: string | null,
  rank: number,
): Promise<{ data: ProjectImage | null; error: string | null }> {
  const supabase = createClient()
  const { count, error: countErr } = await supabase
    .from("project_images")
    .select("*", { count: "exact", head: true })
    .eq("project_id", projectId)
  if (countErr) return { data: null, error: countErr.message }
  const n = count ?? 0
  const isFirst = n === 0
  const insertRank = rank > 0 ? rank : n + 1

  const { data: inserted, error } = await supabase
    .from("project_images")
    .insert({
      project_id: projectId,
      url,
      thumb,
      rank: insertRank,
      is_main: isFirst,
    })
    .select()
    .single()
  if (error) return { data: null, error: error.message }

  if (isFirst) {
    const { error: pErr } = await supabase.from("projects").update({ main_image: url }).eq("id", projectId)
    return { data: inserted as ProjectImage, error: pErr?.message ?? null }
  }
  return { data: inserted as ProjectImage, error: null }
}

export async function setMainImage(projectId: number, imageId: number): Promise<{ error: string | null }> {
  const supabase = createClient()
  const { data: row, error: fetchErr } = await supabase
    .from("project_images")
    .select("url")
    .eq("id", imageId)
    .eq("project_id", projectId)
    .maybeSingle()
  if (fetchErr) return { error: fetchErr.message }
  if (!row?.url) return { error: "Image not found" }

  await supabase.from("project_images").update({ is_main: false }).eq("project_id", projectId)
  const { error } = await supabase.from("project_images").update({ is_main: true }).eq("id", imageId)
  if (error) return { error: error.message }

  const { error: pErr } = await supabase.from("projects").update({ main_image: row.url }).eq("id", projectId)
  return { error: pErr?.message ?? null }
}

export async function deleteProjectImage(id: number): Promise<{ error: string | null }> {
  const supabase = createClient()
  const { data: img, error: fetchErr } = await supabase
    .from("project_images")
    .select("project_id, is_main, url")
    .eq("id", id)
    .maybeSingle()
  if (fetchErr) return { error: fetchErr.message }
  if (!img) return { error: "Image not found" }

  const { error } = await supabase.from("project_images").delete().eq("id", id)
  if (error) return { error: error.message }

  if (!img.is_main) return { error: null }

  const { data: next } = await supabase
    .from("project_images")
    .select("id, url")
    .eq("project_id", img.project_id)
    .order("rank", { ascending: true })
    .order("id", { ascending: true })
    .limit(1)
    .maybeSingle()

  if (next?.url) {
    await supabase.from("project_images").update({ is_main: true }).eq("id", next.id)
    const { error: pErr } = await supabase
      .from("projects")
      .update({ main_image: next.url })
      .eq("id", img.project_id)
    return { error: pErr?.message ?? null }
  }

  const { error: pErr } = await supabase.from("projects").update({ main_image: null }).eq("id", img.project_id)
  return { error: pErr?.message ?? null }
}

export async function updateImageRank(id: number, rank: number): Promise<{ error: string | null }> {
  const supabase = createClient()
  const { error } = await supabase.from("project_images").update({ rank }).eq("id", id)
  return { error: error?.message ?? null }
}

// ─── Media ─────────────────────────────────────────────────────────────────────

export async function fetchProjectMedia(projectId: number): Promise<{ data: ProjectMedia[]; error: string | null }> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("project_media")
    .select("*")
    .eq("project_id", projectId)
    .order("id", { ascending: true })

  if (error) return { data: [], error: error.message }
  return { data: (data ?? []) as ProjectMedia[], error: null }
}

export async function upsertProjectMedia(media: Partial<ProjectMedia> & { project_id: number }): Promise<{ error: string | null }> {
  const supabase = createClient()
  const { error } = media.id
    ? await supabase.from("project_media").update(media).eq("id", media.id)
    : await supabase.from("project_media").insert(media)

  return { error: error?.message ?? null }
}

export async function deleteProjectMedia(id: number): Promise<{ error: string | null }> {
  const supabase = createClient()
  const { error } = await supabase.from("project_media").delete().eq("id", id)
  return { error: error?.message ?? null }
}

// ─── Features ──────────────────────────────────────────────────────────────────

export async function fetchProjectFeatures(projectId: number): Promise<{ data: ProjectFeature[]; error: string | null }> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("project_features")
    .select("*")
    .eq("project_id", projectId)
    .order("id", { ascending: true })

  if (error) return { data: [], error: error.message }
  return { data: (data ?? []) as ProjectFeature[], error: null }
}

export async function addProjectFeature(projectId: number, description: string): Promise<{ error: string | null }> {
  const supabase = createClient()
  const { error } = await supabase.from("project_features").insert({ project_id: projectId, description })
  return { error: error?.message ?? null }
}

export async function deleteProjectFeature(id: number): Promise<{ error: string | null }> {
  const supabase = createClient()
  const { error } = await supabase.from("project_features").delete().eq("id", id)
  return { error: error?.message ?? null }
}

// ─── Keywords / SEO ────────────────────────────────────────────────────────────

export async function fetchProjectKeywords(projectId: number): Promise<{ data: ProjectKeyword[]; error: string | null }> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("project_keywords")
    .select("*")
    .eq("project_id", projectId)
    .order("id", { ascending: true })

  if (error) return { data: [], error: error.message }
  return { data: (data ?? []) as ProjectKeyword[], error: null }
}

export async function syncProjectKeywords(projectId: number, keywords: string[]): Promise<{ error: string | null }> {
  const supabase = createClient()
  await supabase.from("project_keywords").delete().eq("project_id", projectId)
  if (!keywords.length) return { error: null }
  const { error } = await supabase
    .from("project_keywords")
    .insert(keywords.map(keyword => ({ project_id: projectId, keyword })))

  return { error: error?.message ?? null }
}

// ─── Neighbors ─────────────────────────────────────────────────────────────────

export async function fetchProjectNeighbors(projectId: number): Promise<{ data: ProjectNeighbor[]; error: string | null }> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("project_neighbors")
    .select("*")
    .eq("project_id", projectId)
    .order("id", { ascending: true })

  if (error) return { data: [], error: error.message }
  return { data: (data ?? []) as ProjectNeighbor[], error: null }
}

export async function upsertProjectNeighbor(n: Partial<ProjectNeighbor> & { project_id: number }): Promise<{ error: string | null }> {
  const supabase = createClient()
  const { error } = n.id
    ? await supabase.from("project_neighbors").update(n).eq("id", n.id)
    : await supabase.from("project_neighbors").insert(n)
  return { error: error?.message ?? null }
}

export async function deleteProjectNeighbor(id: number): Promise<{ error: string | null }> {
  const supabase = createClient()
  const { error } = await supabase.from("project_neighbors").delete().eq("id", id)
  return { error: error?.message ?? null }
}

// ─── Points ────────────────────────────────────────────────────────────────────

export async function fetchProjectPoints(projectId: number): Promise<{ data: ProjectPoint[]; error: string | null }> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("project_points")
    .select("*")
    .eq("project_id", projectId)
    .order("id", { ascending: true })

  if (error) return { data: [], error: error.message }
  return { data: (data ?? []) as ProjectPoint[], error: null }
}

export async function upsertProjectPoint(p: Partial<ProjectPoint> & { project_id: number }): Promise<{ error: string | null }> {
  const supabase = createClient()
  const { error } = p.id
    ? await supabase.from("project_points").update(p).eq("id", p.id)
    : await supabase.from("project_points").insert(p)
  return { error: error?.message ?? null }
}

export async function deleteProjectPoint(id: number): Promise<{ error: string | null }> {
  const supabase = createClient()
  const { error } = await supabase.from("project_points").delete().eq("id", id)
  return { error: error?.message ?? null }
}

// ─── Amenities ─────────────────────────────────────────────────────────────────

export async function fetchAmenities(): Promise<{ data: Amenity[]; error: string | null }> {
  const supabase = createClient()
  const { data, error } = await supabase.from("amenities").select("*").order("name")
  if (error) return { data: [], error: error.message }
  return { data: (data ?? []) as Amenity[], error: null }
}

export async function fetchProjectAmenities(projectId: number): Promise<{ data: number[]; error: string | null }> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("project_amenities")
    .select("amenity_id")
    .eq("project_id", projectId)

  if (error) return { data: [], error: error.message }
  return { data: (data ?? []).map((r: { amenity_id: number }) => r.amenity_id), error: null }
}

export async function syncProjectAmenities(projectId: number, amenityIds: number[]): Promise<{ error: string | null }> {
  const supabase = createClient()
  await supabase.from("project_amenities").delete().eq("project_id", projectId)
  if (!amenityIds.length) return { error: null }
  const { error } = await supabase
    .from("project_amenities")
    .insert(amenityIds.map(amenity_id => ({ project_id: projectId, amenity_id })))

  return { error: error?.message ?? null }
}

// ─── Property Types ────────────────────────────────────────────────────────────

export async function fetchPropertyTypes(): Promise<{ data: PropertyType[]; error: string | null }> {
  const supabase = createClient()
  const { data, error } = await supabase.from("property_types").select("*").order("name")
  if (error) return { data: [], error: error.message }
  return { data: (data ?? []) as PropertyType[], error: null }
}

export async function fetchProjectPropertyTypes(projectId: number): Promise<{ data: number[]; error: string | null }> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("project_property_types")
    .select("property_type_id")
    .eq("project_id", projectId)

  if (error) return { data: [], error: error.message }
  return { data: (data ?? []).map((r: { property_type_id: number }) => r.property_type_id), error: null }
}

export async function syncProjectPropertyTypes(projectId: number, typeIds: number[]): Promise<{ error: string | null }> {
  const supabase = createClient()
  await supabase.from("project_property_types").delete().eq("project_id", projectId)
  if (!typeIds.length) return { error: null }
  const { error } = await supabase
    .from("project_property_types")
    .insert(typeIds.map(property_type_id => ({ project_id: projectId, property_type_id })))

  return { error: error?.message ?? null }
}

// ─── Project Stats / Completeness ────────────────────────────────────────────

export async function fetchProjectStats(projectId: number): Promise<{ data: ProjectStats | null; error: string | null }> {
  const supabase = createClient()

  try {
    const tables: Array<{ key: keyof ProjectStats; table: string }> = [
      { key: "images",          table: "project_images" },
      { key: "media",           table: "project_media" },
      { key: "units",           table: "project_units" },
      { key: "features",        table: "project_features" },
      { key: "amenities",       table: "project_amenities" },
      { key: "property_types",  table: "project_property_types" },
      { key: "keywords",        table: "project_keywords" },
      { key: "neighbors",       table: "project_neighbors" },
    ]

    const results = await Promise.all(
      tables.map(async ({ key, table }) => {
        const { count, error } = await supabase
          .from(table)
          .select("*", { count: "exact", head: true })
          .eq("project_id", projectId)

        if (error) throw new Error(`${table}: ${error.message}`)
        return [key, count ?? 0] as [keyof ProjectStats, number]
      }),
    )

    return { data: Object.fromEntries(results) as ProjectStats, error: null }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return { data: null, error: message }
  }
}

// ─── Developers ────────────────────────────────────────────────────────────────

export async function fetchDevelopersForSelect(): Promise<{ data: Developer[]; error: string | null }> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("developers")
    .select("id, name, slug, logo_url, is_active, is_verified")
    .eq("is_active", true)
    .is("deleted_at", null)
    .order("name")

  if (error) return { data: [], error: error.message }
  return { data: (data ?? []) as Developer[], error: null }
}
