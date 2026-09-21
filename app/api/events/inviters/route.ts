import { NextRequest, NextResponse } from "next/server"
import { createAdminSupabase } from "@/lib/admin-supabase"
import { APP_ROLE_ORDER } from "@/lib/app-roles"

/**
 * Name suggestions for the "Invited by" box on public event registration.
 *
 * Intentionally unauthenticated (attendees are not portal users) and
 * intentionally minimal: it returns display names only — no ids, emails,
 * roles or avatars — for active staff whose names contain the typed text.
 * The box stays free text; a name that is not suggested still registers.
 */

/** Staff who can plausibly invite someone: everyone except public members and developer accounts. */
const INVITER_ROLES = APP_ROLE_ORDER.filter((r) => r !== "member" && r !== "developer")
const MIN_QUERY = 2
const LIMIT = 8

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("q") ?? ""
  // Letters (any script), marks, spaces, dots, apostrophes and hyphens only —
  // strips ilike wildcards and anything else before it reaches the query.
  const q = raw.replace(/[^\p{L}\p{M} .'-]/gu, "").trim().slice(0, 60)
  if (q.length < MIN_QUERY) return NextResponse.json({ names: [] })

  const admin = createAdminSupabase()
  const { data, error } = await admin
    .from("profiles")
    .select("fullname")
    .in("role", INVITER_ROLES)
    .eq("status", "active")
    .eq("is_deleted", false)
    .ilike("fullname", `%${q}%`)
    .order("fullname")
    .limit(LIMIT * 2)

  if (error) {
    console.error("[events/inviters] lookup failed:", error.message)
    return NextResponse.json({ names: [] })
  }

  const names = Array.from(
    new Set((data ?? []).map((r) => ((r.fullname as string | null) ?? "").replace(/\s+/g, " ").trim()).filter(Boolean)),
  ).slice(0, LIMIT)

  return NextResponse.json(
    { names },
    { headers: { "Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=600" } },
  )
}
