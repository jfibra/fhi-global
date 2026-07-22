import { NextRequest, NextResponse } from "next/server"
import { requireRole } from "@/lib/auth-guard"
import { ROLES_ADMIN_STAFF } from "@/lib/app-roles"
import { createAdminSupabase } from "@/lib/admin-supabase"

// Admin "All Listings" feed — every agent's listing across the whole platform.
// Service-role only (RLS restricts agent_listings writes to the owning agent and
// hides other agents' draft images from the browser client), guarded to
// super_admin + admin.

export const runtime = "nodejs"

const SORT_FIELDS = new Set(["updated_at", "created_at", "title", "price"])
const STATUSES = new Set(["draft", "published", "archived"])
const KINDS = new Set(["sale", "rent"])

const BASE_COLUMNS =
  "id, agent_id, project_id, title, description, listing_kind, price, currency, status, unit_type, created_at, updated_at, deleted_at, " +
  "agent:profiles!agent_id ( id, fullname, role ), " +
  "agent_listing_images ( id, url, sort_order )"

export async function GET(req: NextRequest) {
  const guard = await requireRole([...ROLES_ADMIN_STAFF])
  if (!guard.ok) return guard.response

  const sp = req.nextUrl.searchParams
  const page = Math.max(1, parseInt(sp.get("page") ?? "1", 10))
  const perPage = Math.min(100, Math.max(1, parseInt(sp.get("perPage") ?? "20", 10)))
  const search = (sp.get("search") ?? "").trim()
  const developerId = (sp.get("developerId") ?? "").trim()
  const status = (sp.get("status") ?? "").trim()
  const kind = (sp.get("kind") ?? "").trim()
  const agentId = (sp.get("agentId") ?? "").trim()
  const showDeleted = sp.get("showDeleted") === "true"
  const sortField = SORT_FIELDS.has(sp.get("sort") ?? "") ? (sp.get("sort") as string) : "updated_at"
  const sortDir = sp.get("dir") === "asc" ? "asc" : "desc"

  const admin = createAdminSupabase()
  const rangeFrom = (page - 1) * perPage
  const rangeTo = rangeFrom + perPage - 1

  // Inner-join projects only when filtering by developer, so listings without a
  // project (project_id NULL) are still returned in the default view.
  const projectEmbed = developerId
    ? "projects!inner ( id, name, developer_id, developers ( id, name ) )"
    : "projects ( id, name, developer_id, developers ( id, name ) )"

  let query = admin
    .from("agent_listings")
    .select(`${BASE_COLUMNS}, ${projectEmbed}`, { count: "exact" })
    .order(sortField, { ascending: sortDir === "asc" })
    .range(rangeFrom, rangeTo)

  if (!showDeleted) query = query.is("deleted_at", null)
  if (developerId) query = query.eq("projects.developer_id", developerId)
  if (status && STATUSES.has(status)) query = query.eq("status", status)
  if (kind && KINDS.has(kind)) query = query.eq("listing_kind", kind)
  if (agentId) query = query.eq("agent_id", agentId)
  if (search) {
    const safe = search.replace(/[%,()]/g, " ")
    query = query.ilike("title", `%${safe}%`)
  }

  const { data, count, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Overall (unfiltered, non-deleted) status counts for the summary tiles.
  const summary = await buildSummary(admin)

  return NextResponse.json({
    rows: data ?? [],
    total: count ?? 0,
    page,
    perPage,
    summary,
  })
}

async function buildSummary(admin: ReturnType<typeof createAdminSupabase>) {
  const countFor = async (status: string) => {
    const { count } = await admin
      .from("agent_listings")
      .select("id", { count: "exact", head: true })
      .is("deleted_at", null)
      .eq("status", status)
    return count ?? 0
  }
  const [published, draft, archived] = await Promise.all([
    countFor("published"),
    countFor("draft"),
    countFor("archived"),
  ])
  return { published, draft, archived, total: published + draft + archived }
}
