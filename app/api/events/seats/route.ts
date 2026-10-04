import { NextRequest, NextResponse } from "next/server"
import { createAdminSupabase } from "@/lib/admin-supabase"
import { daySeats, hasPaxLimits, publicDaySeats } from "@/lib/events/pax"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/**
 * Seats per date for one published event (pax per date, migration 075):
 * GET ?event=<id> → { days: [{ day, limit, left, full }] }. Seats left only —
 * never who registered, nor how many came to a day without a limit (an event
 * with no limits answers an empty list). Public, like the registration form
 * that reads it on load so "12 seats left" is live even when the page itself
 * is cached. The register route re-checks inside a lock, so this is guidance,
 * not the gate.
 */
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("event") ?? ""
  if (!UUID_RE.test(id)) return NextResponse.json({ error: "Invalid event" }, { status: 400 })

  const admin = createAdminSupabase()
  const { data: event } = await admin
    .from("events")
    .select("id, status, deleted_at, event_days, day_pax")
    .eq("id", id)
    .maybeSingle()
  if (!event || event.status !== "published" || event.deleted_at) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 })
  }

  const noStore = { headers: { "Cache-Control": "no-store" } }
  if (!hasPaxLimits(event.day_pax, event.event_days)) return NextResponse.json({ days: [] }, noStore)

  const { data: counts, error } = await admin.rpc("event_day_counts", { p_event_id: id })
  if (error) return NextResponse.json({ error: "Couldn't count seats" }, { status: 500 })

  return NextResponse.json({ days: publicDaySeats(daySeats(event.day_pax, event.event_days, counts ?? [])) }, noStore)
}
