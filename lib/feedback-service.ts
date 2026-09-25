// Client-side data layer for the Customer Feedback pages — the agent's own
// board and the admin review queue. Reads run on the browser client under
// RLS (agents see their own rows, admins all — policy in migration 039).
// Writes have no client path: customers submit through the public
// POST /api/feedback, and admins approve/hide through PATCH
// /api/admin/feedback/[id], both on the service role.

import { createClient } from "@/lib/supabase/client"

export type AgentFeedback = {
  id: string
  agent_id: string
  client_name: string
  property_ref: string | null
  transaction_type: "buy" | "resell" | "rent" | null
  transaction_date: string | null
  overall_rating: number
  score_communication: number
  score_market: number
  score_understanding: number
  score_professionalism: number
  score_negotiation: number
  score_process: number
  score_experience: number
  recommend: RecommendValue
  did_well: string | null
  to_improve: string | null
  other_comments: string | null
  status: FeedbackStatus
  created_at: string
}

/** approved = shown on the advisor's website (lib/website-reviews.ts). */
export type FeedbackStatus = "new" | "approved" | "hidden"

/** A row in the admin queue — plus the advisor-name snapshot. */
export type AdminFeedback = AgentFeedback & { agent_name: string | null }

export type RecommendValue =
  | "definitely_not" | "unlikely" | "not_sure" | "likely" | "very_likely" | "definitely_yes"

export const RECOMMEND_LABELS: Record<RecommendValue, string> = {
  definitely_not: "Definitely Not",
  unlikely: "Unlikely",
  not_sure: "Not Sure",
  likely: "Likely",
  very_likely: "Very Likely",
  definitely_yes: "Definitely Yes",
}

export const SCORE_CATEGORIES = [
  { key: "score_communication", label: "Communication" },
  { key: "score_market", label: "Market knowledge" },
  { key: "score_understanding", label: "Understanding needs" },
  { key: "score_professionalism", label: "Professionalism" },
  { key: "score_negotiation", label: "Negotiation" },
  { key: "score_process", label: "Process guidance" },
  { key: "score_experience", label: "Overall experience" },
] as const

const FEEDBACK_COLUMNS =
  "id, agent_id, client_name, property_ref, transaction_type, transaction_date, overall_rating, score_communication, score_market, score_understanding, score_professionalism, score_negotiation, score_process, score_experience, recommend, did_well, to_improve, other_comments, status, created_at"

/**
 * The signed-in agent's feedback, newest first. 500 covers years of reviews;
 * stats are computed client-side over the same rows.
 */
export async function fetchMyFeedback(
  agentId: string,
): Promise<{ data: AgentFeedback[]; error: string | null }> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase
      .from("agent_feedback")
      .select(FEEDBACK_COLUMNS)
      .eq("agent_id", agentId)
      .order("created_at", { ascending: false })
      .limit(500)
    if (error) return { data: [], error: error.message }
    return { data: (data ?? []) as unknown as AgentFeedback[], error: null }
  } catch (error) {
    return { data: [], error: (error as Error).message }
  }
}

/** Admin queue: every advisor's feedback, newest first (RLS: admin staff read all). */
export async function fetchAllFeedback(): Promise<{ data: AdminFeedback[]; error: string | null }> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase
      .from("agent_feedback")
      .select(`${FEEDBACK_COLUMNS}, agent_name`)
      .order("created_at", { ascending: false })
      .limit(1000)
    if (error) return { data: [], error: error.message }
    return { data: (data ?? []) as unknown as AdminFeedback[], error: null }
  } catch (error) {
    return { data: [], error: (error as Error).message }
  }
}

/** Advisor id → their published website's slug, for "view on website" links. */
export async function fetchPublishedSites(agentIds: string[]): Promise<Record<string, string>> {
  if (agentIds.length === 0) return {}
  const supabase = createClient()
  const { data } = await supabase
    .from("website_builder")
    .select("agent_id, slug")
    .in("agent_id", agentIds)
    .eq("is_published", true)
  const map: Record<string, string> = {}
  for (const row of (data ?? []) as { agent_id: string; slug: string | null }[]) if (row.slug) map[row.agent_id] = row.slug
  return map
}

/** Approve, hide or re-open a review — admin staff only. */
export async function setFeedbackStatus(id: string, status: FeedbackStatus): Promise<{ error: string | null }> {
  try {
    const res = await fetch(`/api/admin/feedback/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    })
    if (res.ok) return { error: null }
    const body = (await res.json().catch(() => ({}))) as { error?: string }
    return { error: body.error ?? `Could not update the review (${res.status}).` }
  } catch (error) {
    return { error: (error as Error).message }
  }
}
