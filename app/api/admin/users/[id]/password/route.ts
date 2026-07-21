import { NextRequest, NextResponse } from "next/server"
import { isAdminStaffRole } from "@/lib/app-roles"
import { createClient } from "@/lib/supabase/server"
import { createAdminSupabase } from "@/lib/admin-supabase"
import { logAuditEvent, requestContextFromRequest } from "@/lib/audit-log"

type AdminCaller = { id: string; name: string | null; role: string | null }

async function requireAdmin(): Promise<AdminCaller | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, fullname")
    .eq("id", user.id)
    .single()
  if (!profile || !isAdminStaffRole(profile.role)) return null
  return { id: user.id, name: profile.fullname ?? user.email ?? null, role: profile.role }
}

// ─── POST /api/admin/users/[id]/password ───────────────────────────────────────
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const caller = await requireAdmin()
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const { password } = (await req.json()) as { password: string }

  if (!password || password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 })
  }

  const admin = createAdminSupabase()

  const { error } = await admin.auth.admin.updateUserById(id, { password })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Never log the password itself — just that a reset happened, by whom, to whom.
  const { data: target } = await admin
    .from("profiles")
    .select("fullname")
    .eq("id", id)
    .maybeSingle<{ fullname: string | null }>()

  await logAuditEvent({
    category: "security",
    event: "password_reset",
    source: "dashboard",
    actor: caller,
    subjectType: "profiles",
    subjectId: id,
    subjectLabel: target?.fullname ?? null,
    description: `Reset password for ${target?.fullname ?? id}`,
    ...requestContextFromRequest(req),
  })

  return NextResponse.json({ ok: true })
}
