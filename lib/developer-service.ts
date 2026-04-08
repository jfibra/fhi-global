import { createClient } from "@/lib/supabase/client"

export type Developer = {
  id: string
  name: string
  slug: string
  description: string | null
  logo_url: string | null
  website_url: string | null
  phone: string | null
  email: string | null
  address: string | null
  rating: number | null
  is_verified: boolean
  is_active: boolean
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export type DeveloperFormData = {
  name: string
  slug: string
  description: string
  website_url: string
  phone: string
  email: string
  address: string
  rating: number | null
  is_verified: boolean
  is_active: boolean
}

export type DevelopersListResponse = {
  data: Developer[] | null
  total: number | null
  error: string | null
}

// ─── Slug generator ────────────────────────────────────────────────────────────
export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
}

// ─── Fetch list ────────────────────────────────────────────────────────────────
export async function fetchDevelopers(params: {
  page?: number
  perPage?: number
  search?: string
  verified?: boolean
  status?: boolean
  showDeleted?: boolean
  sortField?: "name" | "created_at" | "rating"
  sortDir?: "asc" | "desc"
}): Promise<DevelopersListResponse> {
  const supabase = createClient()
  const page      = params.page ?? 1
  const perPage   = params.perPage ?? 20
  const from      = (page - 1) * perPage
  const to        = from + perPage - 1
  const sortField = params.sortField ?? "created_at"
  const ascending = params.sortDir === "asc"

  let query = supabase
    .from("developers")
    .select("*", { count: "exact" })

  if (params.showDeleted) {
    query = query.not("deleted_at", "is", null)
  } else {
    query = query.is("deleted_at", null)
  }

  if (params.search) {
    const q = `%${params.search}%`
    query = query.or(`name.ilike.${q},slug.ilike.${q},email.ilike.${q},website_url.ilike.${q}`)
  }

  if (params.verified !== undefined) query = query.eq("is_verified", params.verified)
  if (params.status   !== undefined) query = query.eq("is_active",   params.status)

  query = query.order(sortField, { ascending }).range(from, to)

  const { data, count, error } = await query
  if (error) return { data: null, total: null, error: error.message }
  return { data: (data ?? []) as Developer[], total: count ?? 0, error: null }
}

// ─── Create ────────────────────────────────────────────────────────────────────
export async function createDeveloper(
  formData: DeveloperFormData,
): Promise<{ data: Developer | null; error: string | null }> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("developers")
    .insert({
      name:        formData.name.trim(),
      slug:        formData.slug.trim(),
      description: formData.description.trim() || null,
      website_url: formData.website_url.trim() || null,
      phone:       formData.phone.trim() || null,
      email:       formData.email.trim() || null,
      address:     formData.address.trim() || null,
      rating:      formData.rating ?? 0,
      is_verified: formData.is_verified,
      is_active:   formData.is_active,
    })
    .select()
    .single()

  if (error) return { data: null, error: error.message }
  return { data: data as Developer, error: null }
}

// ─── Update ────────────────────────────────────────────────────────────────────
export async function updateDeveloper(
  id: string,
  formData: DeveloperFormData,
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
      rating:      formData.rating ?? 0,
      is_verified: formData.is_verified,
      is_active:   formData.is_active,
    })
    .eq("id", id)
    .select()
    .single()

  if (error) return { data: null, error: error.message }
  return { data: data as Developer, error: null }
}

// ─── Soft delete ───────────────────────────────────────────────────────────────
export async function softDeleteDeveloper(id: string): Promise<{ error: string | null }> {
  const supabase = createClient()
  const { error } = await supabase
    .from("developers")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
  return { error: error?.message ?? null }
}

// ─── Restore ───────────────────────────────────────────────────────────────────
export async function restoreDeveloper(id: string): Promise<{ error: string | null }> {
  const supabase = createClient()
  const { error } = await supabase
    .from("developers")
    .update({ deleted_at: null })
    .eq("id", id)
  return { error: error?.message ?? null }
}

// ─── Toggle active ─────────────────────────────────────────────────────────────
/** Pass the CURRENT value; the function will flip it. */
export async function toggleDeveloperActive(
  id: string,
  currentValue: boolean,
): Promise<{ error: string | null }> {
  const supabase = createClient()
  const { error } = await supabase
    .from("developers")
    .update({ is_active: !currentValue })
    .eq("id", id)
  return { error: error?.message ?? null }
}

// ─── Toggle verified ───────────────────────────────────────────────────────────
/** Pass the CURRENT value; the function will flip it. */
export async function toggleDeveloperVerified(
  id: string,
  currentValue: boolean,
): Promise<{ error: string | null }> {
  const supabase = createClient()
  const { error } = await supabase
    .from("developers")
    .update({ is_verified: !currentValue })
    .eq("id", id)
  return { error: error?.message ?? null }
}

// ─── Update logo_url ───────────────────────────────────────────────────────────
export async function updateDeveloperLogoUrl(
  id: string,
  logo_url: string | null,
): Promise<{ error: string | null }> {
  const supabase = createClient()
  const { error } = await supabase
    .from("developers")
    .update({ logo_url })
    .eq("id", id)
  return { error: error?.message ?? null }
}
