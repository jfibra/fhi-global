// Client-side data layer for Agent Resource → Buyers Link (migrations 060–061).
// The agent's one link comes from the idempotent POST /api/buyer-links (it is
// created on first use); the briefs are read on the browser client under RLS,
// so owners only ever see their own.

import { createClient } from "@/lib/supabase/client"
import { BUYER_LEAD_COLUMNS, type BuyerLead, type BuyerLink } from "@/lib/buyer-links"

export async function fetchMyBuyerLink(): Promise<{ link: BuyerLink | null; error: string | null }> {
  try {
    const res = await fetch("/api/buyer-links", { method: "POST" })
    const json = (await res.json().catch(() => ({}))) as { link?: BuyerLink; error?: string }
    if (!res.ok || !json.link) return { link: null, error: json.error ?? `Request failed (${res.status}).` }
    return { link: json.link, error: null }
  } catch (error) {
    return { link: null, error: (error as Error).message }
  }
}

export async function fetchMyBuyerLeads(agentId: string): Promise<{ leads: BuyerLead[]; error: string | null }> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase
      .from("buyer_link_leads")
      .select(BUYER_LEAD_COLUMNS)
      .eq("agent_id", agentId)
      .order("created_at", { ascending: false })
      .limit(1000)
    return { leads: (data ?? []) as unknown as BuyerLead[], error: error?.message ?? null }
  } catch (error) {
    return { leads: [], error: (error as Error).message }
  }
}

/** Admin staff: every agent's briefs, each with its agent (GET /api/admin/buyer-leads). */
export async function fetchAllBuyerLeads(): Promise<{ leads: BuyerLead[]; error: string | null }> {
  try {
    const res = await fetch("/api/admin/buyer-leads")
    const json = (await res.json().catch(() => ({}))) as { leads?: BuyerLead[]; error?: string }
    if (!res.ok || !json.leads) return { leads: [], error: json.error ?? `Request failed (${res.status}).` }
    return { leads: json.leads, error: null }
  } catch (error) {
    return { leads: [], error: (error as Error).message }
  }
}
