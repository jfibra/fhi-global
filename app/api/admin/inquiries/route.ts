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
  "id, name, email, phone_country_code, phone, looking_for, property_category, project_id, project_name, developer_name, status, source, created_at, contacted_at, read_at, starred_at, deleted_at"
// Pre-migration fallback tiers — the inbox still loads with degraded state
// until `npm run db:migrate` applies 031 (read_at) / 032 (starred_at).
const FALLBACK_TIERS = [
  LIST_COLUMNS,
  LIST_COLUMNS.replace(", starred_at", ""),
  LIST_COLUMNS.replace(", read_at", "").replace(", starred_at", ""),
]

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
  const starredOnly = sp.get("starred") === "true"

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
    // Legacy shapes: status 'new' is the closest thing to "unread"; without a
    // starred_at column nothing is starred, so that folder is simply empty
    // (id is never NULL — the filter matches no rows).
    if (unreadOnly) query = columns.includes("read_at") ? query.is("read_at", null) : query.eq("status", "new")
    if (starredOnly) query = columns.includes("starred_at") ? query.not("starred_at", "is", null) : query.is("id", null)
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

  // List and summary ride in one parallel batch — sequential awaits here were
  // most of the page's perceived latency (every query is a Supabase round trip).
  const [result, summary] = await Promise.all([
    (async () => {
      // 42703 = undefined column: walk down the tiers until one matches the
      // columns that actually exist (migrations 031/032 not applied yet).
      let r = await buildQuery(FALLBACK_TIERS[0])
      for (let tier = 1; tier < FALLBACK_TIERS.length && r.error?.code === "42703"; tier++) {
        r = await buildQuery(FALLBACK_TIERS[tier])
      }
      return r
    })(),
    buildSummary(admin),
  ])
  const { data, count, error } = result
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ rows: data ?? [], total: count ?? 0, page, perPage, summary })
}

async function buildSummary(admin: ReturnType<typeof createAdminSupabase>) {
  const base = () =>
    admin.from("inquiries").select("id", { count: "exact", head: true }).is("deleted_at", null)
  // All counts in one parallel batch — one round-trip's worth of waiting.
  // Every count feeds the mailbox rail (folders + categories).
  const [totalRes, freshRes, unreadRes, starredRes, sentRes, sentUnreadRes, offPlanRes, readyRes, rentRes] =
    await Promise.all([
      base(),
      base().eq("status", "new"),
      // Pre-migration-031 there is no read_at — fall back to the 'new' count.
      base().is("read_at", null),
      // Pre-migration-032 there is no starred_at — 0.
      base().not("starred_at", "is", null),
      // Sent tab counter — outbound only, replies don't inflate it. Errors
      // (table/column missing pre-migration) just mean 0.
      admin.from("inquiry_emails").select("id", { count: "exact", head: true }).eq("direction", "outbound"),
      // Unread replies to composed mail — the attention badge on Sent.
      admin
        .from("inquiry_emails")
        .select("id", { count: "exact", head: true })
        .eq("direction", "inbound")
        .is("inquiry_id", null)
        .is("read_at", null),
      base().eq("property_category", "off_plan"),
      base().eq("property_category", "ready"),
      base().eq("property_category", "rent"),
    ])
  const fresh = freshRes.count ?? 0
  return {
    total: totalRes.count ?? 0,
    new: fresh,
    unread: unreadRes.error ? fresh : unreadRes.count ?? 0,
    starred: starredRes.error ? 0 : starredRes.count ?? 0,
    sent: sentRes.error ? 0 : sentRes.count ?? 0,
    sentUnread: sentUnreadRes.error ? 0 : sentUnreadRes.count ?? 0,
    categories: {
      off_plan: offPlanRes.count ?? 0,
      ready: readyRes.count ?? 0,
      rent: rentRes.count ?? 0,
    },
  }
}
