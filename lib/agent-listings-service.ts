import { createClient } from "@/lib/supabase/client"

export type AgentListingKind = "sale" | "rent"
export type AgentListingStatus = "draft" | "published" | "archived"

export type AgentListingImage = {
  id: string
  url: string
  sort_order: number
}

export type AgentListing = {
  id: string
  agent_id: string
  project_id: number | null
  title: string
  description: string | null
  listing_kind: AgentListingKind
  price: number | null
  currency: string
  status: AgentListingStatus
  created_at: string
  updated_at: string
  deleted_at: string | null
  projects?: { id: number; name: string } | null
  agent_listing_images?: AgentListingImage[] | null
}

export type AgentListingFormInput = {
  title: string
  description: string
  listing_kind: AgentListingKind
  price: number | null
  currency: string
  project_id: number | null
  status: AgentListingStatus
}

export type ProjectPickerOption = { id: number; name: string }

export async function fetchMyAgentListings(agentId: string): Promise<{
  data: AgentListing[] | null
  error: string | null
}> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("agent_listings")
    .select("*, projects ( id, name ), agent_listing_images ( id, url, sort_order )")
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
    .select("id, name")
    .eq("is_published", true)
    .eq("is_active", true)
    .is("deleted_at", null)
    .order("name", { ascending: true })
    .limit(500)

  if (error) return { data: null, error: error.message }
  return {
    data: (data ?? []).map((r) => ({ id: Number(r.id), name: String(r.name ?? "") })),
    error: null,
  }
}

export async function createAgentListing(
  agentId: string,
  input: AgentListingFormInput,
): Promise<{ data: AgentListing | null; error: string | null }> {
  const supabase = createClient()
  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from("agent_listings")
    .insert({
      agent_id: agentId,
      project_id: input.project_id,
      title: input.title.trim(),
      description: input.description.trim() || null,
      listing_kind: input.listing_kind,
      price: input.price,
      currency: input.currency.trim() || "AED",
      status: input.status,
      updated_at: now,
    })
    .select("*, projects ( id, name ), agent_listing_images ( id, url, sort_order )")
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
  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from("agent_listings")
    .update({
      project_id: input.project_id,
      title: input.title.trim(),
      description: input.description.trim() || null,
      listing_kind: input.listing_kind,
      price: input.price,
      currency: input.currency.trim() || "AED",
      status: input.status,
      updated_at: now,
    })
    .eq("id", listingId)
    .eq("agent_id", agentId)
    .select("*, projects ( id, name ), agent_listing_images ( id, url, sort_order )")
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
