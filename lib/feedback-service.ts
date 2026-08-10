// Client-side data layer for the agent Customer Feedback page. Reads run on
// the browser client under RLS (agents see their own rows, admins all —
// policy in migration 039). Writes have no client path: customers submit
// through the public POST /api/feedback on the service role.

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
  status: "new" | "approved" | "hidden"
  created_at: string
}

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
