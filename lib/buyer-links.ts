import type { SupabaseClient } from "@supabase/supabase-js"

// Buyers Link (migration 060): an agent picks up to six projects and sends one
// short link; a client who opens it sees those projects and can leave their
// details, which go straight to that agent. Shared by the dashboard page, the
// public /b/<code> page and the API routes — nothing here is server-only.

export const BUYER_LINK_MAX_PROJECTS = 6

export const BUDGET_OPTIONS = [
  { value: "under_1m", label: "Under AED 1M" },
  { value: "1m_2m", label: "AED 1M – 2M" },
  { value: "2m_5m", label: "AED 2M – 5M" },
  { value: "5m_plus", label: "AED 5M+" },
] as const

export const CONTACT_TIME_OPTIONS = [
  { value: "morning", label: "Morning" },
  { value: "afternoon", label: "Afternoon" },
  { value: "evening", label: "Evening" },
] as const

export const budgetLabel = (value: string | null | undefined): string | null =>
  BUDGET_OPTIONS.find((o) => o.value === value)?.label ?? null
export const contactTimeLabel = (value: string | null | undefined): string | null =>
  CONTACT_TIME_OPTIONS.find((o) => o.value === value)?.label ?? null

/** Link codes: 8 characters from an alphabet with no look-alikes (0/o, 1/l/i). */
export const BUYER_LINK_CODE_RE = /^[23456789abcdefghjkmnpqrstuvwxyz]{8}$/

export const buyerLinkPath = (code: string) => `/b/${code}`

export type BuyerLink = {
  id: string
  agent_id: string
  code: string
  title: string
  note: string | null
  project_ids: number[]
  is_active: boolean
  created_at: string
}

export type BuyerLead = {
  id: string
  link_id: string
  agent_id: string
  name: string
  whatsapp_code: string
  whatsapp: string
  email: string | null
  budget: string | null
  contact_time: string | null
  message: string | null
  project_ids: number[]
  created_at: string
}

export const BUYER_LINK_COLUMNS = "id, agent_id, code, title, note, project_ids, is_active, created_at"
export const BUYER_LEAD_COLUMNS =
  "id, link_id, agent_id, name, whatsapp_code, whatsapp, email, budget, contact_time, message, project_ids, created_at"

/**
 * The international digits wa.me and tel: need: "+971" + "050 123 4567" →
 * "971501234567". A number typed with its own "+" code is used as written; a
 * national one drops its trunk 0 behind the country code.
 */
export function waDigits(code: string | null | undefined, number: string | null | undefined): string {
  const n = (number ?? "").trim()
  if (!n) return ""
  if (n.startsWith("+")) return n.replace(/\D/g, "")
  return `${(code ?? "").replace(/\D/g, "")}${n.replace(/\D/g, "").replace(/^0+/, "")}`
}

/** The ids that are live, published projects, in the order given. */
export async function livePublishedProjectIds(supabase: SupabaseClient, ids: number[]): Promise<number[]> {
  if (ids.length === 0) return []
  const { data } = await supabase
    .from("projects")
    .select("id")
    .in("id", ids)
    .eq("is_active", true)
    .eq("is_published", true)
    .is("deleted_at", null)
  const live = new Set(((data ?? []) as { id: number }[]).map((r) => r.id))
  return ids.filter((id) => live.has(id))
}
