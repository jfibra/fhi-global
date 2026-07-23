import { NextResponse } from "next/server"
import { requireActiveSession } from "@/lib/auth-guard"
import { isAdminStaffRole, isSalesPipelineRole } from "@/lib/app-roles"
import { createAdminSupabase } from "@/lib/admin-supabase"

/**
 * People who registered through the caller's invite link (?ref=<their id> —
 * see app/api/register/route.ts, which stamps metadata.invited_by). Strictly
 * session-scoped: you can only ever see your own recruits. Includes the
 * recruit's email so the recruiter can identify/contact them (emails live in
 * auth.users, resolved via the admin API).
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
    .select("id, fullname, role, status, joined_at, birthday, metadata")
    .eq("metadata->>invited_by", userId)
    .eq("is_deleted", false)
    .order("joined_at", { ascending: false })
    .limit(200)

  if (error) {
    return NextResponse.json({ error: "Failed to load recruits" }, { status: 500 })
  }

  // Resolve emails from auth.users (not stored on profiles).
  const emailMap = new Map<string, string>()
  try {
    const { data: authData } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
    for (const u of authData?.users ?? []) {
      if (u.email) emailMap.set(u.id, u.email)
    }
  } catch {
    // Non-fatal — recruits still render without emails.
  }

  // Mobile number is entered in the profile form as metadata.phone_country_code
  // + metadata.phone_number (there is no top-level `phone` column on profiles).
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "")
  const phoneFrom = (metadata: Record<string, unknown> | null) => {
    const m = metadata ?? {}
    const combined = [str(m.phone_country_code), str(m.phone_number)].filter(Boolean).join(" ")
    return combined || str(m.phone) || null
  }

  const recruits = (data ?? []).map((r) => ({
    id: r.id as string,
    fullname: (r.fullname as string | null) ?? "New member",
    email: emailMap.get(r.id as string) ?? null,
    role: (r.role as string | null) ?? "member",
    status: (r.status as string | null) ?? "pending",
    joinedAt: (r.joined_at as string | null) ?? null,
    phone: phoneFrom(r.metadata as Record<string, unknown> | null),
    birthday: (r.birthday as string | null) ?? null,
  }))

  return NextResponse.json({ recruits })
}
