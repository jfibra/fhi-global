import type { SupabaseClient } from "@supabase/supabase-js"
import { eventLastDayStart } from "@/lib/events/dates"

/** One card in an agent website's Events section (migration 057). */
export type WebsiteEventCard = {
  id: string
  slug: string | null
  title: string
  image_url: string | null
  event_date: string | null
  /** Consecutive days (071). */
  event_days: number | null
  /** Per-day start times (072). */
  day_times: unknown
  venue: string | null
  registration_open: boolean | null
}

/** Registration stays open for walk-ins until a day after the start. */
const PAST_AFTER_MS = 24 * 60 * 60 * 1000

/**
 * An agent's published, live events for their website: upcoming first
 * (soonest first, undated ones after them), then past ones (most recent
 * first). Past events stay listed so attendees can still reach the
 * certificate page. Events the agent put on fhiglobal.ae only (074) aren't.
 */
export async function loadAgentWebsiteEvents(
  admin: SupabaseClient,
  agentId: string,
  limit = 12,
): Promise<{ upcoming: WebsiteEventCard[]; past: WebsiteEventCard[] }> {
  const { data, error } = await admin
    .from("events")
    .select("id, slug, title, image_url, event_date, event_days, day_times, venue, registration_open")
    .eq("agent_id", agentId)
    .eq("status", "published")
    .eq("show_on_website", true)
    .is("deleted_at", null)
    .order("event_date", { ascending: true, nullsFirst: false })
    .limit(50)
  if (error || !data) return { upcoming: [], past: [] }

  const now = Date.now()
  const rows = data as WebsiteEventCard[]
  // Past a day after the LAST day starts (a multi-day event stays upcoming).
  const isPast = (e: WebsiteEventCard) => {
    const last = eventLastDayStart(e.event_date, e.event_days, e.day_times)
    return last !== null && last.getTime() + PAST_AFTER_MS < now
  }
  const upcoming = rows.filter((e) => !isPast(e))
  const past = rows.filter(isPast).reverse()
  return { upcoming: upcoming.slice(0, limit), past: past.slice(0, Math.max(0, limit - upcoming.length)) }
}
