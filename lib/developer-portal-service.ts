/**
 * Developer Portal Service
 * Scoped data-access layer for users with the `developer` role.
 * All queries enforce developer_id ownership.
 */

import { createClient } from "@/lib/supabase/client"
import type { Developer } from "@/lib/developer-service"
import type { Project, ProjectImage, ProjectMedia } from "@/lib/project-service"

export type { Developer }

// â”€â”€â”€ Link â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Returns the developers row linked to the given profile via metadata.developer_id
export async function getDeveloperForUser(
  userId: string,
): Promise<{ data: Developer | null; error: string | null }> {
  const supabase = createClient()

  // 1. Fetch metadata.developer_id from the profile
  const { data: profile, error: profileErr } = await supabase
    .from("profiles")
    .select("metadata")
    .eq("id", userId)
    .single<{ metadata: Record<string, unknown> | null }>()

  if (profileErr || !profile) {
    return { data: null, error: profileErr?.message ?? "Profile not found" }
  }

  const developerId = profile.metadata?.developer_id as string | undefined
  if (!developerId) {
    return { data: null, error: "No developer linked to this account" }
  }

  // 2. Fetch the developers row
  const { data, error } = await supabase
    .from("developers")
    .select("*")
    .eq("id", developerId)
    .is("deleted_at", null)
    .single<Developer>()

  if (error) return { data: null, error: error.message }
  return { data, error: null }
}

// â”€â”€â”€ Update company info â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export type DeveloperCompanyFormData = {
  name: string
  slug: string
  description: string
  website_url: string
  phone: string
  email: string
  address: string
}

export async function updateDeveloperCompany(
  developerId: string,
  formData: DeveloperCompanyFormData,
): Promise<{ data: Developer | null; error: string | null }> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from("developers")
    .update({
      name:        formData.name.trim(),
      slug:        formData.slug.trim(),
      description: formData.description.trim() || null,
      website_url: formData.website_url.trim() || null,
      phone:       formData.phone.trim() || null,
      email:       formData.email.trim() || null,
      address:     formData.address.trim() || null,
    })
    .eq("id", developerId)
    .select()
    .single<Developer>()

  if (error) return { data: null, error: error.message }
  return { data, error: null }
}

// â”€â”€â”€ Projects (scoped) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export type DeveloperProjectsResponse = {
  data: Project[] | null
  total: number | null
  error: string | null
}

export async function fetchDeveloperProjects(params: {
  developerId: string
  page?: number
  perPage?: number
  search?: string
  status?: string
  city?: string
  isPublished?: boolean
  isActive?: boolean
  sortField?: "name" | "created_at" | "views_count"
  sortDir?: "asc" | "desc"
}): Promise<DeveloperProjectsResponse> {
  const supabase = createClient()
  const page      = params.page ?? 1
  const perPage   = params.perPage ?? 20
  const from      = (page - 1) * perPage
  const to        = from + perPage - 1
  const sortField = params.sortField ?? "created_at"
  const ascending = params.sortDir === "asc"

  let query = supabase
    .from("projects")
    .select("*, developers(name, logo_url)", { count: "exact" })
    .eq("developer_id", params.developerId)
    .is("deleted_at", null)

  if (params.search) {
    const q = `%${params.search}%`
    query = query.or(`name.ilike.${q},city.ilike.${q},location.ilike.${q}`)
  }

  if (params.status)                     query = query.eq("status",       params.status)
  if (params.city)                        query = query.ilike("city",        `%${params.city}%`)
  if (params.isPublished !== undefined)   query = query.eq("is_published", params.isPublished)
  if (params.isActive    !== undefined)   query = query.eq("is_active",    params.isActive)

  query = query.order(sortField, { ascending }).range(from, to)

  const { data, count, error } = await query
  if (error) return { data: null, total: null, error: error.message }
  return { data: (data ?? []) as Project[], total: count ?? 0, error: null }
}

// â”€â”€â”€ Project stats â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export type DeveloperStats = {
  totalProjects: number
  activeProjects: number
  publishedProjects: number
  totalUnits: number
  totalViews: number
}

