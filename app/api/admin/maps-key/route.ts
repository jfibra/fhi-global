import { NextResponse } from "next/server"
import { requireRole } from "@/lib/auth-guard"
import { ROLES_DEVELOPER_CONTENT_MANAGERS, ROLES_EVENT_MANAGERS, ROLES_EVENT_OWNERS } from "@/lib/app-roles"

/**
 * Hands the Maps browser key to the project form so it can geocode an address
 * client-side.
 *
 * Geocoding has to happen in the browser: the key is HTTP-referrer restricted
 * (the correct posture for a key that already ships in public pages), and
 * Google refuses referrer-restricted keys on the server-side REST APIs.
 * Nothing is leaked by this route — the same key is embedded in /buy, /rent
 * and every project page — but it stays role-guarded so it isn't a public
 * endpoint handing out credentials.
 */

export const runtime = "nodejs"

export async function GET() {
  // Project editors geocode addresses; event managers and owners get place
  // suggestions in the event form's venue box (components/dashboard/venue-autocomplete).
  const guard = await requireRole([...ROLES_DEVELOPER_CONTENT_MANAGERS, "developer", ...ROLES_EVENT_MANAGERS, ...ROLES_EVENT_OWNERS])
  if (!guard.ok) return guard.response

  const key = process.env.GOOGLE_MAPS_API_KEY?.trim() || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() || ""
  if (!key) return NextResponse.json({ error: "Maps is not configured." }, { status: 503 })
  return NextResponse.json({ key })
}
