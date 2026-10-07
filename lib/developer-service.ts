import { createClient } from "@/lib/supabase/client"
import { pingSeoRevalidate } from "@/lib/seo-ping"
import { developerSlugError, normalizeDeveloperSlug } from "@/lib/reserved-slugs"

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
  // Developer-requested slug awaiting admin approval (migration 027); null = none.
  pending_slug: string | null
  pending_slug_at: string | null
  pending_slug_by: string | null
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

// ─── Slug-change review (admin) ─────────────────────────────────────────────────
/** Approve (slug ← pending_slug) or reject a developer's pending slug request. */
export async function reviewDeveloperSlug(
  developerId: string,
  action: "approve" | "reject",
): Promise<{ data: Developer | null; error: string | null }> {
  try {
    const res = await fetch(`/api/admin/developers/${developerId}/slug`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    })
    const json = (await res.json()) as { developer?: Developer; error?: string }
    if (!res.ok) return { data: null, error: json.error ?? "Failed to update the slug request." }
    return { data: json.developer ?? null, error: null }
  } catch {
    return { data: null, error: "Failed to update the slug request. Please try again." }
  }
}

// ─── Create ────────────────────────────────────────────────────────────────────
export async function createDeveloper(
  formData: DeveloperFormData,
): Promise<{ data: Developer | null; error: string | null }> {
  const slug = normalizeDeveloperSlug(formData.slug)
  const slugError = developerSlugError(slug)
  if (slugError) return { data: null, error: slugError }
  const supabase = createClient()
  const { data, error } = await supabase
    .from("developers")
    .insert({
      name:        formData.name.trim(),
      slug,
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
  // A developer created active is a new public page (and a new card on /developers, the home map and the
  // sitemap) — the other write paths pinged, this one never did.
  pingSeoRevalidate("developer", (data as Developer).id)
  return { data: data as Developer, error: null }
}

// ─── Update ────────────────────────────────────────────────────────────────────
export async function updateDeveloper(
  id: string,
  formData: DeveloperFormData,
): Promise<{ data: Developer | null; error: string | null }> {
  const slug = normalizeDeveloperSlug(formData.slug)
  const slugError = developerSlugError(slug)
  if (slugError) return { data: null, error: slugError }
  const supabase = createClient()
  // Before the write: the old address (a rename moves the page and every project under it) and whether the
  // developer was online (only a live → off change is a removal worth announcing).
  const { data: previous } = await supabase.from("developers").select("slug, is_active").eq("id", id).maybeSingle()
  const before = previous as { slug: string | null; is_active: boolean | null } | null
  const { data, error } = await supabase
    .from("developers")
    .update({
      name:        formData.name.trim(),
      slug,
      description: formData.description.trim() || null,
      website_url: formData.website_url.trim() || null,
      phone:       formData.phone.trim() || null,
      email:       formData.email.trim() || null,
      address:     formData.address.trim() || null,
      rating:      formData.rating ?? 0,
      is_verified: formData.is_verified,
      is_active:   formData.is_active,
      // Nothing else stamps this column (no trigger), so the sitemap's lastmod for
      // developers sat frozen at a bulk write. Every public-facing write sets it.
      updated_at:  new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single()

  if (error) return { data: null, error: error.message }
  // Purge the developer page and the lists that carry its name/logo, and tell IndexNow (switching a live
  // developer off takes the page and every project under it down — announce that as a removal; a rename
  // moves them to a new address, so say where they came from).
  pingSeoRevalidate("developer", id, {
    removed: before?.is_active === true && formData.is_active === false,
    fromSlug: before?.slug && before.slug !== slug ? before.slug : undefined,
  })
  return { data: data as Developer, error: null }
}

// ─── Soft delete ───────────────────────────────────────────────────────────────
export async function softDeleteDeveloper(id: string): Promise<{ error: string | null }> {
  const supabase = createClient()
  const { error } = await supabase
    .from("developers")
    .update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", id)
  // No `removed` hint: a soft delete leaves is_active as it was, so the server reads the row and announces the
  // removal only when the page was online.
  if (!error) pingSeoRevalidate("developer", id)
  return { error: error?.message ?? null }
}

// ─── Restore ───────────────────────────────────────────────────────────────────
export async function restoreDeveloper(id: string): Promise<{ error: string | null }> {
  const supabase = createClient()
  const { error } = await supabase
    .from("developers")
    .update({ deleted_at: null, updated_at: new Date().toISOString() })
    .eq("id", id)
  if (!error) pingSeoRevalidate("developer", id)
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
    .update({ is_active: !currentValue, updated_at: new Date().toISOString() })
    .eq("id", id)
  // currentValue is the OLD state: it was active, so this switch takes the page off the site.
  if (!error) pingSeoRevalidate("developer", id, { removed: currentValue })
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
    .update({ is_verified: !currentValue, updated_at: new Date().toISOString() })
    .eq("id", id)
  if (!error) pingSeoRevalidate("developer", id)
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
    .update({ logo_url, updated_at: new Date().toISOString() })
    .eq("id", id)
  if (!error) pingSeoRevalidate("developer", id)
  return { error: error?.message ?? null }
}
