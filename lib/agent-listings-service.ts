import { createClient } from "@/lib/supabase/client"
import { pingSeoRevalidate } from "@/lib/seo-ping"
import type { OgCardOptions } from "@/lib/flyer/og-card"

export type AgentListingKind = "sale" | "rent"
export type AgentListingStatus = "draft" | "published" | "archived"

export type AgentListingImage = {
  id: string
  url: string
  sort_order: number
}

/** One unit line configured by the developer on a project. `agent_listings.unit_type`
 *  is matched against `unit_type` to resolve the beds/baths/size a listing shows. */
export type ProjectUnitFacts = {
  unit_type: string | null
  bedrooms: number | null
  bathrooms: number | null
  size_sqft: number | string | null
  size_sqm: number | string | null
  price_from: number | string | null
  price_to: number | string | null
}

export type AgentListing = {
  id: string
  /** URL slug generated from the title by the DB (migration 013); public link is /listings/<slug>. */
  slug?: string | null
  agent_id: string
  project_id: number | null
  title: string
  description: string | null
  listing_kind: AgentListingKind
  price: number | null
  currency: string
  status: AgentListingStatus
  /** Migration 019. Agent-chosen highlight — the Featured page reads this. */
  is_featured: boolean
  unit_type: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
  /** Saved share-card customization (see lib/flyer/og-card.ts); parse with sanitizeOgCardOptions. */
  og_card_options?: unknown | null
  projects?: {
    id: number
    name: string
    developer_id?: string | null
    /** Location, pricing and unit facts all live on the project — a standalone
     *  listing has none of them. Mirrors the embed the public listing page uses
     *  (lib/buy/agent-listings-public.ts) so dashboard and public agree. */
    city?: string | null
    location?: string | null
    community?: string | null
    main_image?: string | null
    launch_price_from?: number | string | null
    launch_price_to?: number | string | null
    currency?: string | null
    developers?: { name?: string | null } | null
    project_units?: ProjectUnitFacts[] | null
    /** Apartment / Penthouse / Townhouse / Villa — the `property_types` catalogue,
     *  assigned to the project by the developer. */
    project_property_types?: { property_types?: { name?: string | null } | null }[] | null
  } | null
  agent_listing_images?: AgentListingImage[] | null
}

export type AgentListingFormInput = {
  title: string
  description: string
  listing_kind: AgentListingKind
  project_id: number | null
  status: AgentListingStatus
  unit_type: string | null
}

export type ProjectPickerOption = {
  id: number
  name: string
  developer_id: string | null
  developerName: string | null
}

const UNASSIGNED_DEVELOPER_KEY = "__unassigned__"
export { UNASSIGNED_DEVELOPER_KEY }

/** Single source of truth for the row shape every agent-listing read returns, so
 *  the create/update responses carry the same project facts as the list query. */
const LISTING_SELECT = `
  *,
  projects (
    id, name, developer_id, city, location, community, main_image,
    launch_price_from, launch_price_to, currency,
    developers ( name ),
    project_units ( unit_type, bedrooms, bathrooms, size_sqft, size_sqm, price_from, price_to ),
    project_property_types ( property_types ( name ) )
  ),
  agent_listing_images ( id, url, sort_order )
`

async function resolveListingMoneyFields(
  supabase: ReturnType<typeof createClient>,
  projectId: number | null,
): Promise<{ price: number | null; currency: string }> {
  if (projectId == null) {
    return { price: null, currency: "AED" }
  }
  const { data } = await supabase
    .from("projects")
    .select("currency")
    .eq("id", projectId)
    .maybeSingle()

  const cur = data && typeof (data as { currency?: unknown }).currency === "string"
    ? (data as { currency: string }).currency.trim() || "AED"
    : "AED"
  return { price: null, currency: cur }
}

export async function fetchMyAgentListings(agentId: string): Promise<{
  data: AgentListing[] | null
  error: string | null
}> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("agent_listings")
    .select(LISTING_SELECT)
    .eq("agent_id", agentId)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })

  if (error) return { data: null, error: error.message }
  const rows = (data ?? []) as unknown as AgentListing[]
  for (const row of rows) {
    if (row.agent_listing_images?.length) {
      row.agent_listing_images.sort((a, b) => a.sort_order - b.sort_order)
    }
  }
  return { data: rows, error: null }
}

export async function fetchPublishedProjectsForListingForm(): Promise<{
  data: ProjectPickerOption[] | null
  error: string | null
}> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("projects")
    .select("id, name, developer_id, developers ( name )")
    .eq("is_published", true)
    .eq("is_active", true)
    .is("deleted_at", null)
    .order("name", { ascending: true })
    .limit(500)

  if (error) return { data: null, error: error.message }
  return {
    data: (data ?? []).map((r) => {
      const dev = r.developers as { name?: string | null } | null | undefined
      const devName = dev && typeof dev.name === "string" ? dev.name.trim() || null : null
      const did = r.developer_id != null ? String(r.developer_id) : null
      return {
        id: Number(r.id),
        name: String(r.name ?? ""),
        developer_id: did,
        developerName: devName,
      }
    }),
    error: null,
  }
}

