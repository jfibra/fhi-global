import { NextRequest, NextResponse } from "next/server"
import { requireRole } from "@/lib/auth-guard"
import { ROLES_ADMIN_STAFF } from "@/lib/app-roles"
import { createAdminSupabase } from "@/lib/admin-supabase"

// Admin Leads Inquiries feed — public "Inquire Now" leads from project pages.
// Service-role (inquiries has no client write path), guarded to super_admin/admin.

export const runtime = "nodejs"

const STATUSES = new Set(["new", "contacted", "closed"])
const CATEGORIES = new Set(["off_plan", "ready", "rent"])
const LIST_COLUMNS =
  "id, name, email, phone_country_code, phone, looking_for, property_category, project_id, project_name, developer_name, status, source, created_at, contacted_at, deleted_at"

export async function GET(req: NextRequest) {
  const guard = await requireRole([...ROLES_ADMIN_STAFF])
  if (!guard.ok) return guard.response

  const sp = req.nextUrl.searchParams
  const page = Math.max(1, parseInt(sp.get("page") ?? "1", 10))
  const perPage = Math.min(100, Math.max(1, parseInt(sp.get("perPage") ?? "20", 10)))
  const search = (sp.get("search") ?? "").trim()
  const status = (sp.get("status") ?? "").trim()
  const category = (sp.get("category") ?? "").trim()
  const showDeleted = sp.get("showDeleted") === "true"

  const admin = createAdminSupabase()
  const rangeFrom = (page - 1) * perPage
  const rangeTo = rangeFrom + perPage - 1

  let query = admin
    .from("inquiries")
    .select(LIST_COLUMNS, { count: "exact" })
    .order("created_at", { ascending: false })
    .range(rangeFrom, rangeTo)

  if (!showDeleted) query = query.is("deleted_at", null)
  if (status && STATUSES.has(status)) query = query.eq("status", status)
  if (category && CATEGORIES.has(category)) query = query.eq("property_category", category)
  if (search) {
    const safe = search.replace(/[%,()]/g, " ")
    query = query.or(
      `name.ilike.%${safe}%,email.ilike.%${safe}%,phone.ilike.%${safe}%,project_name.ilike.%${safe}%`,
    )
  }

  const { data, count, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const summary = await buildSummary(admin)

  return NextResponse.json({ rows: data ?? [], total: count ?? 0, page, perPage, summary })
}

async function buildSummary(admin: ReturnType<typeof createAdminSupabase>) {
  const countFor = async (status?: string) => {
    let q = admin
      .from("inquiries")
      .select("id", { count: "exact", head: true })
      .is("deleted_at", null)
    if (status) q = q.eq("status", status)
    const { count } = await q
    return count ?? 0
  }
  const [total, fresh] = await Promise.all([countFor(), countFor("new")])
  return { total, new: fresh }
}
