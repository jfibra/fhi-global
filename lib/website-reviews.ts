import type { SupabaseClient } from "@supabase/supabase-js"
import type { Testimonial } from "@/app/website/_data"

// "What My Clients Say" on an agent's website: the agent's customer feedback
// (migration 039, collected through their /feedback/<agentId> link) that an
// admin has marked approved. A card shows only the client's answer to "what
// did your advisor do well", their first name and last initial, and their
// overall rating — never the improvement notes, property reference or any
// contact details. An agent with no approved reviews gets no section at all.

export type ReviewRow = {
  client_name: string | null
  did_well: string | null
  overall_rating: number | null
  transaction_type: string | null
}

// Legacy sale/purchase rows became "buy" in migration 040.
const CLIENT_LABELS: Record<string, string> = {
  buy: "Buyer", sale: "Buyer", purchase: "Buyer",
  resell: "Seller",
  rent: "Rental client",
}

/** "Maireen Santiago" → "Maireen S."; a single name stays as it is. */
function reviewerName(fullName: string | null): string {
  const parts = (fullName ?? "").trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "Client"
  const first = parts[0].charAt(0).toUpperCase() + parts[0].slice(1)
  return parts.length > 1 ? `${first} ${parts[parts.length - 1].charAt(0).toUpperCase()}.` : first
}

/** A review as the website shows it; null when it has no "did well" answer. */
export function feedbackToTestimonial(row: ReviewRow): Testimonial | null {
  const quote = row.did_well?.trim()
  if (!quote) return null
  const rating = Math.round(Number(row.overall_rating))
  return {
    quote,
    name: reviewerName(row.client_name),
    where: CLIENT_LABELS[row.transaction_type ?? ""] ?? "Client",
    rating: rating >= 1 && rating <= 5 ? rating : undefined,
  }
}

/**
 * An agent's approved reviews, newest first. Server pages pass the
 * service-role client; the Website Builder passes the browser client, which
 * RLS limits to the agent's own rows.
 */
export async function loadAgentWebsiteReviews(supabase: SupabaseClient, agentId: string, limit = 12): Promise<Testimonial[]> {
  const { data, error } = await supabase
    .from("agent_feedback")
    .select("client_name, did_well, overall_rating, transaction_type")
    .eq("agent_id", agentId)
    .eq("status", "approved")
    .order("created_at", { ascending: false })
    .limit(limit)
  if (error || !data) return []
  return (data as ReviewRow[]).map(feedbackToTestimonial).filter((t): t is Testimonial => t !== null)
}
