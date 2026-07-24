import { NextRequest, NextResponse } from "next/server"
import { isAdminStaffRole } from "@/lib/app-roles"
import { createClient } from "@/lib/supabase/server"
import { createAdminSupabase } from "@/lib/admin-supabase"

// Paginated audit trail for one user: everything they did (actor_id) or that
// happened to their account (subject_id). Service-role + admin-staff guard.
// Pagination keeps the profile modal fast even for very active accounts.

export const runtime = "nodejs"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const COLUMNS =
  "id, occurred_at, category, event, source, actor_id, actor_name, actor_role, " +
  "subject_type, subject_id, subject_label, description, changed_keys, ip_address"

async function isAdminCaller(): Promise<boolean> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()
  return Boolean(profile && isAdminStaffRole(profile.role))
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminCaller())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  if (!UUID_RE.test(id)) return NextResponse.json({ error: "Invalid user id" }, { status: 400 })

  const sp = req.nextUrl.searchParams
  const page = Math.max(1, parseInt(sp.get("page") ?? "1", 10))
  const perPage = Math.min(50, Math.max(1, parseInt(sp.get("perPage") ?? "10", 10)))
  const rangeFrom = (page - 1) * perPage
  const rangeTo = rangeFrom + perPage - 1

  const admin = createAdminSupabase()
  const { data, count, error } = await admin
    .from("audit_logs")
    .select(COLUMNS, { count: "exact" })
    .or(`actor_id.eq.${id},subject_id.eq.${id}`)
    .order("occurred_at", { ascending: false })
    .range(rangeFrom, rangeTo)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ rows: data ?? [], total: count ?? 0, page, perPage })
}
