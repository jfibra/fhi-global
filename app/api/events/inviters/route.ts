import { NextRequest, NextResponse } from "next/server"
import { createAdminSupabase } from "@/lib/admin-supabase"
import { APP_ROLE_ORDER } from "@/lib/app-roles"
import { titleCaseName } from "@/lib/public-profile"

/**
 * Name suggestions for the "Invited by" box on public event registration.
 *
 * Intentionally unauthenticated (attendees are not portal users) and
 * intentionally minimal: it returns display names and profile photos only —
 * no ids, emails or roles — for active staff whose names contain the typed
 * text. Photos are already public on the site's agent pages.
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
    .select("fullname, profile_url")
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

  const seen = new Set<string>()
  const people: { name: string; avatar: string | null }[] = []
  for (const r of data ?? []) {
    // Stored names are inconsistent (some ALL CAPS, some double-spaced);
    // present them the way the public agent pages do.
    const name = titleCaseName(((r.fullname as string | null) ?? "").replace(/\s+/g, " ").trim())
    if (!name || seen.has(name.toLowerCase())) continue
    seen.add(name.toLowerCase())
    const avatar = typeof r.profile_url === "string" && /^https?:\/\//.test(r.profile_url.trim()) ? r.profile_url.trim() : null
    people.push({ name, avatar })
    if (people.length >= LIMIT) break
  }

  return NextResponse.json(
    { people },
    { headers: { "Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=600" } },
  )
}
