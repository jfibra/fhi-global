import { NextRequest, NextResponse } from "next/server"
import { createAdminSupabase } from "@/lib/admin-supabase"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/**
 * Public visit ping from the event page. Increments the event's view counter
 * (and QR-scan counter when the visit came from a scanned code). Fire-and-
 * forget from the client — always answers 204 so it never breaks the page.
 */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { eventId?: unknown; fromQr?: unknown }
  const eventId = typeof body.eventId === "string" ? body.eventId : ""
  if (!UUID_RE.test(eventId)) {
    return new NextResponse(null, { status: 204 })
  }

  const admin = createAdminSupabase()
  await admin.rpc("increment_event_view", {
    p_event_id: eventId,
    p_from_qr: body.fromQr === true,
  })

  return new NextResponse(null, { status: 204 })
}