export async function createAgentListing(
  agentId: string,
  input: AgentListingFormInput,
): Promise<{ data: AgentListing | null; error: string | null }> {
  const supabase = createClient()
  const money = await resolveListingMoneyFields(supabase, input.project_id)
  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from("agent_listings")
    .insert({
      agent_id: agentId,
      project_id: input.project_id,
      title: input.title.trim(),
      description: input.description.trim() || null,
      listing_kind: input.listing_kind,
      price: money.price,
      currency: money.currency,
      status: input.status,
      unit_type: input.unit_type?.trim() || null,
      updated_at: now,
    })
    .select(LISTING_SELECT)
    .single()

  if (error) return { data: null, error: error.message }
  const row = data as unknown as AgentListing
  if (row.agent_listing_images?.length) {
    row.agent_listing_images.sort((a, b) => a.sort_order - b.sort_order)
  }
  return { data: row, error: null }
}

export async function updateAgentListing(
  listingId: string,
  agentId: string,
  input: AgentListingFormInput,
): Promise<{ data: AgentListing | null; error: string | null }> {
  const supabase = createClient()
  const money = await resolveListingMoneyFields(supabase, input.project_id)
  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from("agent_listings")
    .update({
      project_id: input.project_id,
      title: input.title.trim(),
      description: input.description.trim() || null,
      listing_kind: input.listing_kind,
      price: money.price,
      currency: money.currency,
      status: input.status,
      unit_type: input.unit_type?.trim() || null,
      updated_at: now,
    })
    .eq("id", listingId)
    .eq("agent_id", agentId)
    .select(LISTING_SELECT)
    .single()

  if (error) return { data: null, error: error.message }
  const row = data as unknown as AgentListing
  if (row.agent_listing_images?.length) {
    row.agent_listing_images.sort((a, b) => a.sort_order - b.sort_order)
  }
  return { data: row, error: null }
}

/** Replace all sales-uploaded images for a listing (developer project images stay on the project). */
export async function replaceAgentListingImages(
  listingId: string,
  agentId: string,
  urls: string[],
): Promise<{ error: string | null }> {
  const supabase = createClient()
  const { data: own, error: ownErr } = await supabase
    .from("agent_listings")
    .select("id")
    .eq("id", listingId)
    .eq("agent_id", agentId)
    .is("deleted_at", null)
    .maybeSingle()

  if (ownErr) return { error: ownErr.message }
  if (!own) return { error: "Listing not found" }

  const { error: delErr } = await supabase.from("agent_listing_images").delete().eq("listing_id", listingId)
  if (delErr) return { error: delErr.message }

  const clean = urls.map((u) => u.trim()).filter(Boolean)
  if (clean.length === 0) return { error: null }

  const rows = clean.map((url, sort_order) => ({ listing_id: listingId, url, sort_order }))
  const { error: insErr } = await supabase.from("agent_listing_images").insert(rows)
  if (insErr) return { error: insErr.message }
  return { error: null }
}

/** Persist the share-card customization. Bumping updated_at also refreshes the
 *  versioned /og/listing image URL in the listing page metadata (cache-bust). */
export async function saveAgentListingOgCard(
  listingId: string,
  agentId: string,
  options: OgCardOptions,
): Promise<{ error: string | null }> {
  const supabase = createClient()
  const { error } = await supabase
    .from("agent_listings")
    .update({ og_card_options: options, updated_at: new Date().toISOString() })
    .eq("id", listingId)
    .eq("agent_id", agentId)

  return { error: error?.message ?? null }
}

/** Status-only write, for the Publish / Move to draft / Archive row actions.
 *  Separate from updateAgentListing so a status flip never round-trips the whole
 *  form (and can never touch price or photos). */
export async function setAgentListingStatus(
  listingId: string,
  agentId: string,
  status: AgentListingStatus,
): Promise<{ error: string | null }> {
  const supabase = createClient()
  const { error } = await supabase
    .from("agent_listings")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", listingId)
    .eq("agent_id", agentId)
    .is("deleted_at", null)

  if (!error) pingSeoRevalidate("agent-listing", listingId)
  return { error: error?.message ?? null }
}

/**
 * Flip a listing's featured flag. Scoped by agent_id as well as id so this can
 * only ever touch the caller's own row, matching `agent_listings_update_own`
 * rather than relying on the policy alone.
 */
export async function setAgentListingFeatured(
  listingId: string,
  agentId: string,
  isFeatured: boolean,
): Promise<{ error: string | null }> {
  const supabase = createClient()
  const { error } = await supabase
    .from("agent_listings")
    .update({ is_featured: isFeatured, updated_at: new Date().toISOString() })
    .eq("id", listingId)
    .eq("agent_id", agentId)
    .is("deleted_at", null)

  return { error: error?.message ?? null }
}

export async function softDeleteAgentListing(
  listingId: string,
  agentId: string,
): Promise<{ error: string | null }> {
  const supabase = createClient()
  const { error } = await supabase
    .from("agent_listings")
    .update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", listingId)
    .eq("agent_id", agentId)

  return { error: error?.message ?? null }
}
