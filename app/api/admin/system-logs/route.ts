import { NextRequest, NextResponse } from "next/server"
import { requireRole } from "@/lib/auth-guard"
import { ROLES_ADMIN_STAFF } from "@/lib/app-roles"
import { createAdminSupabase } from "@/lib/admin-supabase"

// Paginated audit-log feed (All Logs + Security tabs). Admin/super-admin only.
// The list payload is trimmed (no old_values/new_values/user_agent) so pages
// stay light; the full row is lazy-loaded from /system-logs/[id] for the drawer.

export const runtime = "nodejs"

// Categories/events treated as "security" for the Security Events tab scope.
const SECURITY_CATEGORIES = ["auth", "security"]
const SECURITY_EVENTS = [
  "login_failed",
  "password_reset",
  "role_granted",
  "hard_deleted",
  "user_provisioned",
]

const LIST_COLUMNS =
  "id, occurred_at, category, event, source, actor_id, actor_name, actor_role, subject_type, subject_id, subject_label, description, changed_keys, ip_address"

export async function GET(req: NextRequest) {
  const guard = await requireRole([...ROLES_ADMIN_STAFF])
  if (!guard.ok) return guard.response

  const sp = req.nextUrl.searchParams
  const page = Math.max(1, parseInt(sp.get("page") ?? "1", 10))
  const perPage = Math.min(50, Math.max(1, parseInt(sp.get("perPage") ?? "25", 10)))
  const search = (sp.get("search") ?? "").trim()
  const category = sp.get("category") ?? ""
  const event = sp.get("event") ?? ""
  const role = sp.get("role") ?? ""
  const source = sp.get("source") ?? ""
  const from = sp.get("from") ?? ""
  const to = sp.get("to") ?? ""
  const scope = sp.get("scope") ?? ""

  const admin = createAdminSupabase()
  const rangeFrom = (page - 1) * perPage
  const rangeTo = rangeFrom + perPage - 1

  let query = admin
    .from("audit_logs")
    .select(LIST_COLUMNS, { count: "exact" })
    .order("occurred_at", { ascending: false })
    .range(rangeFrom, rangeTo)

  if (scope === "security") {
    // category IN (...) OR event IN (...)
    const catList = SECURITY_CATEGORIES.map((c) => `category.eq.${c}`)
    const evtList = SECURITY_EVENTS.map((e) => `event.eq.${e}`)
    query = query.or([...catList, ...evtList].join(","))
  }

  if (category) query = query.eq("category", category)
  if (event) query = query.eq("event", event)
  if (role) query = query.eq("actor_role", role)
  if (source) query = query.eq("source", source)
  if (from) query = query.gte("occurred_at", `${from}T00:00:00`)
  if (to) query = query.lte("occurred_at", `${to}T23:59:59.999`)
  if (search) {
    const safe = search.replace(/[%,()]/g, " ")
    query = query.or(
      `description.ilike.%${safe}%,subject_label.ilike.%${safe}%,actor_name.ilike.%${safe}%`,
    )
  }

  const { data, count, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    rows: data ?? [],
    total: count ?? 0,
    page,
    perPage,
  })
}
