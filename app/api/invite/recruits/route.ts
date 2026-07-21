import { NextResponse } from "next/server"
import { requireActiveSession } from "@/lib/auth-guard"
import { isAdminStaffRole, isSalesPipelineRole } from "@/lib/app-roles"
import { createAdminSupabase } from "@/lib/admin-supabase"

/**
 * People who registered through the caller's invite link (?ref=<their id> —
 * see app/api/register/route.ts, which stamps metadata.invited_by). Strictly
 * session-scoped: you can only ever see your own recruits, and only safe
 * fields (no emails/phones).
 */
export async function GET() {
  const session = await requireActiveSession()
  if (!session.ok) return session.response

  const { userId, profile } = session.context
  if (!isSalesPipelineRole(profile.role) && !isAdminStaffRole(profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const admin = createAdminSupabase()
  const { data, error } = await admin
    .from("profiles")
    .select("id, fullname, role, status, joined_at")
    .eq("metadata->>invited_by", userId)
    .eq("is_deleted", false)
    .order("joined_at", { ascending: false })
    .limit(200)

  if (error) {
    return NextResponse.json({ error: "Failed to load recruits" }, { status: 500 })
  }

  const recruits = (data ?? []).map((r) => ({
    id: r.id as string,
    fullname: (r.fullname as string | null) ?? "New member",
    role: (r.role as string | null) ?? "member",
    status: (r.status as string | null) ?? "pending",
    joinedAt: (r.joined_at as string | null) ?? null,
  }))

  return NextResponse.json({ recruits })
}
