import { NextResponse } from "next/server"
import { requireActiveSession } from "@/lib/auth-guard"
import { isAdminStaffRole } from "@/lib/app-roles"
import { createAdminSupabase } from "@/lib/admin-supabase"

// Speaker options for the Meeting Poster studio: every active agent /
// team leader / unit manager with their headshot. Service-role with an
// explicit column list (same pattern as the public agents directory) — only
// id, name and photo ever reach the browser.

export const runtime = "nodejs"

export async function GET() {
  const session = await requireActiveSession()
  if (!session.ok) return session.response
  if (!isAdminStaffRole(session.context.profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { data, error } = await createAdminSupabase()
    .from("profiles")
    .select("id, fullname, fname, lname, profile_url")
    .in("role", ["agent", "team_leader", "unit_manager"])
    .eq("status", "active")
    .not("is_deleted", "is", true)
    .order("fullname", { ascending: true })

  if (error) {
    return NextResponse.json({ error: "Failed to load speakers" }, { status: 500 })
  }

  const speakers = (data ?? [])
    .map((p) => ({
      id: String(p.id),
      name: ((p.fullname as string | null) ?? [p.fname, p.lname].filter(Boolean).join(" ")).trim(),
      photo: typeof p.profile_url === "string" && p.profile_url.trim() ? p.profile_url : "",
    }))
    .filter((s) => s.name.length > 0)

  return NextResponse.json({ speakers })
}
