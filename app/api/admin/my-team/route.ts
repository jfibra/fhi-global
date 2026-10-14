import { NextRequest, NextResponse } from "next/server"
import { requireRole } from "@/lib/auth-guard"
import { ROLES_ADMIN_STAFF } from "@/lib/app-roles"
import { createAdminSupabase } from "@/lib/admin-supabase"
import { buildMyTeam } from "@/lib/my-team"

/**
 * Admin Team Performance (boss via Juliecor, 2026-10-14): any account's My Team
 * data — the same buildMyTeam() the recruiter's own page reads. Admin staff only.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function GET(req: NextRequest) {
  const guard = await requireRole([...ROLES_ADMIN_STAFF])
  if (!guard.ok) return guard.response
  const id = req.nextUrl.searchParams.get("id") ?? ""
  if (!UUID.test(id)) return NextResponse.json({ error: "Bad id." }, { status: 400 })
  const admin = createAdminSupabase()
  const { data: p } = await admin.from("profiles").select("fullname, profile_url, role").eq("id", id).maybeSingle()
  if (!p) return NextResponse.json({ error: "No such account." }, { status: 404 })
  try {
    const team = await buildMyTeam(admin, id, { name: p.fullname as string | null, photo: p.profile_url as string | null, role: p.role as string | null })
    return NextResponse.json(team, { headers: { "Cache-Control": "no-store" } })
  } catch {
    return NextResponse.json({ error: "Couldn't load the team." }, { status: 500 })
  }
}