export async function fetchDeveloperStats(
  developerId: string,
): Promise<{ data: DeveloperStats | null; error: string | null }> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from("projects")
    .select("is_active, is_published, total_units, views_count")
    .eq("developer_id", developerId)
    .is("deleted_at", null)

  if (error) return { data: null, error: error.message }

  const rows = data ?? []
  return {
    data: {
      totalProjects:     rows.length,
      activeProjects:    rows.filter((r) => r.is_active).length,
      publishedProjects: rows.filter((r) => r.is_published).length,
      totalUnits:        rows.reduce((s, r) => s + (r.total_units ?? 0), 0),
      totalViews:        rows.reduce((s, r) => s + (r.views_count ?? 0), 0),
    },
    error: null,
  }
}

// â”€â”€â”€ Soft-toggle publish â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export async function toggleProjectPublish(
  projectId: number,
  developerId: string,
  publish: boolean,
): Promise<{ error: string | null }> {
  const supabase = createClient()
  const { error } = await supabase
    .from("projects")
    .update({
      is_published: publish,
      published_at: publish ? new Date().toISOString() : null,
    })
    .eq("id", projectId)
    .eq("developer_id", developerId)

  return { error: error?.message ?? null }
}

// â”€â”€â”€ Soft-toggle active â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export async function toggleProjectActive(
  projectId: number,
  developerId: string,
  active: boolean,
): Promise<{ error: string | null }> {
  const supabase = createClient()
  const { error } = await supabase
    .from("projects")
    .update({ is_active: active })
    .eq("id", projectId)
    .eq("developer_id", developerId)

  return { error: error?.message ?? null }
}

// â”€â”€â”€ Soft delete project â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export async function softDeleteDeveloperProject(
  projectId: number,
  developerId: string,
): Promise<{ error: string | null }> {
  const supabase = createClient()
  const { error } = await supabase
    .from("projects")
    .update({ deleted_at: new Date().toISOString(), is_active: false, is_published: false })
    .eq("id", projectId)
    .eq("developer_id", developerId)

  return { error: error?.message ?? null }
}

// â”€â”€â”€ Media â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export type MediaFile = {
  id: number
  project_id: number
  project_name: string
  type: "image" | "video" | "virtual_tour"
  url: string
  thumb: string | null
  is_main?: boolean
  rank?: number
}

export async function fetchDeveloperMedia(
  developerId: string,
): Promise<{ data: MediaFile[]; error: string | null }> {
  const supabase = createClient()

  // Fetch projects owned by this developer first
  const { data: projects, error: pErr } = await supabase
    .from("projects")
    .select("id, name")
    .eq("developer_id", developerId)
    .is("deleted_at", null)

  if (pErr) return { data: [], error: pErr.message }

  const projectIds = (projects ?? []).map((p) => p.id)
  const projectNameMap: Record<number, string> = {}
  for (const p of projects ?? []) projectNameMap[p.id] = p.name

  if (!projectIds.length) return { data: [], error: null }

  // Images
  const { data: images, error: iErr } = await supabase
    .from("project_images")
    .select("id, project_id, url, thumb, is_main, rank")
    .in("project_id", projectIds)

  // Media
  const { data: media, error: mErr } = await supabase
    .from("project_media")
    .select("id, project_id, media_type, url")
    .in("project_id", projectIds)

  if (iErr) return { data: [], error: iErr.message }
  if (mErr) return { data: [], error: mErr.message }

  const result: MediaFile[] = [
    ...(images ?? []).map((img) => ({
      id:           img.id,
      project_id:   img.project_id,
      project_name: projectNameMap[img.project_id] ?? "Unknown",
      type:         "image" as const,
      url:          img.url,
      thumb:        img.thumb,
      is_main:      img.is_main,
      rank:         img.rank,
    })),
    ...(media ?? []).map((m) => ({
      id:           m.id,
      project_id:   m.project_id,
      project_name: projectNameMap[m.project_id] ?? "Unknown",
      type:         m.media_type as "video" | "virtual_tour",
      url:          m.url,
      thumb:        null,
    })),
  ]

  return { data: result, error: null }
}

// â”€â”€â”€ Recent projects â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export async function fetchRecentDeveloperProjects(
  developerId: string,
  limit = 5,
): Promise<{ data: Project[]; error: string | null }> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from("projects")
    .select("id, uuid, name, slug, status, city, is_published, is_active, main_image, created_at, updated_at, total_units, views_count, developer_id")
    .eq("developer_id", developerId)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .limit(limit)

  if (error) return { data: [], error: error.message }
  return { data: (data ?? []) as Project[], error: null }
}
