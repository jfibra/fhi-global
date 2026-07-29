// Client-side data layer for the admin "All Listings" page. Unlike the
// agent-facing lib/agent-listings-service.ts (browser client + RLS, owner
// scoped), these call the service-role admin API routes so admins can view and
// mutate any agent's listing. Every function returns a typed result and never
// throws into the caller's UI path.

export type AdminListingKind = "sale" | "rent"
export type AdminListingStatus = "draft" | "published" | "archived"

export type AdminListingAgent = { id: string; fullname: string | null; role: string | null }
export type AdminListingImage = { id: string; url: string; sort_order: number }
export type AdminListingUnit = {
  unit_type: string | null
  bedrooms: number | null
  bathrooms: number | null
  size_sqft: number | string | null
  size_sqm: number | string | null
  price_from: number | string | null
  price_to: number | string | null
}

export type AdminListingProject = {
  id: number
  name: string
  developer_id: string | null
  /** Location, pricing and unit facts the cards render. Mirrors the agent-side
   *  embed so both listing pages show identical numbers. */
  city?: string | null
  location?: string | null
  community?: string | null
  main_image?: string | null
  launch_price_from?: number | string | null
  launch_price_to?: number | string | null
  currency?: string | null
  developers: { id: string; name: string | null } | null
  project_units?: AdminListingUnit[] | null
  project_property_types?: { property_types?: { name?: string | null } | null }[] | null
}

export type AdminListingRow = {
  id: string
  /** From migration 013; the public route also resolves the bare id. */
  slug?: string | null
  agent_id: string
  project_id: number | null
  title: string
  description: string | null
  listing_kind: AdminListingKind
  price: number | null
  currency: string
  status: AdminListingStatus
  unit_type: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
  agent: AdminListingAgent | null
  projects: AdminListingProject | null
  agent_listing_images: AdminListingImage[] | null
}

export type AdminListingsSummary = {
  published: number
  draft: number
  archived: number
  /** Org-wide kind split + soft-deleted count, for the filter chips. */
  sale: number
  rent: number
  deleted: number
  total: number
}

export type AdminListingActivityRow = {
  id: string
  occurred_at: string
  category: string
  event: string
  source: string
  actor_id: string | null
  actor_name: string | null
  actor_role: string | null
  subject_type: string | null
  subject_id: string | null
  subject_label: string | null
  description: string | null
  changed_keys: string[] | null
  old_values: Record<string, unknown> | null
  new_values: Record<string, unknown> | null
  ip_address: string | null
  user_agent: string | null
  url: string | null
}

export type AdminListingUpdateInput = {
  title: string
  description: string
  listing_kind: AdminListingKind
  status: AdminListingStatus
  unit_type: string | null
  price: number | null
  currency: string
}

export type DeveloperOption = { id: string; name: string; slug: string }

export type AdminListingsQuery = {
  page: number
  perPage: number
  search?: string
  developerId?: string
  status?: string
  kind?: string
  agentId?: string
  showDeleted?: boolean
  sort?: "updated_at" | "created_at" | "title" | "price"
  dir?: "asc" | "desc"
}

export type AdminListingsResult = {
  data: AdminListingRow[]
  total: number
  summary: AdminListingsSummary | null
  error: string | null
}

async function readError(res: Response): Promise<string> {
  try {
    const json = (await res.json()) as { error?: string }
    return json.error ?? `Request failed (${res.status})`
  } catch {
    return `Request failed (${res.status})`
  }
}

export async function fetchAdminListings(query: AdminListingsQuery): Promise<AdminListingsResult> {
  const sp = new URLSearchParams({ page: String(query.page), perPage: String(query.perPage) })
  if (query.search) sp.set("search", query.search)
  if (query.developerId) sp.set("developerId", query.developerId)
  if (query.status) sp.set("status", query.status)
  if (query.kind) sp.set("kind", query.kind)
  if (query.agentId) sp.set("agentId", query.agentId)
  if (query.showDeleted) sp.set("showDeleted", "true")
  if (query.sort) sp.set("sort", query.sort)
  if (query.dir) sp.set("dir", query.dir)

  try {
    const res = await fetch(`/api/admin/listings?${sp.toString()}`, { cache: "no-store" })
    if (!res.ok) return { data: [], total: 0, summary: null, error: await readError(res) }
    const json = (await res.json()) as {
      rows: AdminListingRow[]
      total: number
      summary: AdminListingsSummary
    }
    return { data: json.rows ?? [], total: json.total ?? 0, summary: json.summary ?? null, error: null }
  } catch (error) {
    return { data: [], total: 0, summary: null, error: (error as Error).message }
  }
}

export async function updateAdminListing(
  id: string,
  input: AdminListingUpdateInput,
): Promise<{ error: string | null }> {
  try {
    const res = await fetch(`/api/admin/listings/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    })
    if (!res.ok) return { error: await readError(res) }
    return { error: null }
  } catch (error) {
    return { error: (error as Error).message }
  }
}

/** deleted=true soft-deletes; deleted=false restores. */
export async function setAdminListingDeleted(
  id: string,
  deleted: boolean,
): Promise<{ error: string | null }> {
  try {
    const res = await fetch(`/api/admin/listings/${id}${deleted ? "" : "?restore=1"}`, {
      method: "DELETE",
    })
    if (!res.ok) return { error: await readError(res) }
    return { error: null }
  } catch (error) {
    return { error: (error as Error).message }
  }
}

export async function fetchAdminListingActivity(
  id: string,
): Promise<{ data: AdminListingActivityRow[]; error: string | null }> {
  try {
    const res = await fetch(`/api/admin/listings/${id}/activity`, { cache: "no-store" })
    if (!res.ok) return { data: [], error: await readError(res) }
    const json = (await res.json()) as { rows: AdminListingActivityRow[] }
    return { data: json.rows ?? [], error: null }
  } catch (error) {
    return { data: [], error: (error as Error).message }
  }
}

export async function fetchDeveloperOptions(): Promise<{ data: DeveloperOption[]; error: string | null }> {
  try {
    const res = await fetch(`/api/admin/developers`, { cache: "no-store" })
    if (!res.ok) return { data: [], error: await readError(res) }
    const json = (await res.json()) as { developers: DeveloperOption[] }
    return { data: json.developers ?? [], error: null }
  } catch (error) {
    return { data: [], error: (error as Error).message }
  }
}
