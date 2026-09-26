// Client-side data layer for Agent Resource → Buyers Link (migration 060).
// Reads run on the browser client under RLS — owners see only their own links
// and leads. Writes go through the role-guarded /api/buyer-links routes.

import { createClient } from "@/lib/supabase/client"
import { BUYER_LEAD_COLUMNS, BUYER_LINK_COLUMNS, type BuyerLead, type BuyerLink } from "@/lib/buyer-links"

export type PickableProject = { id: number; name: string; developer: string | null }

export async function fetchMyBuyerLinks(
  agentId: string,
): Promise<{ links: BuyerLink[]; leads: BuyerLead[]; error: string | null }> {
  try {
    const supabase = createClient()
    const [links, leads] = await Promise.all([
      supabase.from("buyer_links").select(BUYER_LINK_COLUMNS).eq("agent_id", agentId).order("created_at", { ascending: false }),
      supabase.from("buyer_link_leads").select(BUYER_LEAD_COLUMNS).eq("agent_id", agentId).order("created_at", { ascending: false }).limit(500),
    ])
    return {
      links: (links.data ?? []) as unknown as BuyerLink[],
      leads: (leads.data ?? []) as unknown as BuyerLead[],
      error: links.error?.message ?? leads.error?.message ?? null,
    }
  } catch (error) {
    return { links: [], leads: [], error: (error as Error).message }
  }
}

/** Live, published projects for the picker (the projects table is public). */
export async function fetchPickableProjects(): Promise<PickableProject[]> {
  const supabase = createClient()
  const { data } = await supabase
    .from("projects")
    .select("id, name, developers ( name )")
    .eq("is_active", true)
    .eq("is_published", true)
    .is("deleted_at", null)
    .order("name")
    .limit(1000)
  return ((data ?? []) as unknown as { id: number; name: string; developers: { name: string } | null }[]).map((p) => ({
    id: p.id,
    name: p.name,
    developer: p.developers?.name ?? null,
  }))
}

async function send(url: string, method: "POST" | "PATCH", body: unknown): Promise<{ link: BuyerLink | null; error: string | null }> {
  try {
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
    const json = (await res.json().catch(() => ({}))) as { link?: BuyerLink; error?: string }
    if (!res.ok || !json.link) return { link: null, error: json.error ?? `Request failed (${res.status}).` }
    return { link: json.link, error: null }
  } catch (error) {
    return { link: null, error: (error as Error).message }
  }
}

export const createBuyerLink = (input: { title: string; note: string; projectIds: number[] }) =>
  send("/api/buyer-links", "POST", input)

export const setBuyerLinkActive = (id: string, isActive: boolean) =>
  send(`/api/buyer-links/${encodeURIComponent(id)}`, "PATCH", { isActive })

/** Delete a link and the clients who came through it — the page confirms first. */
export async function deleteBuyerLink(id: string): Promise<{ error: string | null }> {
  try {
    const res = await fetch(`/api/buyer-links/${encodeURIComponent(id)}`, { method: "DELETE" })
    if (res.ok) return { error: null }
    const json = (await res.json().catch(() => ({}))) as { error?: string }
    return { error: json.error ?? `Request failed (${res.status}).` }
  } catch (error) {
    return { error: (error as Error).message }
  }
}
