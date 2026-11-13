import { NextRequest, NextResponse } from "next/server"
import { requireRole } from "@/lib/auth-guard"
import { ROLES_ADMIN_STAFF } from "@/lib/app-roles"
import { createAdminSupabase } from "@/lib/admin-supabase"
import { buildCalendarFeed, shiftDay } from "@/lib/calendar/items"

/**
 * The admin Calendar's feed (boss via Juliecor, 2026-11-13): every block for a
 * span of Dubai days, built on the service role behind requireRole —
 * events, project milestones, deals, birthdays, owner-document expiries,
 * company entries, UAE holidays and the automatic emails (lib/calendar/items.ts).
 * Read-only. GET ?from=YYYY-MM-DD&to=YYYY-MM-DD (inclusive, 93 days at most;
 * default = this month with a week either side).
 */

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/
const MAX_DAYS = 93

export async function GET(req: NextRequest) {
  const guard = await requireRole([...ROLES_ADMIN_STAFF])
  if (!guard.ok) return guard.response

  const q = req.nextUrl.searchParams
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Dubai" })
  let from = q.get("from") ?? ""
  let to = q.get("to") ?? ""
  if (!ISO_DAY.test(from) || !ISO_DAY.test(to)) {
    const monthStart = `${today.slice(0, 7)}-01`
    from = shiftDay(monthStart, -7)
    to = shiftDay(shiftDay(`${today.slice(0, 7)}-01`, 31).slice(0, 7) + "-01", 7)
  }
  if (to < from) [from, to] = [to, from]
  const span = Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400e3)
  if (span > MAX_DAYS) return NextResponse.json({ error: `Ask for ${MAX_DAYS} days at most.` }, { status: 400 })

  try {
    const feed = await buildCalendarFeed(createAdminSupabase(), from, to)
    return NextResponse.json({ ...feed, today }, { headers: { "cache-control": "no-store" } })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Couldn't build the calendar." }, { status: 500 })
  }
}
