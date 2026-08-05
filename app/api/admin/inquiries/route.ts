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
  "id, name, email, phone_country_code, phone, looking_for, property_category, project_id, project_name, developer_name, status, source, created_at, contacted_at, read_at, deleted_at"
// Pre-migration-031 fallback (no read_at) — the inbox still loads, rows just
// carry no read state until `npm run db:migrate` applies 031_inquiry_emails.
const LEGACY_COLUMNS = LIST_COLUMNS.replace(", read_at", "")

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
  // The Emails page has a dedicated Archived folder — only soft-deleted rows.
  const archivedOnly = sp.get("archived") === "only"
  const unreadOnly = sp.get("unread") === "true"

  const admin = createAdminSupabase()
  const rangeFrom = (page - 1) * perPage
  const rangeTo = rangeFrom + perPage - 1

  const buildQuery = (columns: string) => {
    let query = admin
      .from("inquiries")
      .select(columns, { count: "exact" })
      .order("created_at", { ascending: false })
      .range(rangeFrom, rangeTo)

    if (archivedOnly) query = query.not("deleted_at", "is", null)
    else if (!showDeleted) query = query.is("deleted_at", null)
    // Legacy shape: status 'new' is the closest thing to "unread".
    if (unreadOnly) query = columns === LIST_COLUMNS ? query.is("read_at", null) : query.eq("status", "new")
    if (status && STATUSES.has(status)) query = query.eq("status", status)
    if (category && CATEGORIES.has(category)) query = query.eq("property_category", category)
    if (search) {
      const safe = search.replace(/[%,()]/g, " ")
      query = query.or(
        `name.ilike.%${safe}%,email.ilike.%${safe}%,phone.ilike.%${safe}%,project_name.ilike.%${safe}%`,
      )
    }
    return query
  }

  let result = await buildQuery(LIST_COLUMNS)
  // 42703 = undefined column: migration 031 not applied yet.
  if (result.error?.code === "42703") result = await buildQuery(LEGACY_COLUMNS)
  const { data, count, error } = result
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const summary = await buildSummary(admin)

  return NextResponse.json({ rows: data ?? [], total: count ?? 0, page, perPage, summary })
}

async function buildSummary(admin: ReturnType<typeof createAdminSupabase>) {
  const base = () =>
    admin.from("inquiries").select("id", { count: "exact", head: true }).is("deleted_at", null)
  const countFor = async (filter?: (q: ReturnType<typeof base>) => ReturnType<typeof base>) => {
    const q = base()
    const { count } = await (filter ? filter(q) : q)
    return count ?? 0
  }
  const [total, fresh] = await Promise.all([countFor(), countFor((q) => q.eq("status", "new"))])
  // Pre-migration-031 there is no read_at — treat 'new' as unread.
  const unreadRes = await base().is("read_at", null)
  const unread = unreadRes.error ? fresh : unreadRes.count ?? 0
  // Sent tab counter. Errors (e.g. table missing pre-migration) just mean 0.
  const sentRes = await admin.from("inquiry_emails").select("id", { count: "exact", head: true })
  const sent = sentRes.error ? 0 : sentRes.count ?? 0
  return { total, new: fresh, unread, sent }
}
